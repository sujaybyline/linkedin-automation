import { useEffect, useState } from "react";
import { PageHeader, Badge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { apiGet } from "../services/api";

interface PubLog {
  id: number;
  post_id: string;
  status: string;
  reason: string;
  attempted_at_utc: string;
  linkedin_post_id?: string;
  retry_count?: number;
}

interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

function formatTime(value: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 19) : d.toLocaleString();
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" {
  if (status === "published") return "success";
  if (status === "failed") return "danger";
  if (status === "blocked" || status === "dry_run") return "warning";
  return "default";
}

export function LogsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<"publishing" | "audit">("publishing");
  const [logs, setLogs] = useState<PubLog[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    if (tab === "publishing") {
      apiGet<PubLog[]>("logs/publishing")
        .then(setLogs)
        .catch((err) => {
          setLogs([]);
          setError(err instanceof Error ? err.message : "Failed to load publishing logs");
        })
        .finally(() => setLoading(false));
    } else {
      apiGet<AuditLog[]>("logs/audit")
        .then(setAudit)
        .catch((err) => {
          setAudit([]);
          setError(err instanceof Error ? err.message : "Failed to load audit logs");
        })
        .finally(() => setLoading(false));
    }
  }, [tab]);

  const tabClass = (active: boolean) =>
    `rounded px-3 py-1.5 text-sm ${
      active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <PageHeader title="Logs & Reports" description="Publishing attempts and system audit trail." />

      <div className="mb-4 flex gap-2">
        <button type="button" className={tabClass(tab === "publishing")} onClick={() => setTab("publishing")}>
          Publishing
        </button>
        {isAdmin && (
          <button type="button" className={tabClass(tab === "audit")} onClick={() => setTab("audit")}>
            Audit
          </button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!loading && tab === "publishing" && (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Post</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">LinkedIn ID</th>
                <th className="px-4 py-3">Retry</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-800/50">
                  <td className="px-4 py-3 text-xs text-slate-500">{formatTime(log.attempted_at_utc)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.post_id}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                  </td>
                  <td className="max-w-md px-4 py-3 text-xs text-slate-400">{log.reason || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.linkedin_post_id || "—"}</td>
                  <td className="px-4 py-3">{log.retry_count ?? 0}</td>
                </tr>
              ))}
              {!logs.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No publishing attempts yet. Logs appear when the cron worker runs or a post is published.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && tab === "audit" && isAdmin && (
        <div className="space-y-2">
          {audit.map((entry) => (
            <div key={entry.id} className="rounded border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
              <span className="text-xs text-slate-500">{formatTime(entry.created_at)}</span>
              <p className="mt-1">
                <strong className="text-white">{entry.action}</strong>{" "}
                <span className="text-slate-400">
                  {entry.entity_type}/{entry.entity_id}
                </span>
              </p>
            </div>
          ))}
          {!audit.length && (
            <p className="rounded border border-slate-800 bg-slate-900 px-4 py-8 text-center text-slate-500">
              No audit entries yet.
            </p>
          )}
        </div>
      )}
    </>
  );
}
