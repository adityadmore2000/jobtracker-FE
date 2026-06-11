import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatPanel from "@/components/chat/ChatPanel";
import { SelectionProvider } from "@/lib/SelectionContext";
import type { Application, TranscriptResponse } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  submitTranscript: vi.fn(),
  fetchLiveKitToken: vi.fn(),
  deleteDraft: vi.fn(),
  restoreApplication: vi.fn(),
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
  onNavigateDraft: vi.fn(),
  onNavigateApplication: vi.fn(),
  onNavigateOverview: vi.fn(),
  onApplicationMutated: vi.fn(),
};

function makeResponse(overrides: Partial<TranscriptResponse> = {}): TranscriptResponse {
  return {
    status: "clarification",
    message: "Please clarify.",
    application_id: null,
    draft_id: null,
    draft: null,
    pending_changes: null,
    warnings: [],
    clarification_question: null,
    ...overrides,
  };
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

  it("draft_created navigates to /drafts/{id} and sets active draft", async () => {
    const onNavigateDraft = vi.fn();
    const onActiveDraftChange = vi.fn();
    const newDraft: Partial<Application> = { company: "Neilsoft", role: "AI Engineer" };
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_created",
      draft: newDraft as Application,
      draft_id: "new-id",
      message: "Draft created. Review it and save when ready.",
    }));
    renderPanel({ onNavigateDraft, onActiveDraftChange });
    await act(async () => { await submitText("Applied at Neilsoft"); });
    expect(onNavigateDraft).toHaveBeenCalledWith("new-id");
    expect(onActiveDraftChange).toHaveBeenCalledWith(newDraft);
  });

  it("draft_created appends draft summary message", async () => {
    const newDraft: Partial<Application> = { company: "Neilsoft", role: "AI Engineer" };
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_created",
      draft: newDraft as Application,
      draft_id: "id1",
      message: "Draft created. Review it and save when ready.",
    }));
    renderPanel();
    await act(async () => { await submitText("Applied at Neilsoft"); });
    expect(screen.getByText(/Draft: Neilsoft/)).toBeTruthy();
  });

  it("draft_created does not call table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_created",
      draft: null,
      draft_id: "id",
      message: "Draft created. Review it and save when ready.",
    }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("Applied at Neilsoft"); });
    expect(onApplicationMutated).not.toHaveBeenCalled();
  });

  it("draft_updated sets active draft and navigates when the id changes", async () => {
    const onNavigateDraft = vi.fn();
    const onActiveDraftChange = vi.fn();
    const updatedDraft: Partial<Application> = { company: "Updated Co", role: "ML Engineer" };
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_updated",
      draft: updatedDraft as Application,
      draft_id: "upd-id",
      message: "Draft updated.",
    }));
    renderPanel({ onNavigateDraft, onActiveDraftChange });
    await act(async () => { await submitText("update draft"); });
    expect(onNavigateDraft).toHaveBeenCalledWith("upd-id");
    expect(onActiveDraftChange).toHaveBeenCalledWith(updatedDraft);
  });

  it("draft_updated does not re-navigate when already on that draft route", async () => {
    const onNavigateDraft = vi.fn();
    const updatedDraft: Partial<Application> = { company: "Same Co", role: "ML Engineer" };
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_updated",
      draft: updatedDraft as Application,
      draft_id: "same-id",
      message: "Draft updated.",
    }));
    renderPanel({ onNavigateDraft, draftId: "same-id" });
    await act(async () => { await submitText("update draft"); });
    expect(onNavigateDraft).not.toHaveBeenCalled();
  });

  it("draft_updated does not call table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_updated",
      draft: null,
      draft_id: "id",
      message: "Draft updated.",
    }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("update"); });
    expect(onApplicationMutated).not.toHaveBeenCalled();
  });

  it("saved clears active draft and navigates to the saved application", async () => {
    const onNavigateApplication = vi.fn();
    const onActiveDraftChange = vi.fn();
    mockSubmit.mockResolvedValue(
      makeResponse({ status: "saved", message: "Application saved.", application_id: 77 })
    );
    renderPanel({ onNavigateApplication, onActiveDraftChange });
    await act(async () => { await submitText("save it"); });
    expect(onActiveDraftChange).toHaveBeenCalledWith(null);
    expect(onNavigateApplication).toHaveBeenCalledWith(77);
  });

  it("saved calls table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "saved", message: "Application saved." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("save it"); });
    expect(onApplicationMutated).toHaveBeenCalled();
  });

  it("discarded clears active draft and navigates to overview", async () => {
    const onNavigateOverview = vi.fn();
    const onActiveDraftChange = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "discarded", message: "Draft discarded." }));
    renderPanel({ onNavigateOverview, onActiveDraftChange });
    await act(async () => { await submitText("discard"); });
    expect(onActiveDraftChange).toHaveBeenCalledWith(null);
    expect(onNavigateOverview).toHaveBeenCalled();
  });

  it("discarded calls table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "discarded", message: "Draft discarded." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("discard"); });
    expect(onApplicationMutated).toHaveBeenCalled();
  });

  it("updated calls table refresh", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "updated", message: "Application updated." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("update status"); });
    expect(onApplicationMutated).toHaveBeenCalled();
  });

  it("clarification appends clarification question", async () => {
    mockSubmit.mockResolvedValue(makeResponse({
      status: "clarification",
      message: "",
      clarification_question: "Which company?",
    }));
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

  it("no_change displays backend message", async () => {
    mockSubmit.mockResolvedValue(makeResponse({ status: "no_change", message: "No change was made." }));
    renderPanel();
    await act(async () => { await submitText("something unclear"); });
    expect(screen.getByText("No change was made.")).toBeTruthy();
  });

  it("error displays backend message", async () => {
    mockSubmit.mockResolvedValue(makeResponse({ status: "error", message: "An error occurred." }));
    renderPanel();
    await act(async () => { await submitText("something"); });
    expect(screen.getByText("An error occurred.")).toBeTruthy();
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
    await act(async () => {
      fireEvent.click(screen.getByTestId("mic-button"));
    });
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("voice text");
  });

  it("draft_created seeds active draft and navigates to its route", async () => {
    const onActiveDraftChange = vi.fn();
    const onNavigateDraft = vi.fn();
    const newDraft: Partial<Application> = {
      company: "Neilsoft",
      role: "AI Engineer",
    };
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_created",
      draft: newDraft as Application,
      draft_id: "42",
      message: "Draft created. Review it and save when ready.",
    }));
    renderPanel({ onActiveDraftChange, onNavigateDraft });
    await act(async () => { await submitText("Applied for AI Engineer at Neilsoft"); });
    expect(onActiveDraftChange).toHaveBeenCalledWith(newDraft);
    expect(onNavigateDraft).toHaveBeenCalledWith("42");
  });
});

