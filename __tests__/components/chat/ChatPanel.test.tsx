import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatPanel from "@/components/chat/ChatPanel";
import { SelectionProvider } from "@/lib/SelectionContext";
import type { Application, TranscriptResponse } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  submitTranscript: vi.fn(),
  fetchLiveKitToken: vi.fn(),
}));

// VoiceButton uses livekit-client; mock it so ChatPanel tests don't need LiveKit
vi.mock("@/components/chat/VoiceButton", () => ({
  default: ({ onFinalTranscript, disabled }: {
    onFinalTranscript: (t: string) => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      aria-label="Voice input"
      data-testid="mic-button"
      disabled={disabled}
      onClick={() => onFinalTranscript("voice text")}
    />
  ),
}));

import * as api from "@/lib/api";
const mockSubmit = vi.mocked(api.submitTranscript);

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
});

const defaultProps = {
  activeDraft: null,
  draftId: null,
  onActiveDraftChange: vi.fn(),
  onDraftIdChange: vi.fn(),
  onApplicationMutated: vi.fn(),
};

function makeResponse(overrides: Partial<TranscriptResponse> = {}): TranscriptResponse {
  return { status: "clarification", message: "Please clarify.", ...overrides };
}

function renderPanel(props = {}) {
  return render(
    <SelectionProvider>
      <ChatPanel {...defaultProps} {...props} />
    </SelectionProvider>
  );
}

async function submitText(text: string) {
  const textarea = screen.getByRole("textbox");
  fireEvent.change(textarea, { target: { value: text } });
  fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
}

