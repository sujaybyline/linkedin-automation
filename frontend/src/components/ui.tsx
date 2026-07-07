export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const styles = {
    default: "bg-slate-700 text-slate-200",
    success: "bg-emerald-900 text-emerald-200",
    warning: "bg-amber-900 text-amber-200",
    danger: "bg-red-900 text-red-200",
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ${styles[variant]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-white">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const tones = {
    default: "border-slate-800",
    success: "border-emerald-800",
    warning: "border-amber-800",
    danger: "border-red-800",
  };
  return (
    <div className={`rounded-lg border bg-slate-900 p-4 ${tones[tone]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export function EmergencyBanner({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-200">
      Emergency stop is ON — publishing is blocked.
    </div>
  );
}
