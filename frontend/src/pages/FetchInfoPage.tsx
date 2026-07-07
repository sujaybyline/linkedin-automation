import { useEffect, useRef, useState } from "react";
import { Globe, Upload, Sparkles, Loader2, Flame, FileText, X } from "lucide-react";
import { PageHeader } from "../components/ui";
import { CompanyIntelDisplay, type CompanyIntelData } from "../components/CompanyIntelDisplay";
import { useCompanyProfiles } from "../context/CompanyProfilesContext";
import { apiGet, apiPost } from "../services/api";

type AiProvider = "gemini" | "openai" | "ollama" | "ollama-local" | "ollama-hosted" | "auto";

interface CompanyIntel extends CompanyIntelData {
  profileId?: number;
  providerFallback?: boolean;
  fallbackNote?: string;
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40";

const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

export function FetchInfoPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { refresh: refreshProfiles } = useCompanyProfiles();

  const [websiteUrl, setWebsiteUrl] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [provider, setProvider] = useState<AiProvider>("auto");

  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState("");
  const [intel, setIntel] = useState<CompanyIntel | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [availableProviders, setAvailableProviders] = useState<AiProvider[]>(["gemini", "openai", "ollama-hosted", "ollama-local"]);

  function handleFilesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selectedFiles]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  const hasWebsite = Boolean(websiteUrl.trim());
  const hasDocuments = files.length > 0;
  const canFetch = hasWebsite || hasDocuments;

  useEffect(() => {
    apiGet<{ providers: { id: AiProvider; label: string; type: string }[]; defaultProvider: AiProvider }>(
      "ai/providers"  
    )
      .then((data) => {
        if (data.providers?.length) setAvailableProviders(data.providers.map((p) => p.id));
        if (data.defaultProvider) setProvider(data.defaultProvider);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  async function handleFetch() {
    if (!canFetch) {
      setMessage("Error: Please add a website URL or upload at least one document.");
      return;
    }

    setFetching(true);
    setMessage("");
    setIntel(null);
    setProfileId(null);

    const fd = new FormData();
    if (websiteUrl.trim()) fd.append("website_url", websiteUrl.trim());
    files.forEach((file) => fd.append("files", file));
    fd.append("provider", provider);

    try {
      const result = await apiPost<CompanyIntel>("ai/fetch-info", fd);
      setIntel(result);
      setProfileId(result.profileId ?? null);
      await refreshProfiles();

      const via =
        result.source === "openai" ? "OpenAI" : result.source === "gemini" ? "Gemini" : "AI";
      let msg = `✓ Saved to sidebar. Analysis via ${via}${result.model ? ` (${result.model})` : ""}.`;
      if (result.fallbackNote) msg += ` ${result.fallbackNote}`;
      setMessage(msg);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Fetch failed"}`);
    } finally {
      setFetching(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Fetch Info"
        description="Add a company website or upload documents (PDF, DOC, DOCX, TXT). You can add both website and multiple documents. AI builds a marketing brief and saves it to the sidebar."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
            <Globe className="h-4 w-4 text-blue-400" />
            Company sources
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Add website URL and/or upload documents. At least one source is required.
          </p>

          <div className="space-y-4">
            <div>
              <label className={labelClass}>
                Website URL
                <span className="ml-1 text-slate-600">(optional if documents added)</span>
              </label>
              <input
                className={inputClass}
                placeholder="https://company.com or company.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass}>
                Upload documents
                <span className="ml-1 text-slate-600">(optional if URL added)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                multiple
                onChange={handleFilesSelect}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/50 px-4 py-6 text-slate-400 transition hover:border-slate-600 hover:text-slate-300"
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">Click to upload PDF, DOC, DOCX, or TXT</span>
                <span className="text-xs text-slate-600">Multiple files supported</span>
              </button>

              {/* Uploaded files list */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-slate-400">
                    Uploaded files ({files.length}):
                  </p>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded border border-slate-700/50 bg-slate-900 px-3 py-2"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-blue-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-slate-200">{file.name}</p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400"
                          aria-label="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>AI provider</label>
              <select
                className={inputClass}
                value={provider}
                onChange={(e) => setProvider(e.target.value as AiProvider)}
              >
                <option value="auto">Auto (recommended)</option>
                {availableProviders.includes("gemini") && <option value="gemini">Gemini</option>}
                {availableProviders.includes("openai") && <option value="openai">OpenAI</option>}
                {availableProviders.includes("ollama-hosted") && (
                  <option value="ollama-hosted">Ollama (Hosted)</option>
                )}
                {availableProviders.includes("ollama-local") && (
                  <option value="ollama-local">Ollama (Local)</option>
                )}
                {availableProviders.includes("ollama") && <option value="ollama">Ollama</option>}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Auto tries Gemini, then OpenAI, then Ollama if earlier providers are unavailable. If you select a specific provider, only that provider is used.
              </p>
            </div>

            <button 
              type="button"
              onClick={handleFetch}
              disabled={fetching || !canFetch}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {fetching ? "Analyzing company…" : "Fetch info"}
            </button>

            {message && (
              <p className={`text-sm ${message.startsWith("Error") ? "text-red-400" : "text-emerald-400"}`}>
                {message}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <Flame className="h-4 w-4 text-orange-400" />
            How it works
          </h2>
          <ol className="space-y-3 text-sm text-slate-400">
            <li>1. Add a website URL and/or upload company documents.</li>
            <li>2. You can upload multiple files (brochures, PDFs, documents).</li>
            <li>3. AI analyzes all sources and builds a marketing intelligence brief.</li>
            <li>4. A sidebar button is created with the company name.</li>
            <li>5. Use Create post → batch generate text posts with that context.</li>
          </ol>
        </section>  
      </div>

      {intel && (
        <div className="mt-8">
          <CompanyIntelDisplay
            intel={intel}
            companyProfileId={profileId ?? undefined}
            fallbackName="Company"
          />
        </div>
      )}
    </>
  );
}
