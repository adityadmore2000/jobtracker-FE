"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import type { Application } from "@/lib/types";
import { fetchApplications, fetchArchivedApplications } from "@/lib/api";
import { useSelection } from "@/lib/SelectionContext";
import ApplicationsTable from "./ApplicationsTable";
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
    const [archived, setArchived] = useState<Application[]>([]);
    const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { selection, setSelection, selectedApplicationId, setSelectedApplicationId } =
      useSelection();

    const selectedDraftId =
      selection?.kind === "draft" ? selection.draftId : null;

    const refresh = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const [active, arch] = await Promise.all([
          fetchApplications(),
          fetchArchivedApplications(),
        ]);
        setApplications(active);
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
      },
      [onActiveDraftChange, onDraftIdChange, setSelection]
    );

    const handleDraftDiscarded = useCallback(() => {
      onActiveDraftChange(null);
      onDraftIdChange(null);
      setSelection(null);
    }, [onActiveDraftChange, onDraftIdChange, setSelection]);

    const handleDraftPatched = useCallback(
      (updatedDraft: Application) => {
        onActiveDraftChange(updatedDraft);
      },
      [onActiveDraftChange]
    );

    const handleSelectDraft = useCallback(
      (id: string) => {
        setSelection({ kind: "draft", draftId: id });
      },
      [setSelection]
    );

    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-hidden">
          <ApplicationsTable
            applications={applications}
            archived={archived}
            activeDraft={activeDraft}
            draftId={draftId}
            activeTab={activeTab}
            loading={loading}
            error={error}
            selectedApplicationId={selectedApplicationId}
            selectedDraftId={selectedDraftId}
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
          onApplicationMutated={handleDetailMutation}
          onDraftSaved={handleDraftSaved}
          onDraftDiscarded={handleDraftDiscarded}
          onDraftPatched={handleDraftPatched}
        />
      </div>
    );
  }
);

export default ApplicationsPanel;
