import { useEffect, useMemo, useState } from "react";
import type { Application } from "@/lib/types";
import ApplicationRow from "./ApplicationRow";

export type ApplicationsTab = "active" | "drafts" | "archived";

const PAGE_SIZE = 10;
const COLUMN_COUNT = 8;

type ApplicationsTableProps = {
  applications: Application[];
  drafts: Application[];
  archived: Application[];
  activeDraft: Partial<Application> | null;
  draftId: string | null;
  activeTab: ApplicationsTab;
  loading: boolean;
  error: string | null;
  selectedApplicationId: number | null;
  selectedDraftId: string | null;
  pendingChangesApplicationIds?: Set<number>;
  onActiveTabChange: (tab: ApplicationsTab) => void;
  onSelectApplication: (applicationId: number) => void;
  onSelectDraft: (draftId: string) => void;
  onRetry: () => void;
};

export default function ApplicationsTable({
  applications,
  drafts,
  archived,
  activeDraft,
  draftId,
  activeTab,
  loading,
  error,
  selectedApplicationId,
  selectedDraftId,
  pendingChangesApplicationIds = new Set(),
  onActiveTabChange,
  onSelectApplication,
  onSelectDraft,
  onRetry,
}: ApplicationsTableProps) {
  const activeCount = applications.length;
  const draftsCount = drafts.length;
  const archivedCount = archived.length;

  // Client-side pagination. The pinned active-tab draft row is not counted as a
  // paginated row; only persisted rows (applications/drafts/archived) paginate.
  const [page, setPage] = useState(1);

  const rows = useMemo<Application[]>(() => {
    if (activeTab === "active") return applications;
    if (activeTab === "drafts") return drafts;
    return archived;
  }, [activeTab, applications, drafts, archived]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  // Reset to page 1 whenever the tab changes or the row set shrinks below the
  // current page (e.g. after archiving/deleting), so we never strand the user
  // on an empty page.
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [rows, page]
  );

  const activeTabClass = (tab: ApplicationsTab) =>
    tab === activeTab
      ? "px-3 py-1 rounded text-sm font-medium bg-foreground text-background"
      : "px-3 py-1 rounded text-sm font-medium text-muted-foreground hover:text-foreground";

  const renderBody = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-sm text-muted-foreground">
            Loading applications…
          </td>
        </tr>
      );
    }

    if (error !== null) {
      return (
        <tr>
          <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-sm">
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
            <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-sm text-muted-foreground">
              No active applications yet.
            </td>
          </tr>
        );
      }

      // The draft is pinned to the top of the first page only.
      const showDraft = hasDraft && page === 1;

      return (
        <>
          {showDraft && draftId && (
            <ApplicationRow
              application={activeDraft}
              isDraft
              draftId={draftId}
              isSelected={selectedDraftId === draftId}
              onSelectDraft={onSelectDraft}
            />
          )}
          {showDraft && !draftId && (
            <ApplicationRow application={activeDraft} isDraft />
          )}
          {pageRows.map((app) => (
            <ApplicationRow
              key={app.id}
              application={app}
              isSelected={app.id === selectedApplicationId}
              hasPendingChanges={pendingChangesApplicationIds.has(app.id)}
              onSelect={onSelectApplication}
            />
          ))}
        </>
      );
    }

    if (activeTab === "drafts") {
      if (drafts.length === 0) {
        return (
          <tr>
            <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-sm text-muted-foreground">
              No drafts.
            </td>
          </tr>
        );
      }
      return (
        <>
          {pageRows.map((draft) => (
            <ApplicationRow
              key={draft.id}
              application={draft}
              isDraft
              draftId={String(draft.id)}
              isSelected={selectedDraftId === String(draft.id)}
              onSelectDraft={onSelectDraft}
            />
          ))}
        </>
      );
    }

    // archived tab
    if (archived.length === 0) {
      return (
        <tr>
          <td colSpan={COLUMN_COUNT} className="px-3 py-8 text-center text-sm text-muted-foreground">
            No archived applications.
          </td>
        </tr>
      );
    }

    return (
      <>
        {pageRows.map((app) => (
          <ApplicationRow
            key={app.id}
            application={app}
            isSelected={app.id === selectedApplicationId}
            hasPendingChanges={pendingChangesApplicationIds.has(app.id)}
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
            className={activeTabClass("drafts")}
            onClick={() => onActiveTabChange("drafts")}
          >
            Drafts {draftsCount}
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
              <th className="px-3 py-2 font-medium">Link</th>
            </tr>
          </thead>
          <tbody>{renderBody()}</tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && error === null && rows.length > PAGE_SIZE && (
        <div className="flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded border px-2 py-0.5 hover:bg-muted disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border px-2 py-0.5 hover:bg-muted disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
