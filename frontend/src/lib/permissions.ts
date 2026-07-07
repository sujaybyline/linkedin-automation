export type AppRole = "admin" | "team";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  team: "Team",
};

type NavItem = {
  to: string;
  label: string;
  roles: AppRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", roles: ["admin", "team"] },
  { to: "/fetch-info", label: "Fetch info", roles: ["admin", "team"] },
  { to: "/posts", label: "Create post", roles: ["admin", "team"] },
  { to: "/all-posts", label: "All posts", roles: ["admin", "team"] },
  { to: "/approvals", label: "Approvals", roles: ["admin"] },
  { to: "/schedule", label: "Schedule", roles: ["admin", "team"] },
  { to: "/queue", label: "Queue", roles: ["admin", "team"] },
  { to: "/logs", label: "Logs", roles: ["admin"] },
  { to: "/ai-config", label: "AI Config", roles: ["admin"] },
  { to: "/emergency", label: "Emergency", roles: ["admin", "team"] },
  { to: "/linkedin", label: "LinkedIn", roles: ["admin", "team"] },
];

export function navForRole(role?: string) {
  const r = (role === "admin" || role === "team" ? role : "team") as AppRole;
  return NAV_ITEMS.filter((item) => item.roles.includes(r));
}

export function canAccessRoute(role: string | undefined, path: string) {
  const item = NAV_ITEMS.find((n) => n.to === path || (n.to !== "/" && path.startsWith(n.to)));
  if (!item) return true;
  const r = (role === "admin" || role === "team" ? role : "team") as AppRole;
  return item.roles.includes(r);
}
