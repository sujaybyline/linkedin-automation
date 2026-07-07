import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PenSquare,
  Files,
  CheckSquare,
  Calendar,
  ListOrdered,
  ScrollText,
  ShieldAlert,
  Share2,
  LogOut,
  Radar,
  Building2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Fragment, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCompanyProfiles } from "../context/CompanyProfilesContext";
import { navForRole, ROLE_LABELS } from "../lib/permissions";
import { apiDelete } from "../services/api";

const ICONS = {
  "/": LayoutDashboard,
  "/posts": PenSquare,
  "/fetch-info": Radar,
  "/all-posts": Files,
  "/approvals": CheckSquare,
  "/schedule": Calendar,
  "/queue": ListOrdered,
  "/logs": ScrollText,
  "/emergency": ShieldAlert,
  "/linkedin": Share2,
  "/ai-config": Sparkles,
} as const;

function userInitials(name: string, email: string) {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function Layout() {
  const { user, logout } = useAuth();
  const { profiles, refresh } = useCompanyProfiles();
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = navForRole(user?.role);
  const [deletingCompanyId, setDeletingCompanyId] = useState<number | null>(null);

  const displayName = user?.full_name?.trim() || user?.email?.split("@")[0] || "User";
  const roleLabel = user?.role ? ROLE_LABELS[user.role] : "";

  async function signOut() {
    await logout();
    navigate("/login");
  }

  async function deleteCompany(id: number, name: string) {
    if (!window.confirm(`Delete company profile "${name}"? Posts linked to it will be kept.`)) {
      return;
    }
    setDeletingCompanyId(id);
    try {
      await apiDelete(`company-profiles/${id}`);
      if (location.pathname === `/company/${id}`) {
        navigate("/fetch-info");
      }
      await refresh();
    } catch {
      window.alert("Could not delete company. Try again.");
    } finally {
      setDeletingCompanyId(null);
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900 p-4">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">APEX</p>
          <h1 className="text-sm font-bold text-white">LinkedIn content automation</h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(({ to, label }) => {
            const Icon = ICONS[to as keyof typeof ICONS] ?? LayoutDashboard;
            return (
              <Fragment key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? "bg-slate-800 text-white"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
                {to === "/linkedin" && profiles.length > 0 && (
                  <div className="mb-2 ml-2 space-y-0.5 border-l border-slate-800 pl-2">
                    <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      Companies
                    </p>
                    {profiles.map((p) => (
                      <div
                        key={p.id}
                        className="group flex items-center gap-0.5 rounded-md hover:bg-slate-800/50"
                      >
                        <NavLink
                          to={`/company/${p.id}`}
                          className={({ isActive }) =>
                            `flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                              isActive
                                ? "bg-slate-800 text-white"
                                : "text-slate-500 group-hover:text-slate-300"
                            }`
                          }
                        >
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{p.companyName}</span>
                        </NavLink>
                        <button
                          type="button"
                          title={`Delete ${p.companyName}`}
                          disabled={deletingCompanyId === p.id}
                          onClick={() => deleteCompany(p.id, p.companyName)}
                          className="mr-1 shrink-0 rounded p-1 text-slate-600 opacity-0 transition hover:bg-red-950/50 hover:text-red-400 group-hover:opacity-100 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3 border-t border-slate-800 pt-4">
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-2 py-2 transition ${
                isActive ? "bg-slate-800" : "hover:bg-slate-800/60"
              }`
            }
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/25 text-xs font-semibold text-blue-300 ring-1 ring-blue-500/30">
              {userInitials(user?.full_name ?? "", user?.email ?? "")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
              {roleLabel && (
                <span className="mt-0.5 inline-block rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  {roleLabel}
                </span>
              )}
            </div>
          </NavLink>

          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2.5 text-sm font-medium text-red-300 transition hover:border-red-800 hover:bg-red-950/50 hover:text-red-200"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
