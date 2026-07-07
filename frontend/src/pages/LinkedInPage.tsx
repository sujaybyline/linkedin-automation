import { useEffect, useState } from "react";
import { Plus, Star, Trash2, UserCircle } from "lucide-react";
import { PageHeader, Badge } from "../components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, resolveApiUrl } from "../services/api";

interface LinkedInAccount {
  id: number;
  label: string;
  member_name: string;
  connected: boolean;
  is_default: boolean;
}

export function LinkedInPage() {
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [label, setLabel] = useState("");
  const [memberName, setMemberName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function load() {
    apiGet<LinkedInAccount[]>("linkedin/accounts")
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setLoading(true);
    setMessage("");
    try {
      await apiPost("linkedin/accounts", {
        label: label.trim(),
        member_name: memberName.trim(),
        connected: false,
      });
      setLabel("");
      setMemberName("");
      setMessage("Account added. Connect via OAuth when credentials are configured.");
      load();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Failed to add account"}`);
    } finally {
      setLoading(false);
    }
  }

  async function setDefault(id: number) {
    await apiPatch(`linkedin/accounts/${id}`, { is_default: true });
    load();
  }

  async function removeAccount(id: number) {
    if (!confirm("Remove this LinkedIn account? Scheduled posts using it will be unassigned.")) return;
    try {
      await apiDelete(`linkedin/accounts/${id}`);
      setMessage("Account removed.");
      load();
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : "Delete failed"}`);
    }
  }

  const connectedCount = accounts.filter((a) => a.connected).length;

  return (
    <>
      <PageHeader
        title="LinkedIn Accounts"
        description="Connect multiple LinkedIn profiles. Choose which account to use when scheduling each post."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Total accounts</p>
          <p className="text-xl font-bold text-white">{accounts.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-900/50 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Connected</p>
          <p className="text-xl font-bold text-emerald-400">{connectedCount}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
          <p className="text-xs text-slate-500">Default account</p>
          <p className="truncate text-sm font-medium text-slate-200">
            {accounts.find((a) => a.is_default)?.label || "—"}
          </p>
        </div>
      </div>

      <form
        onSubmit={addAccount}
        className="mb-8 max-w-xl rounded-lg border border-slate-800 bg-slate-900 p-4"
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Add LinkedIn account
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Account label</label>
            <input
              type="text"
              placeholder="e.g. Founder profile"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Display name (optional)</label>
            <input
              type="text"
              placeholder="e.g. John Smith"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-3 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Adding…" : "Add account"}
        </button>
      </form>

      {message && (
        <p
          className={`mb-4 text-sm ${
            message.startsWith("Error") ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {message}
        </p>
      )}

      <div className="space-y-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800">
                <UserCircle className="h-6 w-6 text-slate-400" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-white">{account.label}</h3>
                  {account.is_default && <Badge variant="success">Default</Badge>}
                  <Badge variant={account.connected ? "success" : "warning"}>
                    {account.connected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                {account.member_name && (
                  <p className="mt-0.5 text-sm text-slate-400">{account.member_name}</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!account.is_default && (
                <button
                  type="button"
                  onClick={() => setDefault(account.id)}
                  className="flex items-center gap-1 rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  <Star className="h-3 w-3" /> Set default
                </button>
              )}
              <a
                href={resolveApiUrl(`linkedin/connect?account_id=${account.id}`)}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
              >
                Connect OAuth
              </a>
              <button
                type="button"
                onClick={() => removeAccount(account.id)}
                className="flex items-center gap-1 rounded border border-red-900/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/30"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        ))}
        {!accounts.length && (
          <p className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-8 text-center text-slate-500">
            No LinkedIn accounts yet. Add your first account above.
          </p>
        )}
      </div>
    </>
  );
}
