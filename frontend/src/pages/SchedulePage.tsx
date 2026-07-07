import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Edit2, PauseCircle, CheckCircle } from "lucide-react";
import { PageHeader, Badge } from "../components/ui";
import { apiGet, apiPatch, apiPost } from "../services/api";

interface LinkedInAccount {
  id: number;
  label: string;
  member_name: string;
  connected: boolean;
  is_default: boolean;
}

interface ScheduleInfo {
  scheduled_date: string | null;
  scheduled_time: string | null;
  timezone: string;
  auto_post_status: string;
  linkedin_account_id?: number | null;
  linkedin_account?: { id: number; label: string; member_name: string } | null;
}

interface ScheduleRow {
  post_id: string;
  approval_status: string;
  visual_cards?: { topic: string } | null;
  schedules?: ScheduleInfo | null;
}

type FilterTab = "all" | "scheduled" | "paused" | "unscheduled";

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function formatTime(value: string | null | undefined) {
  if (!value) return "09:00";
  return String(value).slice(0, 5);
}

function statusVariant(status: string): "default" | "success" | "warning" | "danger" {
  if (status === "scheduled") return "success";
  if (status === "paused") return "warning";
  if (status === "skipped" || status === "failed") return "danger";
  return "default";
}

export function SchedulePage() {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");

  function load() {
    apiGet<ScheduleRow[]>("schedule").then(setRows).catch(() => setRows([]));
    apiGet<LinkedInAccount[]>("linkedin/accounts").then(setAccounts).catch(() => setAccounts([]));
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const counts = { scheduled: 0, paused: 0, unscheduled: 0, total: rows.length };
    for (const row of rows) {
      const s = row.schedules?.auto_post_status ?? "unscheduled";
      if (s === "scheduled") counts.scheduled++;
      else if (s === "paused") counts.paused++;
      else if (s === "unscheduled" || !s) counts.unscheduled++;
    }
    return counts;
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((row) => {
      const s = row.schedules?.auto_post_status ?? "unscheduled";
      if (filter === "unscheduled") return !s || s === "unscheduled";
      return s === filter;
    });
  }, [rows, filter]);

  async function patchSchedule(postId: string, body: Record<string, string | number | null>) {
    try {
      await apiPatch("schedule", { postId, ...body });
      setMessage(`Updated ${postId}`);
      load();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Update failed"}`);
    }
  }

  async function autoFill() {
    try {
      const data = await apiPost<{ scheduled: number }>("schedule", { action: "auto-fill" });
      setMessage(`Scheduled ${data.scheduled} approved post(s) — Mon–Fri 9:00 AM ET`);
      load();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Auto-fill failed"}`);
    }
  }

  const filterClass = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${
      active ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
    }`;

  return (
    <>
      <PageHeader
        title="Schedule Manager"
        description="Assign publish slots and choose which LinkedIn account each post uses."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Total posts</p>
          <p className="text-xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-emerald-900/50 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Scheduled</p>
          <p className="text-xl font-bold text-emerald-400">{stats.scheduled}</p>
        </div>
        <div className="rounded-lg border border-amber-900/50 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Paused</p>
          <p className="text-xl font-bold text-amber-400">{stats.paused}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Unscheduled</p>
          <p className="text-xl font-bold text-slate-300">{stats.unscheduled}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "scheduled", "paused", "unscheduled"] as FilterTab[]).map((tab) => (
            <button key={tab} type="button" className={filterClass(filter === tab)} onClick={() => setFilter(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={autoFill}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          Auto-fill weekdays
        </button>
      </div>

      {message && (
        <p
          className={`mb-4 text-sm ${
            message.startsWith("Error") ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {message}
        </p>
      )}

      {!accounts.length && (
        <p className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          No LinkedIn accounts yet. Add accounts on the LinkedIn page before scheduling.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">Post</th>
              <th className="px-4 py-3">Topic</th>
              <th className="px-4 py-3">LinkedIn account</th>
              <th className="px-4 py-3">Date & time</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const schedule = row.schedules;

              return (
                <tr key={row.post_id} className="border-b border-slate-800/50 hover:bg-slate-900/40">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-300">{row.post_id}</span>
                    <div className="mt-1">
                      <Badge variant={row.approval_status === "approved" ? "success" : "warning"}>
                        {row.approval_status}
                      </Badge>
                    </div>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-200">
                    {row.visual_cards?.topic || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={schedule?.linkedin_account_id ? String(schedule.linkedin_account_id) : ""}
                      onChange={(e) =>
                        patchSchedule(row.post_id, {
                          linkedin_account_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                      className="w-full min-w-[140px] rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                    >
                      <option value="">Select account…</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                          {a.is_default ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      {/* Date picker - always show input */}
                      <div className="relative">
                        <input
                          type="date"
                          value={formatDate(schedule?.scheduled_date as string)}
                          onChange={(e) => {
                            if (e.target.value) {
                              patchSchedule(row.post_id, { scheduled_date: e.target.value });
                            }
                          }}
                          onClick={(e) => {
                            e.currentTarget.showPicker?.();
                          }}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white hover:border-blue-500 focus:border-blue-600 focus:outline-none transition-colors cursor-pointer"
                          placeholder="Select date"
                          required
                        />
                        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                      </div>

                      {/* Time picker - always show input */}
                      <div className="relative">
                        <input
                          type="time"
                          value={formatTime(schedule?.scheduled_time as string)}
                          onChange={(e) => {
                            if (e.target.value) {
                              patchSchedule(row.post_id, { scheduled_time: e.target.value });
                            }
                          }}
                          onClick={(e) => {
                            e.currentTarget.showPicker?.();
                          }}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white hover:border-blue-500 focus:border-blue-600 focus:outline-none transition-colors cursor-pointer"
                          required
                        />
                        <Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
                      </div>

                      {/* Timezone picker */}
                      <div className="relative">
                        <select
                          value={schedule?.timezone || "America/New_York"}
                          onChange={(e) => {
                            patchSchedule(row.post_id, { timezone: e.target.value });
                          }}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white hover:border-blue-500 focus:border-blue-600 focus:outline-none transition-colors cursor-pointer appearance-none"
                          required
                        >
                          <option value="America/New_York">🌐 ET - Eastern (New York)</option>
                          <option value="America/Chicago">🌐 CT - Central (Chicago)</option>
                          <option value="America/Denver">🌐 MT - Mountain (Denver)</option>
                          <option value="America/Los_Angeles">🌐 PT - Pacific (Los Angeles)</option>
                          <option value="America/Phoenix">🌐 AZ - Arizona (Phoenix)</option>
                          <option value="America/Anchorage">🌐 AK - Alaska (Anchorage)</option>
                          <option value="Pacific/Honolulu">🌐 HI - Hawaii (Honolulu)</option>
                          <option value="Europe/London">🌐 GMT - London</option>
                          <option value="Europe/Paris">🌐 CET - Paris</option>
                          <option value="Asia/Dubai">🌐 GST - Dubai</option>
                          <option value="Asia/Kolkata">🌐 IST - India (Mumbai)</option>
                          <option value="Asia/Singapore">🌐 SGT - Singapore</option>
                          <option value="Asia/Tokyo">🌐 JST - Tokyo</option>
                          <option value="Australia/Sydney">🌐 AEDT - Sydney</option>
                        </select>
                        <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(schedule?.auto_post_status ?? "unscheduled")}>
                      {schedule?.auto_post_status ?? "unscheduled"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const hasDate = !!formatDate(schedule?.scheduled_date as string);
                      const hasTime = !!formatTime(schedule?.scheduled_time as string);
                      const hasAccount = !!schedule?.linkedin_account_id;
                      const isComplete = hasDate && hasTime && hasAccount;
                      const missingFields: string[] = [];
                      if (!hasDate) missingFields.push("date");
                      if (!hasTime) missingFields.push("time");
                      if (!hasAccount) missingFields.push("LinkedIn account");

                      return (
                        <div className="flex flex-col gap-2">
                          {!isComplete && (
                            <p className="text-xs text-red-400 mb-1">
                              Missing: {missingFields.join(", ")}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (!isComplete) {
                                setMessage(`Error: Please set ${missingFields.join(", ")} for ${row.post_id}`);
                                return;
                              }
                              patchSchedule(row.post_id, { auto_post_status: "scheduled" });
                            }}
                            disabled={!isComplete}
                            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-white ${
                              isComplete
                                ? "bg-emerald-600 hover:bg-emerald-500 cursor-pointer"
                                : "bg-slate-700 cursor-not-allowed opacity-50"
                            }`}
                            title={!isComplete ? `Please set ${missingFields.join(", ")}` : "Set schedule"}
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                            Set
                          </button>
                          <button
                            type="button"
                            onClick={() => patchSchedule(row.post_id, { auto_post_status: "paused" })}
                            className="flex items-center gap-1.5 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500"
                          >
                            <PauseCircle className="h-3.5 w-3.5" />
                            Hold
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              // Navigate to edit page or open edit modal
                              window.location.href = `/posts?edit=${row.post_id}`;
                            }}
                            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                  No posts match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
