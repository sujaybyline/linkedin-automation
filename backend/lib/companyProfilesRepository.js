const { query } = require("../db");

function slugify(name) {
  const base = String(name || "company")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "company";
}

async function uniqueSlug(companyName) {
  let slug = slugify(companyName);
  let attempt = slug;
  let n = 2;
  while (true) {
    const rows = await query("SELECT id FROM company_profiles WHERE slug = ? LIMIT 1", [attempt]);
    if (!rows.length) return attempt;
    attempt = `${slug}-${n}`;
    n += 1;
  }
}

function parseRow(row) {
  if (!row) return null;
  let intel = row.intel_json;
  let sources = row.sources_json;
  if (typeof intel === "string") {
    try {
      intel = JSON.parse(intel);
    } catch {
      intel = {};
    }
  }
  if (typeof sources === "string") {
    try {
      sources = JSON.parse(sources);
    } catch {
      sources = [];
    }
  }
  return {
    id: row.id,
    companyName: row.company_name,
    slug: row.slug,
    websiteUrl: row.website_url,
    intel,
    sourcesAnalyzed: sources || [],
    source: row.ai_source,
    model: row.ai_model,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function saveCompanyProfile({
  companyName,
  websiteUrl,
  intel,
  sourcesAnalyzed,
  source,
  model,
  createdBy,
}) {
  const name = String(companyName || intel?.companyName || "Company").trim();
  const slug = await uniqueSlug(name);

  const existing = await query(
    "SELECT id FROM company_profiles WHERE company_name = ? ORDER BY updated_at DESC LIMIT 1",
    [name]
  );

  const payload = {
    company_name: name,
    slug,
    website_url: websiteUrl || "",
    intel_json: JSON.stringify(intel),
    sources_json: JSON.stringify(sourcesAnalyzed || []),
    ai_source: source || "",
    ai_model: model || "",
    created_by: createdBy || null,
  };

  if (existing[0]?.id) {
    await query(
      `UPDATE company_profiles
       SET website_url = ?, intel_json = ?, sources_json = ?, ai_source = ?, ai_model = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        payload.website_url,
        payload.intel_json,
        payload.sources_json,
        payload.ai_source,
        payload.ai_model,
        existing[0].id,
      ]
    );
    return getCompanyProfileById(existing[0].id);
  }

  const result = await query(
    `INSERT INTO company_profiles
     (company_name, slug, website_url, intel_json, sources_json, ai_source, ai_model, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.company_name,
      slug,
      payload.website_url,
      payload.intel_json,
      payload.sources_json,
      payload.ai_source,
      payload.ai_model,
      payload.created_by,
    ]
  );
  return getCompanyProfileById(result.insertId);
}

async function listCompanyProfiles() {
  const rows = await query(
    `SELECT id, company_name, slug, website_url, ai_source, ai_model, created_at, updated_at
     FROM company_profiles
     ORDER BY updated_at DESC`
  );
  return rows.map((r) => ({
    id: r.id,
    companyName: r.company_name,
    slug: r.slug,
    websiteUrl: r.website_url,
    source: r.ai_source,
    model: r.ai_model,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

async function getCompanyProfileById(id) {
  const rows = await query("SELECT * FROM company_profiles WHERE id = ? LIMIT 1", [id]);
  return parseRow(rows[0]);
}

function buildCompanyBrief(profile) {
  const intel = profile?.intel || {};
  const lines = [
    `Company: ${profile?.companyName || intel.companyName || "Unknown"}`,
    intel.tagline ? `Tagline: ${intel.tagline}` : "",
    intel.industry ? `Industry: ${intel.industry}` : "",
    intel.summary ? `Summary: ${intel.summary}` : "",
    intel.brandVoice ? `Brand voice: ${intel.brandVoice}` : "",
    intel.contentPillars?.length
      ? `Content pillars: ${intel.contentPillars.join("; ")}`
      : "",
    intel.keyMessages?.length ? `Key messages:\n- ${intel.keyMessages.join("\n- ")}` : "",
    intel.hotTopics?.length
      ? `Hot topics:\n${intel.hotTopics
          .slice(0, 8)
          .map((t) => `- ${t.topic}${t.suggestedAngle ? ` (${t.suggestedAngle})` : ""}`)
          .join("\n")}`
      : "",
    intel.suggestedHashtags?.length
      ? `Hashtags: ${intel.suggestedHashtags.join(" ")}`
      : "",
  ];
  return lines.filter(Boolean).join("\n\n");
}

async function deleteCompanyProfile(id) {
  const profile = await getCompanyProfileById(id);
  if (!profile) return null;
  await query("UPDATE posts SET company_profile_id = NULL WHERE company_profile_id = ?", [id]);
  await query("DELETE FROM company_profiles WHERE id = ?", [id]);
  return profile;
}

module.exports = {
  saveCompanyProfile,
  listCompanyProfiles,
  getCompanyProfileById,
  buildCompanyBrief,
  deleteCompanyProfile,
};
