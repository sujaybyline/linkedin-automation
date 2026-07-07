import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, apiGet, apiPatch, apiDelete } from "../services/api";
import { Badge } from "./ui";

interface PostDetail {
  post_id: string;
  approval_status: string;
  quality_status: string;
  campaign?: string;
  content_pillar?: string;
  audience?: string;
  visual_cards?: {
    topic: string;
    filename: string;
    card_status: string;
    content_pillar?: string;
    audience?: string;
  } | null;
  captions?: {
    final_post_text: string;
    suggested_hashtags: string;
    suggested_cta: string;
  } | null;
}

interface CardEditModalProps {
  postId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function CardEditModal({ postId, onClose, onSaved }: CardEditModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState("");
  const [cardStatus, setCardStatus] = useState("");
  const [topic, setTopic] = useState("");
  const [contentPillar, setContentPillar] = useState("");
  const [audience, setAudience] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [cta, setCta] = useState("");

  const canResubmit =
    ["rejected", "revision_needed", "legal_review"].includes(approvalStatus) ||
    cardStatus === "rejected";

  useEffect(() => {
    let objectUrl: string | null = null;
    setLoading(true);
    setError("");

    apiGet<PostDetail>(`cards/${postId}`)
      .then((data) => {
        setApprovalStatus(data.approval_status);
        setCardStatus(data.visual_cards?.card_status ?? "");
        setTopic(data.visual_cards?.topic ?? "");
        setContentPillar(data.visual_cards?.content_pillar ?? "");
        setAudience(data.visual_cards?.audience ?? "");
        setCaption(data.captions?.final_post_text ?? "");
        setHashtags(data.captions?.suggested_hashtags ?? "");
        setCta(data.captions?.suggested_cta ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));

    api
      .get(`cards/${postId}/image`, { responseType: "blob" })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setImageSrc(objectUrl);
      })
      .catch(() => setImageSrc(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [postId]);

  async function save(resubmit: boolean) {
    setSaving(true);
    setError("");
    try {
      await apiPatch(`cards/${postId}`, {
        topic,
        content_pillar: contentPillar,
        audience,
        final_post_text: caption,
        suggested_hashtags: hashtags,
        suggested_cta: cta,
        resubmit_for_approval: resubmit,
      });
      onSaved(
        resubmit
          ? `${postId} updated and sent back to Approvals`
          : `${postId} saved`
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-edit-title"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div>
            <h2 id="card-edit-title" className="text-sm font-semibold text-white">
              Edit card — {postId}
            </h2>
            <div className="mt-1 flex gap-2">
              <Badge variant={approvalStatus === "rejected" ? "danger" : "default"}>
                {approvalStatus || "draft"}
              </Badge>
              {cardStatus && <Badge>{cardStatus}</Badge>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {loading && <p className="text-sm text-slate-400">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && (
            <>
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Card preview"
                  className="max-h-48 w-full rounded border border-slate-700 object-contain bg-slate-950"
                />
              ) : (
                <div className="flex h-32 items-center justify-center rounded border border-dashed border-slate-700 text-xs text-slate-500">
                  No image preview
                </div>
              )}

              <label className="block text-xs text-slate-400">
                Topic
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-slate-400">
                  Content pillar
                  <input
                    value={contentPillar}
                    onChange={(e) => setContentPillar(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="block text-xs text-slate-400">
                  Audience
                  <input
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <label className="block text-xs text-slate-400">
                Caption
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={8}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="block text-xs text-slate-400">
                Hashtags
                <input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="block text-xs text-slate-400">
                CTA
                <input
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>

              {canResubmit && (
                <p className="rounded border border-amber-800 bg-amber-950/50 px-3 py-2 text-xs text-amber-200">
                  This post needs changes. Edit the caption, then use{" "}
                  <strong>Save & resubmit for approval</strong> to send it back to the Approvals queue.
                </p>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-800 bg-slate-900 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => save(false)}
            className="rounded bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
          >
            Save
          </button>
          {canResubmit && (
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => save(true)}
              className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              Save & resubmit for approval
            </button>
          )}
          {!canResubmit && approvalStatus !== "approved" && (
            <button
              type="button"
              disabled={saving || loading}
              onClick={() => save(true)}
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
            >
              Save & send to Approvals
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CardViewModalProps {
  postId: string;
  onClose: () => void;
  onEdit?: () => void;
}

export function CardViewModal({ postId, onClose, onEdit }: CardViewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [detail, setDetail] = useState<PostDetail | null>(null);

  const isTextPost = detail?.visual_cards?.filename === "text-post";

  useEffect(() => {
    let objectUrl: string | null = null;
    setLoading(true);
    setError("");

    apiGet<PostDetail>(`cards/${postId}`)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));

    api
      .get(`cards/${postId}/image`, { responseType: "blob" })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setImageSrc(objectUrl);
      })
      .catch(() => setImageSrc(null));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [postId]);

  const caption = detail?.captions?.final_post_text?.trim() || "";
  const hashtags = detail?.captions?.suggested_hashtags?.trim() || "";
  const cta = detail?.captions?.suggested_cta?.trim() || "";
  const topic = detail?.visual_cards?.topic || detail?.post_id || postId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-view-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
          <div>
            <h2 id="card-view-title" className="text-sm font-semibold text-white">
              {topic}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{postId}</p>
            {detail && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge
                  variant={
                    detail.approval_status === "approved"
                      ? "success"
                      : detail.approval_status === "rejected"
                        ? "danger"
                        : "warning"
                  }
                >
                  {detail.approval_status || "draft"}
                </Badge>
                {detail.campaign && <Badge>{detail.campaign}</Badge>}
                {detail.visual_cards?.card_status && (
                  <Badge>{detail.visual_cards.card_status}</Badge>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {loading && <p className="text-sm text-slate-400">Loading post…</p>}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {!loading && !error && detail && (
            <>
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt="Post preview"
                  className="max-h-80 w-full rounded-lg border border-slate-700 object-contain bg-slate-950"
                />
              ) : isTextPost ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-violet-800/50 bg-violet-950/20 text-sm text-violet-300">
                  Text-only post (no image)
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">
                  No image
                </div>
              )}

              {(detail.content_pillar || detail.audience) && (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  {detail.content_pillar && (
                    <div>
                      <p className="text-xs text-slate-500">Content pillar</p>
                      <p className="text-slate-200">{detail.content_pillar}</p>
                    </div>
                  )}
                  {detail.audience && (
                    <div>
                      <p className="text-xs text-slate-500">Audience</p>
                      <p className="text-slate-200">{detail.audience}</p>
                    </div>
                  )}
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Caption
                </p>
                <div className="whitespace-pre-wrap rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm leading-relaxed text-slate-200">
                  {caption || <span className="text-slate-500">No caption yet.</span>}
                </div>
              </div>

              {hashtags && (
                <div>
                  <p className="mb-1 text-xs text-slate-500">Hashtags</p>
                  <p className="text-sm text-blue-300">{hashtags}</p>
                </div>
              )}

              {cta && (
                <div>
                  <p className="mb-1 text-xs text-slate-500">CTA</p>
                  <p className="text-sm text-slate-300">{cta}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-800 bg-slate-900 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-600"
            >
              Edit post
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CardDeleteModalProps {
  postId: string;
  onClose: () => void;
  onDeleted: (message: string) => void;
}

export function CardDeleteModal({ postId, onClose, onDeleted }: CardDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setDeleting(true);
    setError("");
    try {
      await apiDelete(`cards/${postId}`);
      onDeleted(`${postId} deleted`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white">Delete card?</h2>
        <p className="mt-2 text-sm text-slate-400">
          Permanently delete <span className="font-mono text-slate-200">{postId}</span>, its caption, schedule, and
          image file. This cannot be undone.
        </p>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={confirmDelete}
            className="rounded bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
