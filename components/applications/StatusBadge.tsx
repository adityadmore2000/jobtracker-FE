type StatusBadgeProps = {
  status: string;
};

const BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-amber-100 text-amber-800",
  // Backend STATUS_OPTIONS (case-insensitive lookup keys)
  interested: "bg-sky-100 text-sky-800",
  applied: "bg-blue-100 text-blue-800",
  interview: "bg-violet-100 text-violet-800",
  offer: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-800",
  archived: "bg-slate-100 text-slate-600",
  // Additional semantic aliases kept for completeness
  interviewing: "bg-violet-100 text-violet-800",
  offered: "bg-emerald-100 text-emerald-800",
  ghosted: "bg-slate-100 text-slate-500",
  withdrawn: "bg-slate-100 text-slate-500",
};

const FALLBACK = "bg-neutral-100 text-neutral-600";

export default function StatusBadge({ status }: StatusBadgeProps) {
  const key = status.toLowerCase();
  const colorClasses = STATUS_CLASSES[key] ?? FALLBACK;
  return (
    <span className={`${BASE} ${colorClasses}`}>
      {status}
    </span>
  );
}
