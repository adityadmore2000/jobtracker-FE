import { Pencil } from "lucide-react";
import type { Application } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

type ApplicationRowProps = {
  application: Partial<Application>;
  isDraft?: boolean;
  isSelected?: boolean;
  onSelect?: (applicationId: number) => void;
};

function cell(value: string | undefined | null) {
  return value?.trim() || "—";
}

export default function ApplicationRow({
  application,
  isDraft = false,
  isSelected = false,
  onSelect,
}: ApplicationRowProps) {
  const rowBase = "border-b transition-colors";

  let rowClass: string;
  if (isDraft) {
    rowClass = `${rowBase} bg-amber-50`;
  } else if (isSelected) {
    rowClass = `${rowBase} bg-blue-50`;
  } else {
    rowClass = `${rowBase} hover:bg-muted/40`;
  }

  const handleClick = () => {
    if (!isDraft && application.id !== undefined && onSelect) {
      onSelect(application.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (!isDraft && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      if (application.id !== undefined && onSelect) {
        onSelect(application.id);
      }
    }
  };

  const interactiveProps = !isDraft
    ? {
        tabIndex: 0,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
        style: { cursor: "pointer" } as React.CSSProperties,
      }
    : {};

  const displayStatus = isDraft ? "draft" : (application.status ?? "");

  return (
    <tr className={rowClass} {...interactiveProps}>
      <td className="px-3 py-2 text-sm">
        <span className="flex items-center gap-1">
          {isDraft && (
            <Pencil
              size={12}
              className="shrink-0 text-amber-600"
              aria-label="draft"
            />
          )}
          {cell(application.company)}
        </span>
      </td>
      <td className="px-3 py-2 text-sm">{cell(application.role)}</td>
      <td className="px-3 py-2 text-sm">
        {displayStatus ? (
          <StatusBadge status={displayStatus} />
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2 text-sm">{cell(application.current_stage)}</td>
      <td className="px-3 py-2 text-sm">
        <PriorityBadge priority={application.priority} />
      </td>
      <td className="px-3 py-2 text-sm">{cell(application.location_mode)}</td>
      <td className="px-3 py-2 text-sm">{cell(application.employment_type)}</td>
    </tr>
  );
}
