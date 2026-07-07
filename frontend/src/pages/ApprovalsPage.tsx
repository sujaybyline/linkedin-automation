import { useEffect, useState } from "react";
import { PageHeader, Badge } from "../components/ui";
import { api, apiGet, apiPost } from "../services/api";

interface VisualCard {
  topic: string;
  filename: string;
}

interface ApprovalRow {
  post_id: string;
  approval_status: string;
  visual_cards?: VisualCard | null;
  captions?: { final_post_text: string } | null;
  claims_reviews?: { risk_level: string } | null;
}

function CardPreview({ postId, filename }: { postId: string; filename: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
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
  }, [postId]);

  if (failed) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950 text-xs text-slate-500">
        Image not available
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex h-48 w-full items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-xs text-slate-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950">
      <img src={src} alt={filename} className="max-h-64 w-full object-contain" />
      <p className="truncate px-2 py-1 text-xs text-slate-500">{filename}</p>
    </div>
  );
}

export function ApprovalsPage() {
  const [rows, setRows] = useState<ApprovalRow[]>([]);

  function load() {
    apiGet<ApprovalRow[]>("approvals").then(setRows).catch(() => setRows([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function act(postId: string, action: string) {
    await apiPost(`approvals/${postId}`, { action });
    load();
  }

  return (
    <>
      <PageHeader title="Post Approval Queue" description="Review card image and caption before approving." />
      <div className="space-y-4">
        {rows.map((row) => {
          const card = row.visual_cards;
          const caption = row.captions;
          const claim = row.claims_reviews;
          return (
            <div key={row.post_id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-400">{row.post_id}</span>
                <Badge>{row.approval_status}</Badge>
                {claim && (
                  <Badge variant={claim.risk_level === "high" ? "danger" : "warning"}>
                    Risk: {claim.risk_level}
                  </Badge>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-[240px_1fr]">
                <div>
                  {card?.filename ? (
                    <CardPreview postId={row.post_id} filename={card.filename} />
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-700 text-xs text-slate-500">
                      No image
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{card?.topic}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">
                    {caption?.final_post_text || "No caption yet — add one from the Posts page."}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => act(row.post_id, "approve")} className="rounded bg-emerald-700 px-3 py-1.5 text-xs text-white hover:bg-emerald-600">Approve</button>
                    <button type="button" onClick={() => act(row.post_id, "reject")} className="rounded bg-red-800 px-3 py-1.5 text-xs text-white hover:bg-red-700">Reject</button>
                    <button type="button" onClick={() => act(row.post_id, "revision")} className="rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Send back</button>
                    <button type="button" onClick={() => act(row.post_id, "legal")} className="rounded border border-amber-700 px-3 py-1.5 text-xs text-amber-300 hover:bg-amber-950">Legal review</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="text-center text-slate-500">No posts awaiting approval.</p>}
      </div>
    </>
  );
}
