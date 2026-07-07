import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  ImagePlus,
  PenLine,
  Sparkles,
  Upload,
  Wand2,
  Type,
  Loader2,
} from "lucide-react";
import { PageHeader, Badge } from "../components/ui";
import { api, apiPost } from "../services/api";
import { useCompanyProfiles } from "../context/CompanyProfilesContext";
import { Building2, Layers } from "lucide-react";

type PostMode = "manual" | "ai";
type AiFlow = "have_image" | "text_to_image";
type AiProvider = "gemini" | "openai" | "ollama" | "ollama-local" | "ollama-hosted" | "auto";

interface CaptionResult {
  finalPostText: string;
  suggestedHashtags: string;
  suggestedCta: string;
  source?: string;
  model?: string;
  aiWarning?: string;
}

function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40";

const labelClass = "mb-1.5 block text-xs font-medium text-slate-400";

/** Set true later to bring back manual + AI single-post flows */
const SHOW_LEGACY_POST_FORM = false;

export function PostsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const fetchInfoState = location.state as
    | { topic?: string; aiPrompt?: string; mode?: PostMode; companyProfileId?: number }
    | null
    | undefined;

  const { profiles } = useCompanyProfiles();

  const [mode, setMode] = useState<PostMode>("manual");
  const [companyProfileId, setCompanyProfileId] = useState<string>("");
  const [batchCount, setBatchCount] = useState<number | ''>(5);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchResults, setBatchResults] = useState<
    { postId: string; topic: string; finalPostText: string }[]
  >([]);

  const [aiFlow, setAiFlow] = useState<AiFlow>("have_image");
  const [availableProviders, setAvailableProviders] = useState<AiProvider[]>(["gemini", "openai", "ollama-hosted", "ollama-local"]);

  const [uploading, setUploading] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);

  const [topic, setTopic] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cta, setCta] = useState("");
  const [captionSource, setCaptionSource] = useState<string | null>(null);

  const [manualPreview, setManualPreview] = useState<string | null>(null);
  const [aiImageFile, setAiImageFile] = useState<File | null>(null);
  const [aiImagePreview, setAiImagePreview] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<{ base64: string; mimeType: string } | null>(
    null
  );

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("gemini");
  const [message, setMessage] = useState("");

  const manualFileRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!fetchInfoState?.topic && !fetchInfoState?.companyProfileId) return;
    if (fetchInfoState.companyProfileId) {
      setCompanyProfileId(String(fetchInfoState.companyProfileId));
    }
    if (fetchInfoState.topic) {
      const t = fetchInfoState.topic.trim();
      setTopic(t);
      setAiTopic(t);
    }
    if (fetchInfoState.aiPrompt?.trim()) setAiPrompt(fetchInfoState.aiPrompt.trim());
    if (fetchInfoState.mode === "ai") setMode("ai");
    setMessage("Loaded from company profile — review or batch-generate text posts.");
  }, [fetchInfoState]);

  useEffect(() => {
    api.get("ai/providers")
      .then((res) => {
        const data = res.data;
        if (data?.providers?.length) {
          setAvailableProviders(data.providers.map((p: { id: AiProvider }) => p.id));
        }
        if (data?.defaultProvider) {
          setAiProvider(data.defaultProvider);
        }
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  useEffect(() => {
    return () => {
      if (manualPreview) URL.revokeObjectURL(manualPreview);
      if (aiImagePreview && aiImagePreview.startsWith("blob:")) URL.revokeObjectURL(aiImagePreview);
    };
  }, [manualPreview, aiImagePreview]);

  function clearCaptionFields() {
    setCaption("");
    setHashtags("");
    setCta("");
    setCaptionSource(null);
  }

  function applyCaptionResult(result: CaptionResult) {
    setCaption(result.finalPostText || "");
    setHashtags(result.suggestedHashtags || "");
    setCta(result.suggestedCta || "");
    if (result.source === "gemini") setCaptionSource("AI (Gemini)");
    else if (result.source === "openai") setCaptionSource("AI (OpenAI)");
    else if (result.source === "ollama") setCaptionSource("AI (Ollama)");
    else setCaptionSource("Template (AI unavailable)");
    if (result.aiWarning) setMessage(result.aiWarning);
    else if (result.source !== "rules") setMessage("Caption generated — review and edit before saving.");
  }

  async function requestAiCaption(
    file: File | null,
    captionTopic: string,
    prompt: string,
    provider: AiProvider
  ) {
    const fd = new FormData();
    if (file) fd.append("file", file);
    if (captionTopic.trim()) fd.append("topic", captionTopic.trim());
    if (prompt.trim()) fd.append("prompt", prompt.trim());
    fd.append("provider", provider);
    if (companyProfileId) fd.append("company_profile_id", companyProfileId);
    return apiPost<CaptionResult>("ai/caption", fd);
  }

  async function handleGenerateCaption() {
    const file =
      aiFlow === "have_image"
        ? aiImageFile
        : generatedImage
          ? base64ToFile(
              generatedImage.base64,
              generatedImage.mimeType,
              `ai-generated.${extFromMime(generatedImage.mimeType)}`
            )
          : null;

    if (!file && !aiPrompt.trim() && !aiTopic.trim()) {
      setMessage("Add an image or describe your post idea first.");
      return;
    }

    setGeneratingCaption(true);
    setMessage("");
    try {
      const result = await requestAiCaption(file, aiTopic || topic, aiPrompt, aiProvider);
      applyCaptionResult(result);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Caption generation failed"}`);
    } finally {
      setGeneratingCaption(false);
    }
  }

  async function handleGenerateImage() {
    if (!aiPrompt.trim()) {
      setMessage("Enter a description for the image you want.");
      return;
    }

    setGeneratingImage(true);
    setMessage("");
    try {
      const result = await apiPost<{ base64: string; mimeType: string; model?: string }>("ai/image", {
        prompt: aiPrompt.trim(),
        topic: aiTopic.trim(),
      });
      setGeneratedImage({ base64: result.base64, mimeType: result.mimeType });
      const url = `data:${result.mimeType};base64,${result.base64}`;
      setAiImagePreview(url);
      setMessage(
        result.model
          ? `Image generated (${result.model}). You can generate a caption next.`
          : "Image generated. You can generate a caption next."
      );
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Image generation failed"}`);
    } finally {
      setGeneratingImage(false);
    }
  }

  function handleManualFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (manualPreview) URL.revokeObjectURL(manualPreview);
    setManualPreview(file ? URL.createObjectURL(file) : null);
  }

  function handleAiFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAiImageFile(file);
    setGeneratedImage(null);
    if (aiImagePreview && aiImagePreview.startsWith("blob:")) URL.revokeObjectURL(aiImagePreview);
    setAiImagePreview(file ? URL.createObjectURL(file) : null);
    clearCaptionFields();
  }

  async function submitPost(
    file: File,
    fields: { topic: string; caption: string; hashtags: string; cta: string },
    postType: "manual" | "ai"
  ) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("post_type", postType);
    if (fields.topic) fd.append("topic", fields.topic);
    if (fields.caption) fd.append("final_post_text", fields.caption);
    if (fields.hashtags) fd.append("suggested_hashtags", fields.hashtags);
    if (fields.cta) fd.append("suggested_cta", fields.cta);

    const res = await api.post("cards", fd);
    if (res.data.error) throw new Error(res.data.error.message);
    return res.data.data.postId as string;
  }

  async function handleManualSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = manualFileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");
    try {
      const postId = await submitPost(
        file,
        { topic, caption, hashtags, cta },
        "manual"
      );
      setMessage(`Post created: ${postId}`);
      e.currentTarget.reset();
      if (manualPreview) URL.revokeObjectURL(manualPreview);
      setManualPreview(null);
      setTopic("");
      clearCaptionFields();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Upload failed"}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault();

    let file: File | null = aiImageFile;
    if (aiFlow === "text_to_image" && generatedImage) {
      file = base64ToFile(
        generatedImage.base64,
        generatedImage.mimeType,
        `ai-post.${extFromMime(generatedImage.mimeType)}`
      );
    }

    if (!file) {
      setMessage(
        aiFlow === "have_image"
          ? "Upload an image first."
          : "Generate an image from your text first."
      );
      return;
    }

    setUploading(true);
    setMessage("");
    try {
      const postId = await submitPost(
        file,
        { topic: aiTopic || topic, caption, hashtags, cta },
        "ai"
      );
      setMessage(`AI post created: ${postId}`);
      setAiPrompt("");
      setAiTopic("");
      clearCaptionFields();
      setAiImageFile(null);
      setGeneratedImage(null);
      if (aiImagePreview && aiImagePreview.startsWith("blob:")) URL.revokeObjectURL(aiImagePreview);
      setAiImagePreview(null);
      aiFileRef.current && (aiFileRef.current.value = "");
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Upload failed"}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleBatchGenerate() {
    if (!companyProfileId) {
      setMessage("Select a company profile first.");
      return;
    }
    const count = typeof batchCount === 'number' ? batchCount : 5;
    if (count < 1 || count > 30) {
      setMessage("Please enter a valid number between 1 and 30.");
      return;
    }
    setBatchGenerating(true);
    setMessage("");
    setBatchResults([]);
    try {
      const result = await apiPost<{
        companyName: string;
        count: number;
        posts: { postId: string; topic: string; finalPostText: string }[];
        source?: string;
        model?: string;
      }>("ai/batch-text-posts", {
        company_profile_id: Number(companyProfileId),
        count: count,
        provider: aiProvider,
      });
      setBatchResults(result.posts);
      setMessage(
        `Created ${result.count} text posts for ${result.companyName}. Opening All posts…`
      );
      setTimeout(() => navigate("/all-posts"), 800);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Batch generation failed"}`);
    } finally {
      setBatchGenerating(false);
    }
  }

  const selectedCompany = profiles.find((p) => String(p.id) === companyProfileId);

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition ${
      active
        ? "bg-slate-800 text-white shadow-sm"
        : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
    }`;

  const flowCardClass = (active: boolean) =>
    `flex cursor-pointer flex-col gap-2 rounded-lg border p-4 text-left transition ${
      active
        ? "border-violet-500/60 bg-violet-950/30 ring-1 ring-violet-500/30"
        : "border-slate-800 bg-slate-950 hover:border-slate-700"
    }`;

  const messageTone = message.startsWith("Error")
    ? "text-red-400"
    : message.includes("created")
      ? "text-emerald-400"
      : "text-amber-400";

  const activeImagePreview = mode === "manual" ? manualPreview : aiImagePreview;

  return (
    <>
      <PageHeader
        title="Create post"
        description="Generate multiple text-only LinkedIn posts from saved company intel."
      />

      <div className="max-w-3xl space-y-4">
        <section className="rounded-xl border border-violet-900/40 bg-violet-950/20 p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <Layers className="h-4 w-4 text-violet-400" />
            Batch text posts
          </h2>
          <p className="mb-4 text-xs text-slate-400">
            Select a company from Fetch info. AI generates text-only LinkedIn posts (no images) using
            that marketing brief.
          </p>
          {profiles.length === 0 ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-4 text-sm text-slate-400">
              No saved companies yet. Use{" "}
              <Link to="/fetch-info" className="text-violet-300 underline">
                Fetch info
              </Link>{" "}
              first to analyze a company and unlock batch generation.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Company context</label>
                  <select
                    className={inputClass}
                    value={companyProfileId}
                    onChange={(e) => setCompanyProfileId(e.target.value)}
                  >
                    <option value="">Select company…</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.companyName}
                      </option>
                    ))}
                  </select>
                  {selectedCompany && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <Building2 className="h-3 w-3" />
                      Using saved intel for {selectedCompany.companyName}
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>How many posts?</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    placeholder="5"
                    className={inputClass}
                    value={batchCount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || val === null) {
                        // Allow empty field temporarily so user can type
                        setBatchCount('' as any);
                      } else {
                        const num = parseInt(val, 10);
                        if (!isNaN(num)) {
                          setBatchCount(Math.max(1, Math.min(30, num)));
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // When user leaves the field, ensure it has a valid value
                      const val = e.target.value;
                      if (val === '' || val === null || isNaN(parseInt(val, 10))) {
                        setBatchCount(5); // Default to 5 if empty
                      }
                    }}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Min: 1, Max: 30</p>
                </div>
              </div>
              <div className="mt-3">
                <label className={labelClass}>AI provider</label>
                <select
                  className={inputClass}
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as AiProvider)}
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
                  Auto tries the first configured provider order. If you pick a specific provider, only that provider will be used.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBatchGenerate}
                disabled={batchGenerating || !companyProfileId}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 sm:w-auto"
              >
                {batchGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                {batchGenerating ? "Generating posts…" : `Generate ${typeof batchCount === 'number' ? batchCount : 5} text posts`}
              </button>
              {batchResults.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                  {batchResults.map((p) => (
                    <li
                      key={p.postId}
                      className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs"
                    >
                      <span className="font-medium text-violet-300">{p.postId}</span>
                      <span className="text-slate-500"> · </span>
                      <span className="text-slate-300">{p.topic}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {message && <p className={`text-sm ${messageTone}`}>{message}</p>}

        {SHOW_LEGACY_POST_FORM && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="mb-5 flex gap-2 rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              className={tabClass(mode === "manual")}
              onClick={() => setMode("manual")}
            >
              <PenLine className="h-4 w-4 shrink-0" />
              Create manual post
            </button>
            <button
              type="button"
              className={tabClass(mode === "ai")}
              onClick={() => setMode("ai")}
            >
              <Sparkles className="h-4 w-4 shrink-0" />
              AI assistant
            </button>
          </div>

          {mode === "manual" ? (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <p className="text-sm text-slate-400">
                Upload your image and write the caption yourself — full control, no AI.
              </p>

              <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <div>
                  <label className={labelClass}>Image</label>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950 px-4 py-8 text-center transition hover:border-slate-600">
                    <Upload className="mb-2 h-8 w-8 text-slate-500" />
                    <span className="text-sm text-slate-300">Click to upload</span>
                    <span className="mt-1 text-xs text-slate-500">PNG, JPEG, or WebP</span>
                    <input
                      ref={manualFileRef}
                      type="file"
                      name="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      required
                      onChange={handleManualFileChange}
                    />
                  </label>
                </div>
                {manualPreview && (
                  <div>
                    <label className={labelClass}>Preview</label>
                    <img
                      src={manualPreview}
                      alt="Preview"
                      className="h-[200px] w-full rounded-lg border border-slate-800 object-cover"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Topic (optional)</label>
                <input
                  type="text"
                  placeholder="Short topic or title"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Caption</label>
                <textarea
                  placeholder="Write your LinkedIn post caption…"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={5}
                  className={inputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Hashtags (optional)</label>
                  <input
                    type="text"
                    placeholder="#education #teachers"
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>CTA (optional)</label>
                  <input
                    type="text"
                    placeholder="Learn more at…"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploading ? "Creating…" : "Create manual post"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAiSubmit} className="space-y-5">
              <p className="text-sm text-slate-400">
                Choose how you want to start — upload an existing image or describe one for AI to
                create.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className={flowCardClass(aiFlow === "have_image")}
                  onClick={() => {
                    setAiFlow("have_image");
                    setGeneratedImage(null);
                    if (aiImagePreview && !aiImageFile) {
                      setAiImagePreview(null);
                    }
                    clearCaptionFields();
                  }}
                >
                  <div className="flex items-center gap-2 text-white">
                    <ImagePlus className="h-5 w-5 text-violet-400" />
                    <span className="font-medium">I have an image</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Upload your graphic and let AI write the caption.
                  </span>
                </button>
                <button
                  type="button"
                  className={flowCardClass(aiFlow === "text_to_image")}
                  onClick={() => {
                    setAiFlow("text_to_image");
                    setAiImageFile(null);
                    if (aiFileRef.current) aiFileRef.current.value = "";
                    if (aiImagePreview?.startsWith("blob:")) URL.revokeObjectURL(aiImagePreview);
                    setAiImagePreview(null);
                    clearCaptionFields();
                  }}
                >
                  <div className="flex items-center gap-2 text-white">
                    <Type className="h-5 w-5 text-violet-400" />
                    <span className="font-medium">Create from text</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    Describe your idea — AI generates the image and caption.
                  </span>
                </button>
              </div>

              {aiFlow === "have_image" ? (
                <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                  <div>
                    <label className={labelClass}>Upload image</label>
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-violet-800/50 bg-slate-950 px-4 py-8 text-center transition hover:border-violet-600/50">
                      <ImagePlus className="mb-2 h-8 w-8 text-violet-500/70" />
                      <span className="text-sm text-slate-300">Choose image file</span>
                      <input
                        ref={aiFileRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={handleAiFileChange}
                      />
                    </label>
                  </div>
                  {aiImagePreview && (
                    <div>
                      <label className={labelClass}>Preview</label>
                      <img
                        src={aiImagePreview}
                        alt="AI upload preview"
                        className="h-[200px] w-full rounded-lg border border-slate-800 object-cover"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div>
                    <label className={labelClass}>Image description</label>
                    <textarea
                      placeholder="e.g. A clean infographic about 5 tips for new teachers, blue and white education theme…"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={3}
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateImage}
                    disabled={generatingImage || !aiPrompt.trim()}
                    className="inline-flex items-center gap-2 rounded-lg border border-violet-700 bg-violet-950/50 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-900/50 disabled:opacity-50"
                  >
                    {generatingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    {generatingImage ? "Generating image…" : "Generate image"}
                  </button>
                  {generatedImage && aiImagePreview && (
                    <img
                      src={aiImagePreview}
                      alt="AI generated"
                      className="max-h-64 w-full rounded-lg border border-slate-800 object-contain"
                    />
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Topic (optional)</label>
                  <input
                    type="text"
                    placeholder="Short topic for the post"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    className={inputClass}
                  />
                </div>
                {aiFlow === "have_image" && (
                  <div>
                    <label className={labelClass}>Caption brief (optional)</label>
                    <input
                      type="text"
                      placeholder="Tone, angle, or key points for AI"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                {profiles.length > 0 && (
                  <div className="min-w-[180px] flex-1">
                    <label className={labelClass}>Company context (optional)</label>
                    <select
                      value={companyProfileId}
                      onChange={(e) => setCompanyProfileId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">None</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="min-w-[180px] flex-1">
                  <label className={labelClass}>AI for caption</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value as AiProvider)}
                    className={inputClass}
                  >
                    {availableProviders.includes("gemini") && (
                      <option value="gemini">Google Gemini</option>
                    )}
                    {availableProviders.includes("openai") && (
                      <option value="openai">OpenAI (GPT)</option>
                    )}
                    {availableProviders.includes("ollama-hosted") && (
                      <option value="ollama-hosted">Ollama (Hosted)</option>
                    )}
                    {availableProviders.includes("ollama-local") && (
                      <option value="ollama-local">Ollama (Local)</option>
                    )}
                    {availableProviders.includes("ollama") && (
                      <option value="ollama">Ollama</option>
                    )}
                    {availableProviders.length > 1 && (
                      <option value="auto">Auto (try all)</option>
                    )}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Image generation always uses Gemini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateCaption}
                  disabled={
                    generatingCaption ||
                    (aiFlow === "have_image" && !aiImageFile) ||
                    (aiFlow === "text_to_image" && !generatedImage && !aiPrompt.trim())
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {generatingCaption ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generatingCaption ? "Generating caption…" : "Generate caption"}
                </button>
                {captionSource && <Badge variant="success">{captionSource}</Badge>}
              </div>

              <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Review & edit
                </p>
                <div>
                  <label className={labelClass}>Caption</label>
                  <textarea
                    placeholder="Generate a caption or write your own…"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={5}
                    className={inputClass}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Hashtags</label>
                    <input
                      type="text"
                      placeholder="#education #teachers"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CTA</label>
                    <input
                      type="text"
                      placeholder="Learn more at…"
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {uploading ? "Saving post…" : "Save AI post"}
              </button>
            </form>
          )}

          {message && <p className={`mt-4 text-sm ${messageTone}`}>{message}</p>}
        </div>
        )}

        {SHOW_LEGACY_POST_FORM && activeImagePreview && mode === "ai" && (
          <p className="text-xs text-slate-500">
            Tip: You can edit the caption after generation, then save when ready.
          </p>
        )}
      </div>
    </>
  );
}
