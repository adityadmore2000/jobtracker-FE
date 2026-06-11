import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AppShell from "@/components/layout/AppShell";
import { SelectionProvider, useSelection } from "@/lib/SelectionContext";
import type { Application } from "@/lib/types";

// next/navigation router — capture push/replace.
const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
}));

// VoiceButton uses livekit-client.
vi.mock("@/components/chat/VoiceButton", () => ({
  default: () => <button type="button" aria-label="Voice input" />,
}));

vi.mock("@/lib/api", () => ({
  fetchApplications: vi.fn(),
  fetchArchivedApplications: vi.fn(),
  fetchDrafts: vi.fn(),
  fetchApplication: vi.fn(),
  fetchDraft: vi.fn(),
  fetchNotes: vi.fn().mockResolvedValue([]),
  fetchTimeline: vi.fn().mockResolvedValue([]),
  submitTranscript: vi.fn(),
  patchDraft: vi.fn(),
  saveDraft: vi.fn(),
  deleteDraft: vi.fn(),
  updateApplication: vi.fn(),
}));

import * as api from "@/lib/api";

const makeApp = (id: number, overrides?: Partial<Application>): Application => ({
  id,
  company: `Company ${id}`,
  role: `Role ${id}`,
  status: "Applied",
  priority: "LOW",
  location: "remote",
  job_link: "",
  employment_types: ["Full Time"],
  current_stages: ["Applied"],
  engaged_days: 0,
  next_action: "",
  comments: "",
  is_draft: false,
  draft_created_at: null,
  archived_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

// Probe that surfaces the current SelectionContext value for assertions.
let lastSelection: ReturnType<typeof useSelection>["selection"] = null;
function SelectionProbe() {
  const { selection } = useSelection();
  lastSelection = selection;
  return null;
}

function renderShell(props: Parameters<typeof AppShell>[0] = {}) {
  return render(
    <SelectionProvider>
      <SelectionProbe />
      <AppShell {...props} />
    </SelectionProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  lastSelection = null;
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.fetchApplications).mockResolvedValue([makeApp(1)]);
  vi.mocked(api.fetchArchivedApplications).mockResolvedValue([
    makeApp(10, { company: "Archived Co", archived_at: "2024-06-01T00:00:00Z" }),
  ]);
  vi.mocked(api.fetchDrafts).mockResolvedValue([]);
  vi.mocked(api.fetchApplication).mockResolvedValue(makeApp(1));
  vi.mocked(api.fetchDraft).mockResolvedValue(
    makeApp(42, { company: "Draft Co", role: "Draft Role", is_draft: true })
  );
});

describe("AppShell — /applications overview", () => {
  it("renders the overview and leaves SelectionContext null", async () => {
    renderShell();
    await waitFor(() => expect(screen.getByText("Company 1")).toBeInTheDocument());
    expect(lastSelection).toBeNull();
  });
});

describe("AppShell — /applications/{id}", () => {
  it("sets SelectionContext to the application and opens its detail", async () => {
    renderShell({ routeApplicationId: 1 });
    await waitFor(() =>
      expect(screen.getByText("Company 1 — Role 1")).toBeInTheDocument()
    );
    expect(lastSelection).toEqual({ kind: "application", applicationId: 1 });
  });

  it("archived application opens with a Restore action", async () => {
    renderShell({ routeApplicationId: 10 });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument()
    );
    expect(lastSelection).toEqual({ kind: "application", applicationId: 10 });
  });

  it("missing application shows not-found", async () => {
    vi.mocked(api.fetchApplication).mockRejectedValue(new Error("Application not found"));
    renderShell({ routeApplicationId: 999999 });
    await waitFor(() =>
      expect(screen.getByText("Application not found")).toBeInTheDocument()
    );
  });
});

describe("AppShell — /drafts/{id}", () => {
  it("sets SelectionContext to the draft and opens draft-edit mode", async () => {
    renderShell({ routeDraftId: "42" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save Application" })).toBeInTheDocument()
    );
    expect(lastSelection).toEqual({ kind: "draft", draftId: "42" });
    expect(api.fetchDraft).toHaveBeenCalledWith("42");
  });

  it("missing draft shows Draft not found", async () => {
    vi.mocked(api.fetchDraft).mockRejectedValue(new Error("Draft 999999 not found"));
    renderShell({ routeDraftId: "999999" });
    await waitFor(() =>
      expect(screen.getByText("Draft not found")).toBeInTheDocument()
    );
  });

  it("non-draft id shows Not a draft application", async () => {
    vi.mocked(api.fetchDraft).mockRejectedValue(new Error("Application 5 is not a draft"));
    renderShell({ routeDraftId: "5" });
    await waitFor(() =>
      expect(screen.getByText("Not a draft application")).toBeInTheDocument()
    );
  });
});
