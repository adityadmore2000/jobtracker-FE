"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import type { Application, ApplicationChangeDraft } from "@/lib/types";
import { fetchApplications, fetchArchivedApplications, fetchDrafts, getApplicationChangeDraft } from "@/lib/api";
import { useSelection } from "@/lib/SelectionContext";
import ApplicationsTable, { type ApplicationsTab } from "./ApplicationsTable";
import DetailPanel from "@/components/detail/DetailPanel";

export type ApplicationsPanelHandle = {
  refresh: () => void;
};

type ApplicationsPanelProps = {
  activeDraft: Partial<Application> | null;
  // URL-canonical identity.
  routeApplicationId: number | null;
  routeDraftId: string | null;
  routeNotFound: string | null;
  routeLoading?: boolean;
  onActiveDraftChange: (draft: Partial<Application> | null) => void;
  onNavigateApplication: (id: number) => void;
  onNavigateDraft: (id: string) => void;
  onNavigateOverview: (replace?: boolean) => void;
};

const ApplicationsPanel = forwardRef<ApplicationsPanelHandle, ApplicationsPanelProps>(
  function ApplicationsPanel(
    {
      activeDraft,
      routeApplicationId,
      routeDraftId,
      routeNotFound,
      routeLoading = false,
      onActiveDraftChange,
      onNavigateApplication,
      onNavigateDraft,
      onNavigateOverview,
    },
    ref
  ) {
    const [applications, setApplications] = useState<Application[]>([]);
    const [drafts, setDrafts] = useState<Application[]>([]);
    const [archived, setArchived] = useState<Application[]>([]);
    const [activeTab, setActiveTab] = useState<ApplicationsTab>("active");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingChangeDrafts, setPendingChangeDrafts] = useState<Map<number, ApplicationChangeDraft>>(new Map());

    const { selection, setSelection } = useSelection();

    // Selection identity is derived from the URL route params, not from a second
    // independent selection store. SelectionContext is kept in sync by AppShell.
    const selectedApplicationId = routeApplicationId;
    const selectedDraftId = routeDraftId;

    const selectedChangeDraftId =
      selection?.kind === "pending_changes" ? selection.changeDraftId : null;

    const refresh = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const [active, draftRows, arch] = await Promise.all([
          fetchApplications(),
          fetchDrafts(),
          fetchArchivedApplications(),
        ]);
        setApplications(active);
        setDrafts(draftRows);
        setArchived(arch);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        refresh,
      }),
      [refresh]
    );

    useEffect(() => {
      void refresh();
    }, [refresh]);

    useEffect(() => {
      if (selectedChangeDraftId === null) return;
      if (pendingChangeDrafts.has(selectedChangeDraftId)) return;
      void getApplicationChangeDraft(selectedChangeDraftId).then((cd) => {
        setPendingChangeDrafts((prev) => new Map(prev).set(cd.id, cd));
      });
    }, [selectedChangeDraftId, pendingChangeDrafts]);

    const selectedChangeDraft =
      selectedChangeDraftId !== null
        ? (pendingChangeDrafts.get(selectedChangeDraftId) ?? null)
        : null;

    const pendingChangesApplicationIds = new Set(
      [...pendingChangeDrafts.values()].map((cd) => cd.target_application_id)
    );

    const selectedApplication =
      [...applications, ...archived].find(
        (application) => application.id === selectedApplicationId
      ) ?? null;

    const selectedApplicationIsArchived =
      selectedApplication?.archived_at != null ||
      archived.some((application) => application.id === selectedApplicationId);

    const handleDetailMutation = useCallback(async () => {
      await refresh();
    }, [refresh]);

    const handleDraftSaved = useCallback(
      (savedApp: Application) => {
        onActiveDraftChange(null);
        // Saved draft must leave the Drafts tab and appear under Active. Navigate
        // to the new saved-application detail route; AppShell re-syncs selection.
        setApplications((prev) => [savedApp, ...prev]);
        onNavigateApplication(savedApp.id);
        void refresh();
      },
      [onActiveDraftChange, onNavigateApplication, refresh]
    );

    const handleDraftDiscarded = useCallback(() => {
      onActiveDraftChange(null);
      // Discarded draft must leave the Drafts tab and the route must go to overview.
      onNavigateOverview(true);
      void refresh();
    }, [onActiveDraftChange, onNavigateOverview, refresh]);

    const handleDraftPatched = useCallback(
      (updatedDraft: Application) => {
        onActiveDraftChange(updatedDraft);
        setDrafts((prev) => prev.map((d) => (d.id === updatedDraft.id ? updatedDraft : d)));
      },
      [onActiveDraftChange]
    );

    const handleChangeDraftMutated = useCallback(
      (changeDraftId: number) => {
        setPendingChangeDrafts((prev) => {
          const next = new Map(prev);
          next.delete(changeDraftId);
          return next;
        });
        setSelection(null);
        void refresh();
      },
      [refresh, setSelection]
    );

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <ApplicationsTable
            applications={applications}
            drafts={drafts}
            archived={archived}
            activeDraft={activeDraft}
            draftId={selectedDraftId}
            activeTab={activeTab}
            loading={loading}
            error={error}
            selectedApplicationId={selectedApplicationId}
            selectedDraftId={selectedDraftId}
            pendingChangesApplicationIds={pendingChangesApplicationIds}
            onActiveTabChange={setActiveTab}
            onSelectApplication={onNavigateApplication}
            onSelectDraft={onNavigateDraft}
            onRetry={() => void refresh()}
          />
        </div>

        <DetailPanel
          application={selectedApplication}
          isArchived={selectedApplicationIsArchived}
          activeDraft={activeDraft}
          draftId={selectedDraftId}
          selectedDraftId={selectedDraftId}
          routeNotFound={routeNotFound}
          routeLoading={routeLoading}
          selectedChangeDraft={selectedChangeDraft}
          onApplicationMutated={handleDetailMutation}
          onDraftSaved={handleDraftSaved}
          onDraftDiscarded={handleDraftDiscarded}
          onDraftPatched={handleDraftPatched}
          onChangeDraftMutated={handleChangeDraftMutated}
        />
      </div>
    );
  }
);

export default ApplicationsPanel;
