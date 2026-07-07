const mammoth = require("mammoth");

// unpdf is ESM-only, so we import it dynamically when needed
let unpdfExtractText;
async function getUnpdfExtractText() {
  if (!unpdfExtractText) {
    const unpdf = await import("unpdf");
    unpdfExtractText = unpdf.extractText;
  }
  return unpdfExtractText;
}

/** Max raw bytes fetched from a URL (step 1 — no AI). */
const MAX_URL_BYTES = 2 * 1024 * 1024;
/** Max chars kept after cleaning (step 2 — no AI). */
const MAX_CLEAN_TEXT_CHARS = 120_000;
/** Max chars sent to AI for analysis (step 3 — token budget). */
const MAX_AI_INPUT_CHARS = Number(process.env.FETCH_INFO_MAX_AI_CHARS) || 12_000;

const BOILERPLATE_PATTERNS = [
  /cookie(s)?\s+policy/i,
  /privacy\s+policy/i,
  /terms\s+(of\s+)?(use|service)/i,
  /all\s+rights\s+reserved/i,
  /subscribe\s+to\s+(our\s+)?newsletter/i,
  /accept\s+all\s+cookies/i,
  /manage\s+cookie\s+preferences/i,
];

function truncateText(text, max = MAX_CLEAN_TEXT_CHARS) {
  const cleaned = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}\n\n[Content truncated]`;
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function extractTitleFromHtml(html) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeEntities(match[1].replace(/\s+/g, " ").trim()) : "";
}

function extractMetaDescription(html) {
  const match = String(html || "").match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
  );
  return match ? decodeEntities(match[1].trim()) : "";
}

function extractHeadingsFromHtml(html) {
  const headings = [];
  const re = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match;
  while ((match = re.exec(String(html || "")))) {
    const line = stripHtml(match[1]).trim();
    if (line && line.length < 200) headings.push(line);
  }
  return [...new Set(headings)].slice(0, 20);
}

function dedupeLines(text) {
  const seen = new Set();
  const lines = String(text || "").split("\n");
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    if (BOILERPLATE_PATTERNS.some((re) => re.test(trimmed))) continue;
    seen.add(key);
    kept.push(trimmed);
  }
  return kept.join("\n");
}

/**
 * Step 2 — compress cleaned text for a single AI call (no AI used here).
 */
function prepareTextForAi(text, { label = "source" } = {}) {
  const deduped = dedupeLines(text);
  if (deduped.length <= MAX_AI_INPUT_CHARS) {
    return { text: deduped, cleanChars: deduped.length, aiInputChars: deduped.length, truncated: false };
  }
  const head = deduped.slice(0, Math.floor(MAX_AI_INPUT_CHARS * 0.85));
  const tail = deduped.slice(-Math.floor(MAX_AI_INPUT_CHARS * 0.1));
  const compressed = `${head}\n\n[...middle section omitted to save AI tokens...]\n\n${tail}`;
  return {
    text: compressed.slice(0, MAX_AI_INPUT_CHARS),
    cleanChars: deduped.length,
    aiInputChars: Math.min(compressed.length, MAX_AI_INPUT_CHARS),
    truncated: true,
    label,
  };
}

/**
 * Step 1 — fetch raw website content (no AI).
 */
async function scrapeWebsite(url) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "APEX-LinkedIn-Intel/1.0 (+company research)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(`Website returned HTTP ${res.status}`);
    }

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_URL_BYTES) {
      throw new Error("Website content is too large to analyze");
    }

    return {
      url,
      hostname: parsed.hostname,
      contentType,
      buffer,
      bytesFetched: buffer.length,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Step 2 — extract and clean text from scraped website (no AI).
 */
async function extractCleanWebsiteText(scrape) {
  const { url, hostname, contentType, buffer } = scrape;

  if (contentType.includes("application/pdf")) {
    try {
      const extractText = await getUnpdfExtractText();
      const uint8Array = new Uint8Array(buffer);
      const result = await extractText(uint8Array, { mergePages: true });
      const text = typeof result === "string" ? result : result.text || "";
      return {
        source: "website_pdf",
        url,
        title: hostname,
        cleanText: truncateText(text),
        scrapeMeta: { type: "website_pdf", bytesFetched: scrape.bytesFetched },
      };
    } catch (err) {
      throw new Error(`Failed to parse PDF from website: ${err.message}`);
    }
  }

  const raw = buffer.toString("utf8");
  const title = extractTitleFromHtml(raw) || hostname;
  const description = extractMetaDescription(raw);
  const headings = extractHeadingsFromHtml(raw);
  const body = stripHtml(raw);
  const headingBlock = headings.length ? `Key headings:\n${headings.map((h) => `- ${h}`).join("\n")}` : "";
  const combined = [title, description, headingBlock, body].filter(Boolean).join("\n\n");
  const cleanText = truncateText(dedupeLines(combined));

  return {
    source: "website",
    url,
    title,
    cleanText,
    scrapeMeta: { type: "website", bytesFetched: scrape.bytesFetched, headingCount: headings.length },
  };
}

async function fetchWebsiteText(url) {
  const scrape = await scrapeWebsite(url);
  const extracted = await extractCleanWebsiteText(scrape);
  return {
    source: extracted.source,
    url: extracted.url,
    title: extracted.title,
    text: extracted.cleanText,
  };
}

async function extractFileText(file) {
  const name = String(file.originalname || "").toLowerCase();
  const mime = String(file.mimetype || "").toLowerCase();
  let rawText = "";

  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const extractText = await getUnpdfExtractText();
      const uint8Array = new Uint8Array(file.buffer);
      const result = await extractText(uint8Array, { mergePages: true });
      rawText = typeof result === "string" ? result : result.text || "";
    } catch (err) {
      throw new Error(`Failed to parse PDF file: ${err.message}`);
    }
  } else if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    rawText = result.value || "";
  } else if (mime === "application/msword" || name.endsWith(".doc")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    if (!result.value?.trim()) {
      throw new Error("Could not read .doc file — try saving as .docx or PDF");
    }
    rawText = result.value;
  } else if (mime === "text/plain" || name.endsWith(".txt")) {
    rawText = file.buffer.toString("utf8");
  } else {
    throw new Error("Unsupported file type — upload PDF, DOC, DOCX, or TXT");
  }

  const cleanText = truncateText(dedupeLines(rawText));
  const source =
    mime === "application/pdf" || name.endsWith(".pdf")
      ? "pdf"
      : name.endsWith(".docx")
        ? "docx"
        : name.endsWith(".doc")
          ? "doc"
          : "txt";

  return {
    source,
    filename: file.originalname,
    text: cleanText,
    cleanText,
  };
}

module.exports = {
  scrapeWebsite,
  extractCleanWebsiteText,
  prepareTextForAi,
  fetchWebsiteText,
  extractFileText,
  truncateText,
  MAX_AI_INPUT_CHARS,
};
