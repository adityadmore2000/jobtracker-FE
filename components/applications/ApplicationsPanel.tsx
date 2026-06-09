"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from "react";
import type { Application } from "@/lib/types";
import { fetchApplications, fetchArchivedApplications } from "@/lib/api";
import { useSelection } from "@/lib/SelectionContext";
import ApplicationsTable from "./ApplicationsTable";

export type ApplicationsPanelHandle = {
  refresh: () => void;
};

type ApplicationsPanelProps = {
  activeDraft: Partial<Application> | null;
  draftId: string | null;
};

const ApplicationsPanel = forwardRef<ApplicationsPanelHandle, ApplicationsPanelProps>(
  function ApplicationsPanel({ activeDraft }, ref) {
    const [applications, setApplications] = useState<Application[]>([]);
    const [archived, setArchived] = useState<Application[]>([]);
    const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { selectedApplicationId, setSelectedApplicationId } = useSelection();

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

    return (
      <div className="flex h-full flex-col overflow-hidden">
        <ApplicationsTable
          applications={applications}
          archived={archived}
          activeDraft={activeDraft}
          activeTab={activeTab}
          loading={loading}
          error={error}
          selectedApplicationId={selectedApplicationId}
          onActiveTabChange={setActiveTab}
          onSelectApplication={setSelectedApplicationId}
          onRetry={() => void refresh()}
        />
      </div>
    );
  }
);

export default ApplicationsPanel;
