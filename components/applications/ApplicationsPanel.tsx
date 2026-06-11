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
  draftId: string | null;
  onActiveDraftChange: (draft: Partial<Application> | null) => void;
  onDraftIdChange: (draftId: string | null) => void;
};

const ApplicationsPanel = forwardRef<ApplicationsPanelHandle, ApplicationsPanelProps>(
  function ApplicationsPanel({ activeDraft, draftId, onActiveDraftChange, onDraftIdChange }, ref) {
    const [applications, setApplications] = useState<Application[]>([]);
    const [drafts, setDrafts] = useState<Application[]>([]);
    const [archived, setArchived] = useState<Application[]>([]);
    const [activeTab, setActiveTab] = useState<ApplicationsTab>("active");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingChangeDrafts, setPendingChangeDrafts] = useState<Map<number, ApplicationChangeDraft>>(new Map());

    const { selection, setSelection, selectedApplicationId, setSelectedApplicationId } =
      useSelection();

    const selectedDraftId =
      selection?.kind === "draft" ? selection.draftId : null;

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
      setSelectedApplicationId(null);
    }, [refresh, setSelectedApplicationId]);

    const handleDraftSaved = useCallback(
      (savedApp: Application) => {
        onActiveDraftChange(null);
        onDraftIdChange(null);
        setSelection(null);
        setApplications((prev) => [savedApp, ...prev]);
        // Saved draft must leave the Drafts tab and appear under Active.
        void refresh();
      },
      [onActiveDraftChange, onDraftIdChange, setSelection, refresh]
    );

    const handleDraftDiscarded = useCallback(() => {
      onActiveDraftChange(null);
      onDraftIdChange(null);
      setSelection(null);
      // Discarded draft must leave the Drafts tab.
      void refresh();
    }, [onActiveDraftChange, onDraftIdChange, setSelection, refresh]);

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

    const handleSelectDraft = useCallback(
      (id: string) => {
        setSelection({ kind: "draft", draftId: id });
        // Selecting a persisted draft must populate draft_id + activeDraft for
        // DetailPanel's draft-edit mode — and must NOT set active_application_id.
        const persisted = drafts.find((d) => String(d.id) === id);
        if (persisted) {
          onActiveDraftChange(persisted);
          onDraftIdChange(id);
        }
      },
      [setSelection, drafts, onActiveDraftChange, onDraftIdChange]
    );

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <ApplicationsTable
            applications={applications}
            drafts={drafts}
            archived={archived}
            activeDraft={activeDraft}
            draftId={draftId}
            activeTab={activeTab}
            loading={loading}
            error={error}
            selectedApplicationId={selectedApplicationId}
            selectedDraftId={selectedDraftId}
            pendingChangesApplicationIds={pendingChangesApplicationIds}
            onActiveTabChange={setActiveTab}
            onSelectApplication={setSelectedApplicationId}
            onSelectDraft={handleSelectDraft}
            onRetry={() => void refresh()}
          />
        </div>

        <DetailPanel
          application={selectedApplication}
          isArchived={selectedApplicationIsArchived}
          activeDraft={activeDraft}
          draftId={draftId}
          selectedDraftId={selectedDraftId}
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
