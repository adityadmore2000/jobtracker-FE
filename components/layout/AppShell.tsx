"use client";

import { useCallback, useRef, useState } from "react";
import type { Application } from "@/lib/types";
import ChatPanel from "@/components/chat/ChatPanel";
import ApplicationsPanel, { type ApplicationsPanelHandle } from "@/components/applications/ApplicationsPanel";

export default function AppShell() {
  const [activeDraft, setActiveDraft] = useState<Partial<Application> | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const applicationsPanelRef = useRef<ApplicationsPanelHandle>(null);

  const onApplicationMutated = useCallback(() => {
    applicationsPanelRef.current?.refresh();
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <span className="font-medium">job tracker</span>
        <span className="text-xs text-muted-foreground">local · applications —</span>
      </header>

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <section className="w-72 shrink-0 border-r">
          <ChatPanel
            activeDraft={activeDraft}
            draftId={draftId}
            onActiveDraftChange={setActiveDraft}
            onDraftIdChange={setDraftId}
            onApplicationMutated={onApplicationMutated}
          />
        </section>

        <section className="min-w-0 flex-1">
          <ApplicationsPanel
            ref={applicationsPanelRef}
            activeDraft={activeDraft}
            draftId={draftId}
            onActiveDraftChange={setActiveDraft}
            onDraftIdChange={setDraftId}
          />
        </section>
      </main>
    </div>
  );
}
