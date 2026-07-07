import { useEffect, useState } from "react";
import { PageHeader, Badge } from "../components/ui";
import { api, apiGet } from "../services/api";

interface QueueRow {
  post_id: string;
  publish_state: "posted" | "pending";
  visual_cards?: { topic: string; filename: string } | null;
  captions?: { final_post_text: string } | null;
  schedules?: {
    scheduled_date: string | null;
    scheduled_time: string | null;
    timezone: string;
    linkedin_account?: { id: number; label: string; member_name: string } | null;
  } | null;
}

function PostThumb({ postId }: { postId: string }) {
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

  const boxClass =
    "flex h-14 w-14 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-950 text-[10px] text-slate-500";

  if (failed) return <div className={boxClass}>No img</div>;
  if (!src) return <div className={boxClass}>…</div>;

  return (
    <img
      src={src}
      alt=""
      className="h-14 w-14 shrink-0 rounded border border-slate-700 object-cover"
    />
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const dateOnly = String(value).slice(0, 10);
  const d = new Date(`${dateOnly}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateOnly;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";
  const parts = String(value).slice(0, 8).split(":");
  const h = Number(parts[0]);
  const m = parts[1] ?? "00";
  if (Number.isNaN(h)) return String(value).slice(0, 5);
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m} ${period}`;
}

function accountLabel(schedule: QueueRow["schedules"]) {
  if (schedule?.linkedin_account?.label) return schedule.linkedin_account.label;
  if (schedule?.linkedin_account?.member_name) return schedule.linkedin_account.member_name;
  return "Not assigned";
}

export function QueuePage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<QueueRow[]>("queue")
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const pendingCount = rows.filter((r) => r.publish_state === "pending").length;
  const postedCount = rows.filter((r) => r.publish_state === "posted").length;

  return (
    <>
      <PageHeader
        title="Publishing Queue"
        description="Approved posts waiting to publish or already posted on LinkedIn."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-lg border border-amber-900/40 bg-slate-900 px-3 py-2">
          <p className="text-xs text-slate-500">Pending to post</p>
          <p className="text-lg font-bold text-amber-400">{pendingCount}</p>
        </div>
        <div className="rounded-lg border border-emerald-900/40 bg-slate-900 px-3 py-2">
          <p className="text-xs text-slate-500">Posted</p>
          <p className="text-lg font-bold text-emerald-400">{postedCount}</p>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading queue…</p>}

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <div className="hidden border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-500 sm:grid sm:grid-cols-[56px_1fr_120px_140px_160px] sm:gap-3">
          <span />
          <span>Post</span>
          <span>Status</span>
          <span>Account</span>
          <span>Scheduled</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {rows.map((row) => {
            const schedule = row.schedules;
            const caption = row.captions?.final_post_text?.trim();
            const topic = row.visual_cards?.topic || row.visual_cards?.filename || "Untitled";
            const isPosted = row.publish_state === "posted";
            const tz = schedule?.timezone?.replace("America/", "") ?? "ET";

            return (
              <div
                key={row.post_id}
                className="grid grid-cols-[56px_1fr] gap-3 px-3 py-2.5 hover:bg-slate-900/50 sm:grid-cols-[56px_1fr_120px_140px_160px] sm:items-center"
              >
                <PostThumb postId={row.post_id} />

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-500">{row.post_id}</span>
                    <span className="truncate text-sm font-medium text-white">{topic}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-400">
                    {caption || "No caption"}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500 sm:hidden">
                    {accountLabel(schedule)} · {formatDate(schedule?.scheduled_date as string)}{" "}
                    {formatTime(schedule?.scheduled_time as string)} {tz}
                  </p>
                </div>

                <div className="hidden sm:block">
                  <Badge variant={isPosted ? "success" : "warning"}>
                    {isPosted ? "Posted" : "Pending to post"}
                  </Badge>
                </div>

                <div className="hidden truncate text-xs text-slate-300 sm:block" title={accountLabel(schedule)}>
                  {accountLabel(schedule)}
                </div>

                <div className="hidden text-xs text-slate-400 sm:block">
                  <div>{formatDate(schedule?.scheduled_date as string)}</div>
                  <div>
                    {formatTime(schedule?.scheduled_time as string)} {tz}
                  </div>
                </div>

                <div className="col-span-2 sm:hidden">
                  <Badge variant={isPosted ? "success" : "warning"}>
                    {isPosted ? "Posted" : "Pending to post"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>

        {!loading && !rows.length && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Queue is empty. Approve and schedule posts to see them here.
          </p>
        )}
      </div>
    </>
  );
}
