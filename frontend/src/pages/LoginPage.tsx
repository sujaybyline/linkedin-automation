import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Shield, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";

type LoginType = "admin" | "team";

const LOGIN_LABELS: Record<LoginType, string> = {
  admin: "Full access including Approvals and Logs",
  team: "All features except Approvals and Logs",
};

export function LoginPage() {
  const { user, login } = useAuth();
  const [loginType, setLoginType] = useState<LoginType>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace state={{ fromLogin: true }} />;

  function switchType(type: LoginType) {
    setLoginType(type);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      // Small delay to ensure token is set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const tabClass = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium ${
      active ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
    }`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">APEX</p>
        <h1 className="mb-2 text-lg font-bold text-white">LinkedIn Automation</h1>
        <p className="mb-4 text-xs text-slate-500">Choose how you want to sign in</p>

        <div className="mb-4 flex gap-2 rounded-lg border border-slate-800 bg-slate-950 p-1">
          <button type="button" className={tabClass(loginType === "admin")} onClick={() => switchType("admin")}>
            <Shield className="h-4 w-4" />
            Admin
          </button>
          <button type="button" className={tabClass(loginType === "team")} onClick={() => switchType("team")}>
            <Users className="h-4 w-4" />
            Team
          </button>
        </div>

        <p className="mb-4 text-xs text-slate-400">{LOGIN_LABELS[loginType]}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? "Please wait…" : loginType === "admin" ? "Sign in as Admin" : "Sign in as Team"}
          </button>
        </form>
      </div>
    </div>
  );
}
