type PriorityBadgeProps = {
  priority?: string | null;
};

const BASE = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";

const PRIORITY_CLASSES: Record<string, string> = {
  high: "bg-rose-100 text-rose-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-600",
};

const FALLBACK = "bg-neutral-100 text-neutral-600";

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (!priority) {
    return <span className={`${BASE} ${FALLBACK}`}>—</span>;
  }

  const key = priority.toLowerCase();
  const colorClasses = PRIORITY_CLASSES[key] ?? FALLBACK;
  return (
    <span className={`${BASE} ${colorClasses}`}>
      {priority}
    </span>
  );
}
