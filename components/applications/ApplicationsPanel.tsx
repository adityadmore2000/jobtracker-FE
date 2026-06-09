"use client";

import { forwardRef, useImperativeHandle } from "react";
import type { Application } from "@/lib/types";

export type ApplicationsPanelHandle = {
  refresh: () => void;
};

type ApplicationsPanelProps = {
  activeDraft: Partial<Application> | null;
  draftId: string | null;
};

const ApplicationsPanel = forwardRef<ApplicationsPanelHandle, ApplicationsPanelProps>(
  function ApplicationsPanel(_props, ref) {
    useImperativeHandle(
      ref,
      () => ({
        refresh() {
          // Implemented in Phase 3C.
        },
      }),
      []
    );

    return null;
  }
);

export default ApplicationsPanel;
