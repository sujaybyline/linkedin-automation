import { useEffect, useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Key,
  Save,
  CheckCircle2,
  AlertCircle,
  Bot,
} from "lucide-react";
import { PageHeader, Badge } from "../components/ui";
import { apiGet, apiPut } from "../services/api";

type ProviderType = "gemini" | "openai" | "ollama" | "anthropic" | "groq";

interface ProviderModel {
  value: string;
  label: string;
}

interface ProviderCatalogEntry {
  label: string;
  description: string;
  models: ProviderModel[];
  defaultModel: string;
}

interface ExtraProvider {
  id: string;
  name: string;
  type: ProviderType;
  model: string;
  enabled: boolean;
  api_key_masked: string;
  api_key_set: boolean;
}

interface ExtraProviderDraft extends ExtraProvider {
  api_key: string;
  api_key_touched: boolean;
}

interface AiConfig {
  ai_enabled: boolean;
  gemini_api_key_masked: string;
  gemini_api_key_set: boolean;
  gemini_api_key_from_db: boolean;
  gemini_model: string;
  openai_api_key_masked: string;
  openai_api_key_set: boolean;
  openai_api_key_from_db: boolean;
  openai_model: string;
  ollama_base_url: string;
  ollama_api_key_masked: string;
  ollama_api_key_set: boolean;
  ollama_api_key_from_db: boolean;
  ollama_model: string;
  ollama_base_url_set: boolean;
  ollama_base_url_from_db: boolean;
  
  // Ollama Hosted specific configs
  ollama_hosted_model: string;
  ollama_hosted_embedding_model: string;
  ollama_hosted_embedding_dim: string;
  ollama_hosted_question_model: string;
  ollama_hosted_analysis_model: string;
  ollama_hosted_num_gpu: string;
  ollama_hosted_num_ctx: string;
  ollama_hosted_chat_timeout_ms: string;
  ollama_hosted_rag_top_k: string;
  ollama_hosted_model_from_db: boolean;
  ollama_hosted_embedding_model_from_db: boolean;
  ollama_hosted_embedding_dim_from_db: boolean;
  ollama_hosted_question_model_from_db: boolean;
  ollama_hosted_analysis_model_from_db: boolean;
  ollama_hosted_num_gpu_from_db: boolean;
  ollama_hosted_num_ctx_from_db: boolean;
  ollama_hosted_chat_timeout_from_db: boolean;
  ollama_hosted_rag_top_k_from_db: boolean;
  
  ai_provider: string;
  env_fallback_gemini: boolean;
  env_fallback_openai: boolean;
  env_fallback_ollama: boolean;
  env_fallback_ollama_api_key: boolean;
  env_fallback_ollama_hosted: boolean;
  extra_providers: ExtraProvider[];
  active_provider_count: number;
  provider_catalog: Record<ProviderType, ProviderCatalogEntry>;
}

const PROVIDER_COLORS: Record<ProviderType, string> = {
  gemini: "border-blue-500/40 bg-blue-950/20",
  openai: "border-emerald-500/40 bg-emerald-950/20",
  ollama: "border-cyan-500/40 bg-cyan-950/20",
  anthropic: "border-amber-500/40 bg-amber-950/20",
  groq: "border-violet-500/40 bg-violet-950/20",
};

const EXTRA_TYPES: ProviderType[] = ["anthropic", "groq", "gemini", "openai", "ollama"];