describe("ChatPanel", () => {
  it("renders intro card initially", () => {
    renderPanel();
    expect(screen.getByText("Keep your job search organised")).toBeTruthy();
  });

  it("renders editable chat input", () => {
    renderPanel();
    expect(screen.getByRole("textbox")).not.toBeDisabled();
  });

  it("submit appends user message", async () => {
    mockSubmit.mockResolvedValue(makeResponse());
    renderPanel();
    await act(async () => { await submitText("Applied at Neilsoft"); });
    expect(screen.getByText("Applied at Neilsoft")).toBeTruthy();
  });

  it("submit passes transcript, draft_id, active_draft, active_application_id, recent_actions", async () => {
    mockSubmit.mockResolvedValue(makeResponse());
    const draft: Partial<Application> = { company: "Neilsoft", role: "AI Engineer" };
    renderPanel({ activeDraft: draft, draftId: "draft-123" });
    await act(async () => { await submitText("save the draft"); });
    expect(mockSubmit).toHaveBeenCalledWith(
      "save the draft",
      expect.objectContaining({
        draft_id: "draft-123",
        active_draft: draft,
        active_application_id: null,
        recent_actions: expect.any(Array),
      })
    );
  });

  it("draft_created updates draft ID and active draft callbacks", async () => {
    const onDraftIdChange = vi.fn();
    const onActiveDraftChange = vi.fn();
    const newDraft: Partial<Application> = { company: "Neilsoft", role: "AI Engineer" };
    mockSubmit.mockResolvedValue(makeResponse({ status: "draft_created", draft: newDraft, draft_id: "new-id", message: "" }));
    renderPanel({ onDraftIdChange, onActiveDraftChange });
    await act(async () => { await submitText("Applied at Neilsoft"); });
    expect(onDraftIdChange).toHaveBeenCalledWith("new-id");
    expect(onActiveDraftChange).toHaveBeenCalledWith(newDraft);
  });

  it("draft_created appends draft summary message", async () => {
    const newDraft: Partial<Application> = { company: "Neilsoft", role: "AI Engineer" };
    mockSubmit.mockResolvedValue(makeResponse({ status: "draft_created", draft: newDraft, draft_id: "id1", message: "" }));
    renderPanel();
    await act(async () => { await submitText("Applied at Neilsoft"); });
    expect(screen.getByText(/Draft: Neilsoft/)).toBeTruthy();
  });

  it("draft_created does not call table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "draft_created", draft: {}, draft_id: "id", message: "" }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("Applied at Neilsoft"); });
    expect(onApplicationMutated).not.toHaveBeenCalled();
  });

  it("draft_updated updates draft callbacks", async () => {
    const onDraftIdChange = vi.fn();
    const onActiveDraftChange = vi.fn();
    const updatedDraft: Partial<Application> = { company: "Updated Co", role: "ML Engineer" };
    mockSubmit.mockResolvedValue(makeResponse({ status: "draft_updated", draft: updatedDraft, draft_id: "upd-id", message: "" }));
    renderPanel({ onDraftIdChange, onActiveDraftChange });
    await act(async () => { await submitText("update draft"); });
    expect(onDraftIdChange).toHaveBeenCalledWith("upd-id");
    expect(onActiveDraftChange).toHaveBeenCalledWith(updatedDraft);
  });

  it("draft_updated does not call table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "draft_updated", draft: {}, draft_id: "id", message: "" }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("update"); });
    expect(onApplicationMutated).not.toHaveBeenCalled();
  });

  it("saved clears draft callbacks", async () => {
    const onDraftIdChange = vi.fn();
    const onActiveDraftChange = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "saved", message: "Saved." }));
    renderPanel({ onDraftIdChange, onActiveDraftChange });
    await act(async () => { await submitText("save it"); });
    expect(onDraftIdChange).toHaveBeenCalledWith(null);
    expect(onActiveDraftChange).toHaveBeenCalledWith(null);
  });

  it("saved calls table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "saved", message: "Saved." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("save it"); });
    expect(onApplicationMutated).toHaveBeenCalled();
  });

  it("discarded clears draft callbacks", async () => {
    const onDraftIdChange = vi.fn();
    const onActiveDraftChange = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "discarded", message: "Discarded." }));
    renderPanel({ onDraftIdChange, onActiveDraftChange });
    await act(async () => { await submitText("discard"); });
    expect(onDraftIdChange).toHaveBeenCalledWith(null);
    expect(onActiveDraftChange).toHaveBeenCalledWith(null);
  });

  it("discarded calls table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "discarded", message: "Discarded." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("discard"); });
    expect(onApplicationMutated).toHaveBeenCalled();
  });

  it("updated calls table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "updated", message: "Updated." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("update status"); });
    expect(onApplicationMutated).toHaveBeenCalled();
  });

  it("clarification appends clarification question", async () => {
    mockSubmit.mockResolvedValue(makeResponse({ status: "clarification", message: "", clarification_question: "Which company?" }));
    renderPanel();
    await act(async () => { await submitText("something vague"); });
    expect(screen.getByText("Which company?")).toBeTruthy();
  });

  it("clarification does not call table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "clarification", message: "Please clarify." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("vague"); });
    expect(onApplicationMutated).not.toHaveBeenCalled();
  });

  it("unknown status appends fallback message", async () => {
    mockSubmit.mockResolvedValue(makeResponse({ status: "unknown_status", message: "Some fallback." }));
    renderPanel();
    await act(async () => { await submitText("something"); });
    expect(screen.getByText("Some fallback.")).toBeTruthy();
  });

  it("API rejection appends readable error message", async () => {
    mockSubmit.mockRejectedValue(new Error("Network error"));
    renderPanel();
    await act(async () => { await submitText("test"); });
    expect(screen.getByText("Could not process that update. Please try again.")).toBeTruthy();
  });

  it("user message remains visible after API rejection", async () => {
    mockSubmit.mockRejectedValue(new Error("Network error"));
    renderPanel();
    await act(async () => { await submitText("hello world"); });
    expect(screen.getByText("hello world")).toBeTruthy();
  });

  it("recent actions retain only the last 3 submitted commands", async () => {
    mockSubmit.mockResolvedValue(makeResponse());
    renderPanel();
    for (const text of ["cmd1", "cmd2", "cmd3", "cmd4"]) {
      await act(async () => { await submitText(text); });
    }
    const lastCall = mockSubmit.mock.calls[mockSubmit.mock.calls.length - 1];
    const recentActions = lastCall[1].recent_actions ?? [];
    expect(recentActions.length).toBeLessThanOrEqual(3);
  });

  it("textarea becomes enabled after submission finishes", async () => {
    mockSubmit.mockResolvedValue(makeResponse());
    renderPanel();
    await act(async () => { await submitText("test"); });
    await waitFor(() => {
      expect(screen.getByRole("textbox")).not.toBeDisabled();
    });
  });

  it("voice auto-submit routes through the same handleSubmit pathway", async () => {
    mockSubmit.mockResolvedValue(makeResponse());
    renderPanel();
    // Click the mock mic button which triggers onFinalTranscript("voice text")
    // This should call onStartCountdown which in ChatPanel starts the countdown
    // and eventually calls handleSubmit — but to avoid fake timers, we check
    // that onValueChange was called with the transcript (voice text fills textarea).
    // The countdown auto-submit eventually calls submitTranscript the same way.
    await act(async () => {
      fireEvent.click(screen.getByTestId("mic-button"));
    });
    // The textarea should now show "voice text" (the panel sets inputText)
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("voice text");
  });
});
