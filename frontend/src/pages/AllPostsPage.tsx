import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { PageHeader, Badge } from "../components/ui";
import { CardDeleteModal, CardEditModal, CardViewModal } from "../components/CardModals";
import { api, apiDelete, apiGet } from "../services/api";

interface PostRow {
  post_id: string;
  filename: string;
  topic: string;
  card_status: string;
  approval_status?: string;
  campaign?: string;
}

function PostThumb({ postId, filename }: { postId: string; filename?: string }) {
  const isText = filename === "text-post";
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(isText);

  useEffect(() => {
    if (isText) return;
    let objectUrl: string | null = null;
    api
      .get(`cards/${postId}/image`, { responseType: "blob" })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setSrc(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [postId, isText]);

  const boxClass =
    "flex h-12 w-12 items-center justify-center rounded border border-slate-700 bg-slate-950 text-[10px] text-slate-500";

  if (isText || failed) {
    return (
      <div className={`${boxClass} text-violet-400`}>{isText ? "Text" : "—"}</div>
    );
  }
  if (!src) return <div className={boxClass}>…</div>;

  return (
    <img
      src={src}
      alt=""
      className="h-12 w-12 rounded border border-slate-700 object-cover"
    />
  );
}

function postTypeLabel(campaign?: string) {
  if (campaign?.startsWith("Text —")) return "Text (AI)";
  if (campaign === "AI Generated") return "AI generated";
  if (campaign === "Manual Post") return "Manual";
  return campaign || "—";
}

export function AllPostsPage() {
  const location = useLocation();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [editPostId, setEditPostId] = useState<string | null>(null);
  const [viewPostId, setViewPostId] = useState<string | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  function load() {
    apiGet<PostRow[]>(`cards?_=${Date.now()}`).then(setPosts).catch(() => setPosts([]));
  }

  useEffect(() => {
    load();
  }, [location.key]);

  const selectedCount = selected.size;
  const allSelected = posts.length > 0 && selectedCount === posts.length;

  function toggleOne(postId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(posts.map((p) => p.post_id)));
    }
  }

  async function confirmBulkDelete() {
    const ids = [...selected];
    setBulkDeleting(true);
    setMessage("");
    try {
      const results = await Promise.allSettled(ids.map((id) => apiDelete(`cards/${id}`)));
      const failed = results.filter((r) => r.status === "rejected").length;
      const deleted = ids.length - failed;
      setSelected(new Set());
      setShowBulkConfirm(false);
      load();
      if (failed > 0) {
        setMessage(`Deleted ${deleted} post(s). ${failed} could not be deleted.`);
      } else {
        setMessage(`Deleted ${deleted} post(s).`);
      }
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Bulk delete failed"}`);
    } finally {
      setBulkDeleting(false);
    }
  }

  function statusBadge(post: PostRow) {
    if (post.approval_status === "rejected" || post.card_status === "rejected") {
      return <Badge variant="danger">rejected</Badge>;
    }
    if (post.approval_status === "approved") {
      return <Badge variant="success">approved</Badge>;
    }
    if (post.approval_status === "pending_review") {
      return <Badge variant="warning">pending review</Badge>;
    }
    return <Badge>{post.card_status}</Badge>;
  }

  return (
    <>
      <PageHeader
        title="All posts"
        description="View and manage every post in your library."
      />

      {viewPostId && (
        <CardViewModal
          postId={viewPostId}
          onClose={() => setViewPostId(null)}
          onEdit={() => {
            const id = viewPostId;
            setViewPostId(null);
            setEditPostId(id);
          }}
        />
      )}

      {editPostId && (
        <CardEditModal
          postId={editPostId}
          onClose={() => setEditPostId(null)}
          onSaved={(msg) => {
            setMessage(msg);
            load();
          }}
        />
      )}

      {deletePostId && (
        <CardDeleteModal
          postId={deletePostId}
          onClose={() => setDeletePostId(null)}
          onDeleted={(msg) => {
            setMessage(msg);
            setSelected((prev) => {
              const next = new Set(prev);
              next.delete(deletePostId);
              return next;
            });
            load();
          }}
        />
      )}

      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Delete {selectedCount} posts?</h2>
            <p className="mt-2 text-sm text-slate-400">
              This permanently removes the selected posts, captions, and image files. This cannot be
              undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                disabled={bulkDeleting}
                className="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={confirmBulkDelete}
                className="rounded bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-600 disabled:opacity-50"
              >
                {bulkDeleting ? "Deleting…" : `Delete ${selectedCount} posts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCount >= 2 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3">
          <p className="text-sm text-slate-300">
            <span className="font-medium text-white">{selectedCount}</span> posts selected
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete selected
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          className={`mb-4 text-sm ${
            message.startsWith("Error") || message.includes("could not")
              ? "text-red-400"
              : "text-emerald-400"
          }`}
        >
          {message}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={!posts.length}
                  aria-label="Select all posts"
                  className="rounded border-slate-600 bg-slate-950 text-violet-600 focus:ring-violet-500/40"
                />
              </th>
              <th className="px-4 py-3">Post ID</th>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((p) => (
              <tr
                key={p.post_id}
                onClick={() => setViewPostId(p.post_id)}
                className={`cursor-pointer border-b border-slate-800/50 transition hover:bg-slate-800/30 ${
                  selected.has(p.post_id) ? "bg-violet-950/20" : ""
                }`}
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.post_id)}
                    onChange={() => toggleOne(p.post_id)}
                    aria-label={`Select ${p.post_id}`}
                    className="rounded border-slate-600 bg-slate-950 text-violet-600 focus:ring-violet-500/40"
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.post_id}</td>
                <td className="px-4 py-3">
                  <PostThumb postId={p.post_id} filename={p.filename} />
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="font-medium text-slate-200">{p.topic || p.filename || "—"}</p>
                  {p.topic && p.filename && p.topic !== p.filename && (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{p.filename}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge>{postTypeLabel(p.campaign)}</Badge>
                </td>
                <td className="px-4 py-3">{statusBadge(p)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditPostId(p.post_id)}
                      className="text-slate-300 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePostId(p.post_id)}
                      className="text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!posts.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No posts yet. Create one from the Create post page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