function newExtraId() {
  return `extra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function inputClass() {
  return "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50";
}

function selectClass() {
  return inputClass();
}

function KeyStatus({
  masked,
  set,
  fromDb,
  envFallback,
}: {
  masked: string;
  set: boolean;
  fromDb: boolean;
  envFallback: boolean;
}) {
  if (!set) {
    return <span className="text-xs text-slate-500">No key configured</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-slate-400">{masked}</span>
      {fromDb ? (
        <Badge variant="success">Database</Badge>
      ) : envFallback ? (
        <Badge variant="warning">.env fallback</Badge>
      ) : (
        <Badge>Configured</Badge>
      )}
    </div>
  );
}

function ProviderCard({
  title,
  accent,
  description,
  children,
}: {
  title: string;
  accent: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-5 ${accent}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function parseOllamaUrls(raw: string) {
  return String(raw || "")
    .split(/[\n,;]+/)
    .map((url) => url.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function isLocalOllamaUrl(url: string) {
  const lower = String(url || "").toLowerCase();
  return (
    lower.startsWith("http://127.0.0.1") ||
    lower.startsWith("http://localhost") ||
    lower.startsWith("http://[::1]") ||
    lower.startsWith("https://127.0.0.1") ||
    lower.startsWith("https://localhost") ||
    lower.startsWith("https://[::1]")
  );
}

export function AiConfigPage() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [ollamaLocalBaseUrl, setOllamaLocalBaseUrl] = useState("");
  const [ollamaHostedBaseUrl, setOllamaHostedBaseUrl] = useState("");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash-lite");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [ollamaModel, setOllamaModel] = useState("llama3.1:8b");
  const [aiProvider, setAiProvider] = useState("auto");
  
  // Ollama Hosted specific states
  const [ollamaHostedModel, setOllamaHostedModel] = useState("qwen2.5:14b-instruct");
  const [ollamaHostedEmbeddingModel, setOllamaHostedEmbeddingModel] = useState("nomic-embed-text");
  const [ollamaHostedEmbeddingDim, setOllamaHostedEmbeddingDim] = useState("768");
  const [ollamaHostedQuestionModel, setOllamaHostedQuestionModel] = useState("qwen2.5:14b-instruct");
  const [ollamaHostedAnalysisModel, setOllamaHostedAnalysisModel] = useState("qwen2.5:14b-instruct");
  const [ollamaHostedNumGpu, setOllamaHostedNumGpu] = useState("0");
  const [ollamaHostedNumCtx, setOllamaHostedNumCtx] = useState("8192");
  const [ollamaHostedChatTimeout, setOllamaHostedChatTimeout] = useState("900000");
  const [ollamaHostedRagTopK, setOllamaHostedRagTopK] = useState("5");
  const [ollamaHostedModelTouched, setOllamaHostedModelTouched] = useState(false);
  const [ollamaHostedEmbeddingModelTouched, setOllamaHostedEmbeddingModelTouched] = useState(false);
  const [ollamaHostedEmbeddingDimTouched, setOllamaHostedEmbeddingDimTouched] = useState(false);
  const [ollamaHostedQuestionModelTouched, setOllamaHostedQuestionModelTouched] = useState(false);
  const [ollamaHostedAnalysisModelTouched, setOllamaHostedAnalysisModelTouched] = useState(false);
  const [ollamaHostedNumGpuTouched, setOllamaHostedNumGpuTouched] = useState(false);
  const [ollamaHostedNumCtxTouched, setOllamaHostedNumCtxTouched] = useState(false);
  const [ollamaHostedChatTimeoutTouched, setOllamaHostedChatTimeoutTouched] = useState(false);
  const [ollamaHostedRagTopKTouched, setOllamaHostedRagTopKTouched] = useState(false);
  
  const [geminiKeyTouched, setGeminiKeyTouched] = useState(false);
  const [openaiKeyTouched, setOpenaiKeyTouched] = useState(false);
  const [ollamaLocalBaseUrlTouched, setOllamaLocalBaseUrlTouched] = useState(false);
  const [ollamaHostedBaseUrlTouched, setOllamaHostedBaseUrlTouched] = useState(false);
  const [extras, setExtras] = useState<ExtraProviderDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function applyConfig(data: AiConfig) {
    setConfig(data);
    setAiEnabled(data.ai_enabled);
    setGeminiModel(data.gemini_model);
    setOpenaiModel(data.openai_model);
    const parsedOllamaUrls = parseOllamaUrls(data.ollama_base_url || "");
    setOllamaLocalBaseUrl(parsedOllamaUrls.filter(isLocalOllamaUrl).join(", "));
    setOllamaHostedBaseUrl(parsedOllamaUrls.filter((url) => !isLocalOllamaUrl(url)).join(", "));
    setOllamaModel(data.ollama_model || "llama3.1:8b");
    setAiProvider(data.ai_provider);
    
    // Apply Ollama Hosted configs
    setOllamaHostedModel(data.ollama_hosted_model || "qwen2.5:14b-instruct");
    setOllamaHostedEmbeddingModel(data.ollama_hosted_embedding_model || "nomic-embed-text");
    setOllamaHostedEmbeddingDim(data.ollama_hosted_embedding_dim || "768");
    setOllamaHostedQuestionModel(data.ollama_hosted_question_model || "qwen2.5:14b-instruct");
    setOllamaHostedAnalysisModel(data.ollama_hosted_analysis_model || "qwen2.5:14b-instruct");
    setOllamaHostedNumGpu(data.ollama_hosted_num_gpu || "0");
    setOllamaHostedNumCtx(data.ollama_hosted_num_ctx || "8192");
    setOllamaHostedChatTimeout(data.ollama_hosted_chat_timeout_ms || "900000");
    setOllamaHostedRagTopK(data.ollama_hosted_rag_top_k || "5");
    
    setExtras(
      (data.extra_providers || []).map((p) => ({
        ...p,
        api_key: "",
        api_key_touched: false,
      }))
    );
  }

  useEffect(() => {
    setLoading(true);
    apiGet<AiConfig>("settings/ai")
      .then(applyConfig)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load AI config"))
      .finally(() => setLoading(false));
  }, []);

  function addExtraProvider() {
    const catalog = config?.provider_catalog;
    const type: ProviderType = "anthropic";
    setExtras((prev) => [
      ...prev,
      {
        id: newExtraId(),
        name: "Backup AI",
        type,
        model: catalog?.[type]?.defaultModel || "claude-3-5-haiku-latest",
        enabled: true,
        api_key_masked: "",
        api_key_set: false,
        api_key: "",
        api_key_touched: false,
      },
    ]);
  }

  function updateExtra(id: string, patch: Partial<ExtraProviderDraft>) {
    setExtras((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        if (patch.type && config?.provider_catalog) {
          const cat = config.provider_catalog[patch.type];
          if (cat && !cat.models.some((m) => m.value === next.model)) {
            next.model = cat.defaultModel;
          }
        }
        return next;
      })
    );
  }

  function removeExtra(id: string) {
    setExtras((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    const body: Record<string, unknown> = {
      ai_enabled: aiEnabled,
      gemini_model: geminiModel,
      openai_model: openaiModel,
      ollama_model: ollamaModel,
      ai_provider: aiProvider,
      extra_providers: extras.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        model: p.model,
        enabled: p.enabled,
        ...(p.api_key_touched ? { api_key: p.api_key } : {}),
      })),
    };

    if (geminiKeyTouched) body.gemini_api_key = geminiKey;
    if (openaiKeyTouched) body.openai_api_key = openaiKey;
    // Ollama hosted API key is .env only — never sent to the server
    if (ollamaLocalBaseUrlTouched || ollamaHostedBaseUrlTouched) {
      const urls = [ollamaLocalBaseUrl.trim(), ollamaHostedBaseUrl.trim()].filter(Boolean);
      body.ollama_base_url = urls.join(",");
    }
    
    // Ollama Hosted configs
    if (ollamaHostedModelTouched) body.ollama_hosted_model = ollamaHostedModel;
    if (ollamaHostedEmbeddingModelTouched) body.ollama_hosted_embedding_model = ollamaHostedEmbeddingModel;
    if (ollamaHostedEmbeddingDimTouched) body.ollama_hosted_embedding_dim = ollamaHostedEmbeddingDim;
    if (ollamaHostedQuestionModelTouched) body.ollama_hosted_question_model = ollamaHostedQuestionModel;
    if (ollamaHostedAnalysisModelTouched) body.ollama_hosted_analysis_model = ollamaHostedAnalysisModel;
    if (ollamaHostedNumGpuTouched) body.ollama_hosted_num_gpu = ollamaHostedNumGpu;
    if (ollamaHostedNumCtxTouched) body.ollama_hosted_num_ctx = ollamaHostedNumCtx;
    if (ollamaHostedChatTimeoutTouched) body.ollama_hosted_chat_timeout_ms = ollamaHostedChatTimeout;
    if (ollamaHostedRagTopKTouched) body.ollama_hosted_rag_top_k = ollamaHostedRagTopK;

    try {
      const updated = await apiPut<AiConfig>("settings/ai", body);
      applyConfig(updated);
      setGeminiKey("");
      setOpenaiKey("");
      setGeminiKeyTouched(false);
      setOpenaiKeyTouched(false);
      setOllamaLocalBaseUrlTouched(false);
      setOllamaHostedBaseUrlTouched(false);
      setOllamaHostedModelTouched(false);
      setOllamaHostedEmbeddingModelTouched(false);
      setOllamaHostedEmbeddingDimTouched(false);
      setOllamaHostedQuestionModelTouched(false);
      setOllamaHostedAnalysisModelTouched(false);
      setOllamaHostedNumGpuTouched(false);
      setOllamaHostedNumCtxTouched(false);
      setOllamaHostedChatTimeoutTouched(false);
      setOllamaHostedRagTopKTouched(false);
      setMessage("Settings saved — new keys apply instantly, no redeploy needed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const catalog = config?.provider_catalog;
  const geminiModels = catalog?.gemini?.models ?? [];
  const openaiModels = catalog?.openai?.models ?? [];
  const ollamaModels = catalog?.ollama?.models ?? [];

  if (loading) {
    return (
      <div className="text-slate-400">
        <PageHeader title="AI Configuration" description="Manage API keys and models." />
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 animate-pulse" />
          Loading configuration…
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="AI Configuration"
          description="Swap API keys when quota runs out — changes save to the database instantly."
        />
        <div className="flex shrink-0 flex-wrap gap-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-center">
            <p className="text-xs text-slate-500">Active providers</p>
            <p className="text-lg font-bold text-white">{config?.active_provider_count ?? 0}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-center">
            <p className="text-xs text-slate-500">AI status</p>
            <p className={`text-sm font-semibold ${aiEnabled ? "text-emerald-400" : "text-red-400"}`}>
              {aiEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>
      </div>

      {message && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 pb-24">
        <section className="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-violet-600/20 p-2">
                <Bot className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">Enable AI Assistant</h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Controls Fetch info, captions, and batch post generation.
                </p>
              </div>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
                className="peer sr-only"
              />
              <div className="h-7 w-12 rounded-full bg-slate-700 peer-checked:bg-emerald-600 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-5" />
            </label>
          </div>

          <div className="mt-5 border-t border-slate-800 pt-5">
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Default provider order</label>
            <select value={aiProvider} onChange={(e) => setAiProvider(e.target.value)} className={selectClass()}>
              <option value="auto">Auto — try all configured providers in order</option>
              <option value="gemini">Gemini only</option>
              <option value="openai">OpenAI only</option>
              <option value="ollama-local">Ollama (Local) only</option>
              <option value="ollama-hosted">Ollama (Hosted) only</option>
              <option value="ollama">Any configured Ollama</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Auto uses Gemini → OpenAI → Ollama. Choosing a specific provider forces that provider only.
            </p>
          </div>
        </section>

        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Primary providers
          </h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProviderCard
              title="Google Gemini"
              accent={PROVIDER_COLORS.gemini}
              description="Main provider — Google AI Studio"
            >
              <KeyStatus
                masked={config?.gemini_api_key_masked || ""}
                set={Boolean(config?.gemini_api_key_set)}
                fromDb={Boolean(config?.gemini_api_key_from_db)}
                envFallback={Boolean(config?.env_fallback_gemini)}
              />
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Key className="h-3 w-3" /> API key
                  </label>
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => {
                      setGeminiKey(e.target.value);
                      setGeminiKeyTouched(true);
                    }}
                    placeholder={
                      config?.gemini_api_key_set ? "Paste new key to replace" : "Paste Gemini API key"
                    }
                    className={inputClass()}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Model</label>
                  <select value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} className={selectClass()}>
                    {geminiModels.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </ProviderCard>

            <ProviderCard
              title="OpenAI"
              accent={PROVIDER_COLORS.openai}
              description="Fallback when Gemini quota is exceeded"
            >
              <KeyStatus
                masked={config?.openai_api_key_masked || ""}
                set={Boolean(config?.openai_api_key_set)}
                fromDb={Boolean(config?.openai_api_key_from_db)}
                envFallback={Boolean(config?.env_fallback_openai)}
              />
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <Key className="h-3 w-3" /> API key
                  </label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => {
                      setOpenaiKey(e.target.value);
                      setOpenaiKeyTouched(true);
                    }}
                    placeholder={
                      config?.openai_api_key_set ? "Paste new key to replace" : "Paste OpenAI API key"
                    }
                    className={inputClass()}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Model</label>
                  <select value={openaiModel} onChange={(e) => setOpenaiModel(e.target.value)} className={selectClass()}>
                    {openaiModels.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </ProviderCard>

            <ProviderCard
              title="Ollama (Local)"
              accent={PROVIDER_COLORS.ollama}
              description="Use your self-hosted model on the same machine or network"
            >
              <KeyStatus
                masked={ollamaLocalBaseUrl || "Not configured"}
                set={Boolean(ollamaLocalBaseUrl)}
                fromDb={Boolean(config?.ollama_base_url_from_db)}
                envFallback={Boolean(config?.env_fallback_ollama)}
              />
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Local URL</label>
                  <input
                    type="text"
                    value={ollamaLocalBaseUrl}
                    onChange={(e) => {
                      setOllamaLocalBaseUrl(e.target.value);
                      setOllamaLocalBaseUrlTouched(true);
                    }}
                    placeholder="http://127.0.0.1:11434"
                    className={inputClass()}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Use this for a local Ollama instance on the same machine or network.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Model</label>
                  <select value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)} className={selectClass()}>
                    {ollamaModels.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </ProviderCard>

            <ProviderCard
              title="Ollama (Hosted)"
              accent={PROVIDER_COLORS.ollama}
              description="Use a publicly accessible or hosted Ollama endpoint with Bearer token authentication"
            >
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-slate-700/80 bg-slate-950/50 px-3 py-2.5">
                  <p className="text-xs font-medium text-slate-300">API key (.env only)</p>
                  <p className="mt-1 font-mono text-xs text-slate-400">
                    {config?.ollama_api_key_set
                      ? config.ollama_api_key_masked
                      : "Not configured — set OLLAMA_API_KEY in backend/.env"}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    Hosted Ollama keys are not stored in the database. Edit{" "}
                    <code className="text-slate-400">backend/.env</code> and restart the backend.
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">Hosted URL</label>
                  <input
                    type="text"
                    value={ollamaHostedBaseUrl}
                    onChange={(e) => {
                      setOllamaHostedBaseUrl(e.target.value);
                      setOllamaHostedBaseUrlTouched(true);
                    }}
                    placeholder="https://ai.panworld-portal.cloud/api/ai"
                    className={inputClass()}
                    autoComplete="off"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Base URL without /chat endpoint (e.g., https://your-host.com/api/ai)
                  </p>
                </div>
              </div>
            </ProviderCard>
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Additional AI providers
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Add backup keys — used automatically when primary providers fail or hit quota.
              </p>
            </div>
            <button
              type="button"
              onClick={addExtraProvider}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-white hover:bg-slate-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Add AI
            </button>
          </div>

          {extras.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">No extra providers yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Add Claude, Groq, or a second Gemini/OpenAI key as backup.
              </p>
              <button
                type="button"
                onClick={addExtraProvider}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
              >
                <Plus className="h-4 w-4" />
                Add your first backup AI
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {extras.map((extra) => {
                const typeCat = catalog?.[extra.type];
                const models = typeCat?.models ?? [];
                return (
                  <div
                    key={extra.id}
                    className={`rounded-xl border p-4 ${PROVIDER_COLORS[extra.type] || "border-slate-700 bg-slate-900"}`}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <input
                        type="text"
                        value={extra.name}
                        onChange={(e) => updateExtra(extra.id, { name: e.target.value })}
                        className="max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-sm font-medium text-white"
                        placeholder="Provider label"
                      />
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-slate-400">
                          <input
                            type="checkbox"
                            checked={extra.enabled}
                            onChange={(e) => updateExtra(extra.id, { enabled: e.target.checked })}
                            className="rounded border-slate-600"
                          />
                          Enabled
                        </label>
                        <button
                          type="button"
                          onClick={() => removeExtra(extra.id)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-red-950 hover:text-red-400"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-400">Provider type</label>
                        <select
                          value={extra.type}
                          onChange={(e) => updateExtra(extra.id, { type: e.target.value as ProviderType })}
                          className={selectClass()}
                        >
                          {EXTRA_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {catalog?.[t]?.label || t}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-400">Model</label>
                        <select
                          value={extra.model}
                          onChange={(e) => updateExtra(extra.id, { model: e.target.value })}
                          className={selectClass()}
                        >
                          {models.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        {extra.api_key_set && (
                          <p className="mb-1.5 font-mono text-xs text-slate-500">{extra.api_key_masked}</p>
                        )}
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <Key className="h-3 w-3" /> API key
                        </label>
                        <input
                          type="password"
                          value={extra.api_key}
                          onChange={(e) =>
                            updateExtra(extra.id, { api_key: e.target.value, api_key_touched: true })
                          }
                          placeholder={extra.api_key_set ? "Paste new key to replace" : "Paste API key"}
                          className={inputClass()}
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur sm:left-56">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <p className="hidden text-xs text-slate-500 sm:block">
              Keys are stored securely in the database — not in .env
            </p>
            <button
              type="submit"
              disabled={saving}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
