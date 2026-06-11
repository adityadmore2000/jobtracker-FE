"use client";

import { useState, useRef } from "react";
import type {
  Application,
  ChatMessage,
  ChatMessageAction,
  PendingCommand,
  TranscriptCollision,
  TranscriptContext,
  TranscriptResponse,
} from "@/lib/types";
import { discardDraft, restoreApplication, submitTranscript } from "@/lib/api";
import { useSelection } from "@/lib/SelectionContext";
import type { SelectedTrackerItem } from "@/lib/SelectionContext";
import ChatFeed from "./ChatFeed";
import ChatInput from "./ChatInput";

type ChatPanelProps = {
  activeDraft: Partial<Application> | null;
  draftId: string | null;
  onActiveDraftChange: (draft: Partial<Application> | null) => void;
  onDraftIdChange: (draftId: string | null) => void;
  onApplicationMutated: () => void;
};

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeMessage(
  role: ChatMessage["role"],
  text: string,
  extra?: { suggestions?: string[]; actions?: ChatMessageAction[] },
): ChatMessage {
  return {
    id: makeId(),
    role,
    text,
    timestamp: new Date().toISOString(),
    suggestions: extra?.suggestions,
    actions: extra?.actions,
  };
}

function collisionActions(collision: TranscriptCollision): ChatMessageAction[] {
  if (collision.kind === "draft") {
    return [
      { label: "Open existing draft", kind: "open_draft", draftId: collision.draft_id },
      { label: "Discard draft", kind: "discard_draft", draftId: collision.draft_id },
    ];
  }
  if (collision.kind === "archived_application") {
    return [
      { label: "Restore application", kind: "restore_application", applicationId: collision.application_id },
      { label: "Open archived application", kind: "open_archived_application", applicationId: collision.application_id },
    ];
  }
  return [{ label: "Open application", kind: "open_application", applicationId: collision.application_id }];
}

function buildDraftSummary(draft?: Partial<Application>): string {
  if (!draft) return "Draft active.";
  const parts = [
    draft.company,
    draft.role || null,
    draft.location,
    draft.priority ? `${draft.priority} priority` : null,
    draft.status,
  ].filter(Boolean);
  return `Draft: ${parts.join(" · ")}`;
}

