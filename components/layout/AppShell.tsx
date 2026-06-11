"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Application } from "@/lib/types";
import { fetchApplication, fetchDraft } from "@/lib/api";
import { useSelection } from "@/lib/SelectionContext";
import ChatPanel from "@/components/chat/ChatPanel";
import ApplicationsPanel, { type ApplicationsPanelHandle } from "@/components/applications/ApplicationsPanel";

type AppShellProps = {
  // URL is the canonical record identity. Exactly one of these is set per route.
  routeApplicationId?: number | null;
  routeDraftId?: string | null;
};

type RouteLoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "not_found"; message: string };

export default function AppShell({
  routeApplicationId = null,
  routeDraftId = null,
}: AppShellProps) {
  const router = useRouter();
  const { setSelection } = useSelection();

  // activeDraft holds the fetched/edited draft object. draftId is derived from
  // the URL — never set independently — so the dual-selection desync that broke
  // draft discard cannot recur.
  const [activeDraft, setActiveDraft] = useState<Partial<Application> | null>(null);
  const [routeState, setRouteState] = useState<RouteLoadState>({ kind: "idle" });
  const applicationsPanelRef = useRef<ApplicationsPanelHandle>(null);

  const onApplicationMutated = useCallback(() => {
    applicationsPanelRef.current?.refresh();
  }, []);

  // ── URL → SelectionContext synchronization ────────────────────────────────
  // The route param is the single source of truth. On every route change we
  // (1) set the derived SelectionContext used by ChatPanel transcript context,
  // and (2) fetch the addressed record, surfacing not-found / wrong-type.
  useEffect(() => {
    let cancelled = false;

    if (routeDraftId != null) {
      setSelection({ kind: "draft", draftId: routeDraftId });
      setRouteState({ kind: "loading" });
      void fetchDraft(routeDraftId)
        .then((draft) => {
          if (cancelled) return;
          setActiveDraft(draft);
          setRouteState({ kind: "ready" });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setActiveDraft(null);
          const message =
            err instanceof Error && /not a draft/i.test(err.message)
              ? "Not a draft application"
              : "Draft not found";
          setRouteState({ kind: "not_found", message });
        });
      return () => {
        cancelled = true;
      };
    }

    if (routeApplicationId != null) {
      setSelection({ kind: "application", applicationId: routeApplicationId });
      setActiveDraft(null);
      setRouteState({ kind: "loading" });
      void fetchApplication(routeApplicationId)
        .then(() => {
          if (cancelled) return;
          setRouteState({ kind: "ready" });
        })
        .catch(() => {
          if (cancelled) return;
          setRouteState({ kind: "not_found", message: "Application not found" });
        });
      return () => {
        cancelled = true;
      };
    }

    // Overview route (/applications): clear selected detail state.
    setSelection(null);
    setActiveDraft(null);
    setRouteState({ kind: "idle" });
    return () => {
      cancelled = true;
    };
  }, [routeApplicationId, routeDraftId, setSelection]);

  // ── Navigation helpers (URL is canonical) ─────────────────────────────────
  const navigateToApplication = useCallback(
    (id: number) => router.push(`/applications/${id}`),
    [router]
  );
  const navigateToDraft = useCallback(
    (id: string) => router.push(`/drafts/${id}`),
    [router]
  );
  const navigateToOverview = useCallback(
    (replace = false) =>
      replace ? router.replace("/applications") : router.push("/applications"),
    [router]
  );

  const routeNotFound =
    routeState.kind === "not_found" ? routeState.message : null;
  // A direct /drafts/{id} visit must show a loading placeholder until the draft
  // resolves — before that, activeDraft is null and the draft-edit mode can't render.
  const routeLoading = routeState.kind === "loading" && routeDraftId != null;

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
            draftId={routeDraftId}
            onActiveDraftChange={setActiveDraft}
            onNavigateDraft={navigateToDraft}
            onNavigateApplication={navigateToApplication}
            onNavigateOverview={navigateToOverview}
            onApplicationMutated={onApplicationMutated}
          />
        </section>

        <section className="min-w-0 flex-1">
          <ApplicationsPanel
            ref={applicationsPanelRef}
            activeDraft={activeDraft}
            routeApplicationId={routeApplicationId}
            routeDraftId={routeDraftId}
            routeNotFound={routeNotFound}
            routeLoading={routeLoading}
            onActiveDraftChange={setActiveDraft}
            onNavigateApplication={navigateToApplication}
            onNavigateDraft={navigateToDraft}
            onNavigateOverview={navigateToOverview}
          />
        </section>
      </main>
    </div>
  );
}
