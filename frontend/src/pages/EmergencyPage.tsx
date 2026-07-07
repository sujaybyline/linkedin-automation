import { useEffect, useState } from "react";
import { PageHeader, Badge } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPut } from "../services/api";

export function EmergencyPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin";
  const [active, setActive] = useState<boolean | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function load() {
    setLoading(true);
    apiGet<{ emergency_stop: boolean; dry_run_mode: boolean }>("system/emergency-stop")
      .then((s) => {
        setActive(s.emergency_stop);
        setDryRun(s.dry_run_mode);
        setMessage("");
      })
      .catch((err) => {
        setMessage(err instanceof Error ? err.message : "Could not load emergency stop status");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle() {
    if (!canManage || active === null) return;
    setSaving(true);
    setMessage("");
    try {
      const next = !active;
      const result = await apiPut<{ emergency_stop: boolean }>("system/emergency-stop", {
        emergency_stop: next,
      });
      setActive(result.emergency_stop);
      setMessage(next ? "Emergency stop is now ON." : "Emergency stop is now OFF — publishing allowed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update emergency stop");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Emergency Stop" description="Halt all publishing immediately." />
      <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading status…</p>
        ) : (
          <>
            <Badge variant={active ? "danger" : "success"}>
              {active ? "STOP ACTIVE" : "Stop off"}
            </Badge>
            <p className="mt-4 text-sm text-slate-400">
              Dry run: {dryRun ? "ON (safe)" : "OFF"}
            </p>
            {!canManage && (
              <p className="mt-3 text-sm text-amber-400">
                Only admins can change emergency stop. Log in as admin to turn it off.
              </p>
            )}
            <button
              type="button"
              onClick={toggle}
              disabled={!canManage || saving || active === null}
              className={`mt-4 rounded px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? "bg-emerald-700 hover:bg-emerald-600" : "bg-red-700 hover:bg-red-600"
              }`}
            >
              {saving
                ? "Saving…"
                : active
                  ? "Turn emergency stop OFF"
                  : "Turn emergency stop ON"}
            </button>
          </>
        )}
        {message && (
          <p
            className={`mt-3 text-sm ${
              message.includes("Failed") || message.includes("Could not") || message.includes("Forbidden")
                ? "text-red-400"
                : "text-emerald-400"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </>
  );
}