export default function ChatPanel({
  activeDraft,
  draftId,
  onActiveDraftChange,
  onDraftIdChange,
  onApplicationMutated,
}: ChatPanelProps) {
  const { selectedApplicationId, setSelection } = useSelection();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [inputText, setInputText] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // pending_command: echoed back to next request for clarification continuation
  const [pendingCommand, setPendingCommand] = useState<PendingCommand | null>(null);
  // Holds the existing draft row returned with a draft collision so "Open
  // existing draft" can populate editor state without re-fetching.
  const lastCollisionDraftRef = useRef<Application | null>(null);

  function append(...msgs: ChatMessage[]) {
    setMessages((prev) => [...prev, ...msgs]);
  }

  async function handleAction(action: ChatMessageAction): Promise<void> {
    if (action.kind === "open_draft" && action.draftId != null) {
      const id = String(action.draftId);
      const draftRow = lastCollisionDraftRef.current;
      if (draftRow) onActiveDraftChange(draftRow);
      onDraftIdChange(id);
      setSelection({ kind: "draft", draftId: id });
      append(makeMessage("system", "Opened the existing draft."));
      return;
    }
    if (action.kind === "discard_draft" && action.draftId != null) {
      try {
        await discardDraft(String(action.draftId));
        onActiveDraftChange(null);
        onDraftIdChange(null);
        setSelection(null);
        append(makeMessage("system", "Draft discarded. You can create it again now."));
        onApplicationMutated();
      } catch {
        append(makeMessage("system", "Could not discard the draft. Please try again."));
      }
      return;
    }
    if (
      (action.kind === "open_application" || action.kind === "open_archived_application") &&
      action.applicationId != null
    ) {
      setSelection({ kind: "application", applicationId: action.applicationId });
      append(makeMessage("system", "Opened the existing application."));
      return;
    }
    if (action.kind === "restore_application" && action.applicationId != null) {
      try {
        await restoreApplication(action.applicationId);
        setSelection({ kind: "application", applicationId: action.applicationId });
        append(makeMessage("system", "Application restored."));
        onApplicationMutated();
      } catch {
        append(makeMessage("system", "Could not restore the application. Please try again."));
      }
      return;
    }
  }

  function handleResponse(response: TranscriptResponse, text: string) {
    const { status } = response;

    // Collision: a create command hit an existing row. Surface recovery actions
    // instead of silently opening/reapplying. Stash the existing row so the
    // "open" actions can populate state without an extra fetch.
    if (response.collision) {
      setPendingCommand(null);
      if (response.collision.kind === "draft" && response.draft) {
        lastCollisionDraftRef.current = response.draft;
      }
      append(makeMessage("system", response.message, { actions: collisionActions(response.collision) }));
      return;
    }

    // Clear pending_command on success, error, or explicit cancel
    if (
      status !== "clarification" &&
      status !== "no_change" &&
      status !== "error" &&
      status !== "unsupported"
    ) {
      setPendingCommand(null);
    }

    if (status === "draft_created" || status === "draft_updated") {
      onDraftIdChange(response.draft_id ?? draftId);
      onActiveDraftChange(response.draft ?? activeDraft);
      append(makeMessage("draft", buildDraftSummary(response.draft ?? activeDraft ?? undefined)));
      append(makeMessage("system", response.message));
      return;
    }

    if (status === "saved") {
      onDraftIdChange(null);
      onActiveDraftChange(null);
      append(makeMessage("system", response.message));
      onApplicationMutated();
      return;
    }

    if (status === "discarded") {
      onDraftIdChange(null);
      onActiveDraftChange(null);
      append(makeMessage("system", response.message));
      onApplicationMutated();
      return;
    }

    if (status === "updated") {
      append(makeMessage("system", response.message));
      onApplicationMutated();
      return;
    }

    if (status === "pending_changes_created" || status === "pending_changes_updated") {
      append(makeMessage("system", response.message));
      if (response.pending_changes) {
        const newSelection: SelectedTrackerItem = {
          kind: "pending_changes",
          changeDraftId: response.pending_changes.id,
        };
        setSelection(newSelection);
      }
      return;
    }

    if (status === "changes_applied" || status === "changes_discarded") {
      append(makeMessage("system", response.message));
      setSelection(null);
      onApplicationMutated();
      return;
    }

    if (status === "note_added") {
      const noteText = response.note ? `"${response.note.text}"` : "";
      const msg = noteText ? `${response.message} ${noteText}` : response.message;
      append(makeMessage("system", msg));
      // If note was attached to a draft, refresh draft view
      if (response.draft) {
        onActiveDraftChange(response.draft);
        if (response.draft_id) onDraftIdChange(response.draft_id);
      }
      onApplicationMutated();
      return;
    }

    if (status === "application_archived" || status === "application_restored") {
      append(makeMessage("system", response.message));
      onApplicationMutated();
      return;
    }

    if (status === "context_updated") {
      // "update application for X" — set the active selected application context
      if (response.application_id != null) {
        setSelection({ kind: "application", applicationId: response.application_id });
      }
      append(makeMessage("system", response.message));
      return;
    }

    if (status === "clarification") {
      // Store pending_command for next request
      if (response.pending_command) {
        setPendingCommand(response.pending_command);
      }
      append(makeMessage("system", response.clarification_question || response.message));
      return;
    }

    if (status === "unsupported") {
      setPendingCommand(null);
      const message = response.clarification_question
        ? `${response.message}\nDid you mean: ${response.clarification_question}`
        : response.message;
      append(makeMessage("system", message, { suggestions: response.suggested_phrasings ?? undefined }));
      return;
    }

    // no_change or error: show backend message
    void text;
    append(makeMessage("system", response.message));
  }

  async function handleSubmit(text: string): Promise<void> {
    append(makeMessage("user", text));

    const context: TranscriptContext = {
      draft_id: draftId ?? undefined,
      active_draft: activeDraft ?? undefined,
      active_application_id: selectedApplicationId,
      recent_actions: recentActions,
      pending_command: pendingCommand,
    };

    setSubmitting(true);
    try {
      const response = await submitTranscript(text, context);
      handleResponse(response, text);
      setRecentActions((prev) => [...prev.slice(-2), text]);
    } catch {
      append(makeMessage("system", "Could not process that update. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  function clearCountdownTimer() {
    if (countdownTimerRef.current !== null) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }

  function handleStartCountdown(text: string) {
    clearCountdownTimer();
    setCountdown(2);
    countdownTimerRef.current = setTimeout(() => {
      setCountdown(1);
      countdownTimerRef.current = setTimeout(() => {
        setCountdown(null);
        setInputText("");
        void handleSubmit(text);
      }, 1000);
    }, 1000);
  }

  function handleCountdownChange(value: number | null) {
    if (value === null) {
      clearCountdownTimer();
    }
    setCountdown(value);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b px-3 py-2">
        <p className="text-sm font-semibold">Updates</p>
        <p className="text-xs text-muted-foreground">Type naturally. Your changes stay local.</p>
      </div>

      <ChatFeed
        messages={messages}
        onSuggestionClick={(phrase) => {
          // Clicking a chip is explicit user confirmation: resend as a new transcript.
          if (!submitting) void handleSubmit(phrase);
        }}
        onActionClick={(action) => {
          void handleAction(action);
        }}
      />

      <ChatInput
        value={inputText}
        onValueChange={setInputText}
        submitting={submitting}
        onSubmit={handleSubmit}
        countdown={countdown}
        onCountdownChange={handleCountdownChange}
        onStartCountdown={handleStartCountdown}
      />
    </div>
  );
}