// ── pending_changes status handling ─────────────────────────────────────────
describe("pending_changes status handling", () => {
  const makeApp = (): Application => ({
    id: 5,
    company: "Test Corp",
    role: "Engineer",
    status: "applied",
    priority: "MEDIUM",
    location: "remote",
    job_link: "",
    employment_types: [],
    current_stages: [],
    engaged_days: 0,
    next_action: "",
    comments: "",
    is_draft: false,
    draft_created_at: null,
    archived_at: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  });

  it("shows system message for pending_changes_created", async () => {
    const app = makeApp();
    mockSubmit.mockResolvedValue(
      makeResponse({
        status: "pending_changes_created",
        message: "Changes staged for review.",
        pending_changes: {
          id: 99,
          kind: "update",
          target_application_id: app.id,
          original: app,
          preview: { ...app, status: "interviewing" },
          changed_fields: ["status"],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      })
    );
    renderPanel();
    await act(async () => { await submitText("Update status to interviewing"); });
    await waitFor(() => {
      expect(screen.getByText("Changes staged for review.")).toBeInTheDocument();
    });
  });

  it("shows system message for pending_changes_updated", async () => {
    const app = makeApp();
    mockSubmit.mockResolvedValue(
      makeResponse({
        status: "pending_changes_updated",
        message: "Pending changes updated.",
        pending_changes: {
          id: 99,
          kind: "update",
          target_application_id: app.id,
          original: app,
          preview: { ...app, priority: "HIGH" },
          changed_fields: ["priority"],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      })
    );
    renderPanel();
    await act(async () => { await submitText("Also set priority to high"); });
    await waitFor(() => {
      expect(screen.getByText("Pending changes updated.")).toBeInTheDocument();
    });
  });

  it("calls onApplicationMutated for changes_applied status", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "changes_applied", message: "Changes applied." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("Apply my pending changes"); });
    await waitFor(() => {
      expect(onApplicationMutated).toHaveBeenCalled();
    });
  });

  it("calls onApplicationMutated for changes_discarded status", async () => {
    const onApplicationMutated = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({ status: "changes_discarded", message: "Changes discarded." }));
    renderPanel({ onApplicationMutated });
    await act(async () => { await submitText("Discard my pending changes"); });
    await waitFor(() => {
      expect(onApplicationMutated).toHaveBeenCalled();
    });
  });

  // ── Collision recovery ──────────────────────────────────────────────────────

  const draftRow: Application = {
    id: 33, company: "Aiden AI", role: "AI Engineer", status: "", priority: "",
    location: "", job_link: "", employment_types: [], current_stages: [],
    engaged_days: 0, next_action: "", comments: "", is_draft: true,
    draft_created_at: null, archived_at: null,
    created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  };

  it("draft collision renders Open existing draft and Discard draft", async () => {
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_updated",
      message: "A draft already exists for Aiden AI · AI Engineer.",
      draft: draftRow,
      collision: { kind: "draft", draft_id: 33, application_id: null, company: "Aiden AI", role: "AI Engineer", archived: false },
    }));
    renderPanel();
    await act(async () => { await submitText("add application for AI Engineer at Aiden AI"); });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open existing draft" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Discard draft" })).toBeTruthy();
    });
  });

  it("clicking Open existing draft navigates to /drafts/{id}", async () => {
    const onActiveDraftChange = vi.fn();
    const onNavigateDraft = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_updated",
      message: "A draft already exists.",
      draft: draftRow,
      collision: { kind: "draft", draft_id: 33, application_id: null, company: "Aiden AI", role: "AI Engineer", archived: false },
    }));
    renderPanel({ onActiveDraftChange, onNavigateDraft });
    await act(async () => { await submitText("add application for AI Engineer at Aiden AI"); });
    const btn = await screen.findByRole("button", { name: "Open existing draft" });
    await act(async () => { fireEvent.click(btn); });
    expect(onNavigateDraft).toHaveBeenCalledWith("33");
    expect(onActiveDraftChange).toHaveBeenCalledWith(draftRow);
  });

  it("clicking Discard draft calls deleteDraft, navigates to overview, and mutates", async () => {
    const onApplicationMutated = vi.fn();
    const onNavigateOverview = vi.fn();
    vi.mocked(api.deleteDraft).mockResolvedValue(undefined);
    mockSubmit.mockResolvedValue(makeResponse({
      status: "draft_updated",
      message: "A draft already exists.",
      draft: draftRow,
      collision: { kind: "draft", draft_id: 33, application_id: null, company: "Aiden AI", role: "AI Engineer", archived: false },
    }));
    renderPanel({ onApplicationMutated, onNavigateOverview });
    await act(async () => { await submitText("add application for AI Engineer at Aiden AI"); });
    const btn = await screen.findByRole("button", { name: "Discard draft" });
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => {
      expect(api.deleteDraft).toHaveBeenCalledWith("33");
      expect(onNavigateOverview).toHaveBeenCalled();
      expect(onApplicationMutated).toHaveBeenCalled();
    });
  });

  it("active collision Open application navigates to /applications/{id}", async () => {
    const onNavigateApplication = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({
      status: "no_change",
      message: "An application already exists for Aiden AI · AI Engineer.",
      collision: { kind: "active_application", draft_id: null, application_id: 42, company: "Aiden AI", role: "AI Engineer", archived: false },
    }));
    renderPanel({ onNavigateApplication });
    await act(async () => { await submitText("add application for AI Engineer at Aiden AI"); });
    const btn = await screen.findByRole("button", { name: "Open application" });
    await act(async () => { fireEvent.click(btn); });
    expect(onNavigateApplication).toHaveBeenCalledWith(42);
  });

  it("archived collision renders Restore + Open archived application", async () => {
    mockSubmit.mockResolvedValue(makeResponse({
      status: "updated",
      message: "Existing archived application restored.",
      collision: { kind: "archived_application", draft_id: null, application_id: 42, company: "Aiden AI", role: "AI Engineer", archived: true },
    }));
    renderPanel();
    await act(async () => { await submitText("add application for AI Engineer at Aiden AI"); });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore application" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Open archived application" })).toBeTruthy();
    });
  });

  it("archived collision Open archived application navigates to /applications/{id}", async () => {
    const onNavigateApplication = vi.fn();
    mockSubmit.mockResolvedValue(makeResponse({
      status: "updated",
      message: "Existing archived application.",
      collision: { kind: "archived_application", draft_id: null, application_id: 42, company: "Aiden AI", role: "AI Engineer", archived: true },
    }));
    renderPanel({ onNavigateApplication });
    await act(async () => { await submitText("add application for AI Engineer at Aiden AI"); });
    const btn = await screen.findByRole("button", { name: "Open archived application" });
    await act(async () => { fireEvent.click(btn); });
    expect(onNavigateApplication).toHaveBeenCalledWith(42);
  });

  it("archived collision Restore restores then navigates to /applications/{id}", async () => {
    const onNavigateApplication = vi.fn();
    vi.mocked(api.restoreApplication).mockResolvedValue(undefined);
    mockSubmit.mockResolvedValue(makeResponse({
      status: "updated",
      message: "Existing archived application.",
      collision: { kind: "archived_application", draft_id: null, application_id: 42, company: "Aiden AI", role: "AI Engineer", archived: true },
    }));
    renderPanel({ onNavigateApplication });
    await act(async () => { await submitText("add application for AI Engineer at Aiden AI"); });
    const btn = await screen.findByRole("button", { name: "Restore application" });
    await act(async () => { fireEvent.click(btn); });
    await waitFor(() => {
      expect(api.restoreApplication).toHaveBeenCalledWith(42);
      expect(onNavigateApplication).toHaveBeenCalledWith(42);
    });
  });
});
