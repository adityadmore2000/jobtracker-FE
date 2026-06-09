import type { Application } from "@/lib/types";
import ApplicationRow from "./ApplicationRow";

type ApplicationsTableProps = {
  applications: Application[];
  archived: Application[];
  activeDraft: Partial<Application> | null;
  draftId: string | null;
  activeTab: "active" | "archived";
  loading: boolean;
  error: string | null;
  selectedApplicationId: number | null;
  selectedDraftId: string | null;
  onActiveTabChange: (tab: "active" | "archived") => void;
  onSelectApplication: (applicationId: number) => void;
  onSelectDraft: (draftId: string) => void;
  onRetry: () => void;
};

export default function ApplicationsTable({
  applications,
  archived,
  activeDraft,
  draftId,
  activeTab,
  loading,
  error,
  selectedApplicationId,
  selectedDraftId,
  onActiveTabChange,
  onSelectApplication,
  onSelectDraft,
  onRetry,
}: ApplicationsTableProps) {
  const activeCount = applications.length + (activeDraft ? 1 : 0);
  const archivedCount = archived.length;

  const activeTabClass = (tab: "active" | "archived") =>
    tab === activeTab
      ? "px-3 py-1 rounded text-sm font-medium bg-foreground text-background"
      : "px-3 py-1 rounded text-sm font-medium text-muted-foreground hover:text-foreground";

  const renderBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
            Loading applications…
          </td>
        </tr>
      );
    }

    if (error !== null) {
      return (
        <tr>
          <td colSpan={7} className="px-3 py-8 text-center text-sm">
            <span className="text-rose-600">Could not load applications.</span>
            <button
              className="ml-3 rounded border px-2 py-0.5 text-xs hover:bg-muted"
              onClick={onRetry}
            >
              Retry
            </button>
          </td>
        </tr>
      );
    }

    if (activeTab === "active") {
      const hasDraft = activeDraft !== null;
      const hasRows = applications.length > 0;

      if (!hasDraft && !hasRows) {
        return (
          <tr>
            <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
              No active applications yet.
            </td>
          </tr>
        );
      }

      return (
        <>
          {hasDraft && draftId && (
            <ApplicationRow
              application={activeDraft}
              isDraft
              draftId={draftId}
              isSelected={selectedDraftId === draftId}
              onSelectDraft={onSelectDraft}
            />
          )}
          {hasDraft && !draftId && (
            <ApplicationRow application={activeDraft} isDraft />
          )}
          {applications.map((app) => (
            <ApplicationRow
              key={app.id}
              application={app}
              isSelected={app.id === selectedApplicationId}
              onSelect={onSelectApplication}
            />
          ))}
        </>
      );
    }

    // archived tab
    if (archived.length === 0) {
      return (
        <tr>
          <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
            No archived applications.
          </td>
        </tr>
      );
    }

    return (
      <>
        {archived.map((app) => (
          <ApplicationRow
            key={app.id}
            application={app}
            isSelected={app.id === selectedApplicationId}
            onSelect={onSelectApplication}
          />
        ))}
      </>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-2">
        <span className="font-medium">Applications</span>
        <div className="flex gap-1">
          <button
            className={activeTabClass("active")}
            onClick={() => onActiveTabChange("active")}
          >
            Active {activeCount}
          </button>
          <button
            className={activeTabClass("archived")}
            onClick={() => onActiveTabChange("archived")}
          >
            Archived {archivedCount}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 border-b bg-background text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Priority</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>{renderBody()}</tbody>
        </table>
      </div>
    </div>
  );
}
