import { useEffect, useState } from "react";
import { KeyRound, Shield, User, Users } from "lucide-react";
import { Badge } from "../components/ui";
import { useAuth, type Profile } from "../context/AuthContext";
import { apiGet, apiPatch } from "../services/api";

interface TeamLoginInfo {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

function initials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40";

const inputDisabledClass =
  "w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm text-slate-500";

function Alert({ message }: { message: string }) {
  const isError = message.startsWith("Error");
  return (
    <p
      className={`rounded-lg px-3 py-2 text-sm ${
        isError ? "bg-red-950/50 text-red-300" : "bg-emerald-950/40 text-emerald-300"
      }`}
    >
      {message}
    </p>
  );
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const isAdmin = user?.role === "admin";

  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const [teamInfo, setTeamInfo] = useState<TeamLoginInfo | null>(null);
  const [teamEmail, setTeamEmail] = useState("");
  const [teamFullName, setTeamFullName] = useState("");
  const [teamNewPassword, setTeamNewPassword] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [teamSaving, setTeamSaving] = useState(false);

  useEffect(() => {
    if (user) setFullName(user.full_name || "");
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    apiGet<TeamLoginInfo | null>("auth/team-login")
      .then((data) => {
        setTeamInfo(data);
        if (data) {
          setTeamEmail(data.email);
          setTeamFullName(data.full_name || "");
        }
      })
      .catch(() => setTeamInfo(null));
  }, [isAdmin]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMessage("");
    setProfileSaving(true);
    try {
      const body: Record<string, string> = {};
      if (fullName !== user?.full_name) body.full_name = fullName;
      if (newPassword) {
        body.current_password = currentPassword;
        body.new_password = newPassword;
      }
      if (!Object.keys(body).length) {
        setProfileMessage("No changes to save.");
        return;
      }
      await apiPatch<Profile>("auth/profile", body);
      await refreshUser();
      setCurrentPassword("");
      setNewPassword("");
      setProfileMessage("Profile updated successfully.");
    } catch (err) {
      setProfileMessage(`Error: ${err instanceof Error ? err.message : "Update failed"}`);
    } finally {
      setProfileSaving(false);
    }
  }

  async function saveTeamLogin(e: React.FormEvent) {
    e.preventDefault();
    setTeamMessage("");
    setTeamSaving(true);
    try {
      const body: Record<string, string> = {};
      if (teamEmail !== teamInfo?.email) body.email = teamEmail;
      if (teamFullName !== (teamInfo?.full_name ?? "")) body.full_name = teamFullName;
      if (teamNewPassword) body.new_password = teamNewPassword;
      if (!Object.keys(body).length) {
        setTeamMessage("No changes to save.");
        return;
      }
      const updated = await apiPatch<TeamLoginInfo>("auth/team-login", body);
      setTeamInfo(updated);
      setTeamEmail(updated.email);
      setTeamFullName(updated.full_name || "");
      setTeamNewPassword("");
      setTeamMessage("Team login updated successfully.");
    } catch (err) {
      setTeamMessage(`Error: ${err instanceof Error ? err.message : "Update failed"}`);
    } finally {
      setTeamSaving(false);
    }
  }

  const displayName = user?.full_name?.trim() || user?.email?.split("@")[0] || "User";
  const roleLabel = user?.role === "admin" ? "Admin" : "Team";

  return (
    <div className="mx-auto max-w-5xl">
      {/* Profile header */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-600/20 text-lg font-semibold text-blue-300 ring-2 ring-blue-500/30">
            {initials(displayName, user?.email ?? "")}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{displayName}</h1>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <div className="mt-2">
              <Badge variant={isAdmin ? "success" : "default"}>{roleLabel}</Badge>
            </div>
          </div>
        </div>
        <p className="max-w-xs text-xs leading-relaxed text-slate-500 sm:text-right">
          {isAdmin
            ? "Manage your account and team login credentials from the sections below."
            : "Update your display name and password below."}
        </p>
      </div>

      <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
        {/* My account */}
        <form
          onSubmit={saveProfile}
          className="rounded-xl border border-slate-800 bg-slate-900/80 p-5"
        >
          <div className="mb-5 flex items-center gap-2 border-b border-slate-800 pb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
              <User className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">My account</h2>
              <p className="text-xs text-slate-500">Your personal login details</p>
            </div>
          </div>

          <div className="space-y-4">
            <Field label="Email">
              <input type="email" value={user?.email ?? ""} disabled className={inputDisabledClass} />
            </Field>
            <Field label="Display name">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                placeholder="Your name"
              />
            </Field>
            <Field label="Role">
              <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                <Shield className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-400">{roleLabel}</span>
              </div>
            </Field>
          </div>

          <div className="mt-6 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-medium text-slate-300">Change password</span>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
              />
              <input
                type="password"
                placeholder="New password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={profileSaving}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {profileSaving ? "Saving…" : "Save changes"}
            </button>
            {profileMessage && <Alert message={profileMessage} />}
          </div>
        </form>

        {/* Team login — admin only */}
        {isAdmin && (
          <form
            onSubmit={saveTeamLogin}
            className="rounded-xl border border-violet-900/30 bg-slate-900/80 p-5"
          >
            <div className="mb-5 flex items-center gap-2 border-b border-slate-800 pb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-950/60">
                <Users className="h-4 w-4 text-violet-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Team login</h2>
                <p className="text-xs text-slate-500">Credentials for team sign-in</p>
              </div>
            </div>

            {!teamInfo ? (
              <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
                No team user found. Run{" "}
                <code className="rounded bg-slate-900 px-1 py-0.5 text-xs">node scripts/seed-users.js</code>{" "}
                in the backend folder.
              </div>
            ) : (
              <div className="space-y-4">
                <Field label="Team email">
                  <input
                    type="email"
                    value={teamEmail}
                    onChange={(e) => setTeamEmail(e.target.value)}
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Team display name">
                  <input
                    type="text"
                    value={teamFullName}
                    onChange={(e) => setTeamFullName(e.target.value)}
                    className={inputClass}
                    placeholder="APEX Team"
                  />
                </Field>
                <Field label="New password">
                  <input
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={teamNewPassword}
                    onChange={(e) => setTeamNewPassword(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {teamInfo && (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="submit"
                  disabled={teamSaving}
                  className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {teamSaving ? "Saving…" : "Update team login"}
                </button>
                {teamMessage && <Alert message={teamMessage} />}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
