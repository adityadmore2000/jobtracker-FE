import { Pencil } from "lucide-react";
import type { Application } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";

type ApplicationRowProps = {
  application: Partial<Application>;
  isDraft?: boolean;
  isSelected?: boolean;
  hasPendingChanges?: boolean;
  draftId?: string | null;
  onSelect?: (applicationId: number) => void;
  onSelectDraft?: (draftId: string) => void;
};

function cell(value: string | undefined | null) {
  return value?.trim() || "—";
}

function renderArray(values: string[] | undefined | null): string {
  if (!values || values.length === 0) return "—";
  return values.join(", ");
}

export default function ApplicationRow({
  application,
  isDraft = false,
  isSelected = false,
  hasPendingChanges = false,
  draftId,
  onSelect,
  onSelectDraft,
}: ApplicationRowProps) {
  const rowBase = "border-b transition-colors";

  let rowClass: string;
  if (isDraft) {
    rowClass = `${rowBase} bg-amber-50 ${isSelected ? "outline outline-2 outline-amber-400" : "hover:bg-amber-100"}`;
  } else if (isSelected) {
    rowClass = `${rowBase} bg-blue-50`;
  } else {
    rowClass = `${rowBase} hover:bg-muted/40`;
  }

  const handleClick = () => {
    if (isDraft) {
      if (draftId && onSelectDraft) {
        onSelectDraft(draftId);
      }
    } else if (application.id !== undefined && onSelect) {
      onSelect(application.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  const isClickable = isDraft ? Boolean(draftId && onSelectDraft) : Boolean(application.id !== undefined && onSelect);

  const interactiveProps = isClickable
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
        <span className="flex items-center gap-1.5">
          {isDraft && (
            <button
              type="button"
              className="shrink-0 text-amber-600 hover:text-amber-800 focus:outline-none"
              aria-label="Edit draft"
              onClick={(e) => {
                e.stopPropagation();
                if (draftId && onSelectDraft) {
                  onSelectDraft(draftId);
                }
              }}
            >
              <Pencil size={12} />
            </button>
          )}
          {cell(application.company)}
          {hasPendingChanges && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
              Pending
            </span>
          )}
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
      <td className="px-3 py-2 text-sm">{renderArray(application.current_stages)}</td>
      <td className="px-3 py-2 text-sm">
        <PriorityBadge priority={application.priority} />
      </td>
      <td className="px-3 py-2 text-sm">{cell(application.location)}</td>
      <td className="px-3 py-2 text-sm">{renderArray(application.employment_types)}</td>
      <td className="px-3 py-2 text-sm">
        {application.job_link?.trim() ? (
          <a
            href={application.job_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800"
            onClick={(e) => e.stopPropagation()}
          >
            link
          </a>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
