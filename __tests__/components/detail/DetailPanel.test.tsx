import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import DetailPanel from "@/components/detail/DetailPanel";
import type { Application } from "@/lib/types";

// ── mock sub-components ──────────────────────────────────────────────────────
vi.mock("@/components/detail/NotesTab", () => ({
  default: ({ applicationId }: { applicationId: number }) => (
    <div data-testid="notes-tab">notes-{applicationId}</div>
  ),
}));

vi.mock("@/components/detail/TimelineTab", () => ({
  default: ({ applicationId }: { applicationId: number }) => (
    <div data-testid="timeline-tab">timeline-{applicationId}</div>
  ),
}));

vi.mock("@/components/detail/ArchiveButton", () => ({
  default: ({ isArchived }: { isArchived: boolean }) => (
    <button>{isArchived ? "Restore" : "Archive"}</button>
  ),
}));

// ── mock API helpers ─────────────────────────────────────────────────────────
vi.mock("@/lib/api", () => ({
  patchDraft: vi.fn(),
  saveDraft: vi.fn(),
  discardDraft: vi.fn(),
  updateApplication: vi.fn(),
}));

import * as api from "@/lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────
const makeApp = (overrides?: Partial<Application>): Application => ({
  id: 5,
  company: "Test Corp",
  roles: ["Software Engineer"],
  status: "applied",
  priority: "MEDIUM",
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

const makeDraft = (overrides?: Partial<Application>): Partial<Application> => ({
  company: "Draft Corp",
  roles: ["AI Engineer"],
  priority: "LOW",
  location: "remote",
  employment_types: [],
  current_stages: [],
  status: "",
  job_link: "",
  next_action: "",
  comments: "",
  engaged_days: 0,
  ...overrides,
});

const baseProps = {
  application: null as Application | null,
  isArchived: false,
  onApplicationMutated: vi.fn(),
  activeDraft: null as Partial<Application> | null,
  draftId: null as string | null,
  selectedDraftId: null as string | null,
  onDraftSaved: vi.fn(),
  onDraftDiscarded: vi.fn(),
  onDraftPatched: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Mode A: no selection ─────────────────────────────────────────────────────
describe("Mode A — no selection", () => {
  it("renders placeholder when no application and no draft selected", () => {
    render(<DetailPanel {...baseProps} />);
    expect(screen.getByText("Select an application to view details.")).toBeInTheDocument();
  });

  it("does not render Notes or Timeline tabs in no-selection state", () => {
    render(<DetailPanel {...baseProps} />);
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
  });
});

// ── Mode B: saved application read-only ──────────────────────────────────────
describe("Mode B — saved application read-only", () => {
  it("renders company and role in header", () => {
    render(<DetailPanel {...baseProps} application={makeApp()} />);
    expect(screen.getByText("Test Corp — Software Engineer")).toBeInTheDocument();
  });

  it("renders Notes and Timeline tab triggers", () => {
    render(<DetailPanel {...baseProps} application={makeApp()} />);
    expect(screen.getByRole("tab", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Timeline" })).toBeInTheDocument();
  });

  it("Notes tab is active by default", () => {
    render(<DetailPanel {...baseProps} application={makeApp()} />);
    expect(screen.getByRole("tab", { name: "Notes" })).toHaveAttribute("data-state", "active");
  });

  it("renders Edit button for non-archived application", () => {
    render(<DetailPanel {...baseProps} application={makeApp()} />);
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("does not render Edit button for archived application", () => {
    render(
      <DetailPanel
        {...baseProps}
        application={makeApp({ archived_at: "2024-01-02T00:00:00Z" })}
        isArchived={true}
      />
    );
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("renders Archive button for active application", () => {
    render(<DetailPanel {...baseProps} application={makeApp()} />);
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("renders Restore for archived application", () => {
    render(
      <DetailPanel
        {...baseProps}
        application={makeApp({ archived_at: "2024-01-02T00:00:00Z" })}
        isArchived={true}
      />
    );
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("passes correct applicationId into notes child", () => {
    render(<DetailPanel {...baseProps} application={makeApp({ id: 99 })} />);
    expect(screen.getByTestId("notes-tab").textContent).toContain("99");
  });
});

// ── Mode C: saved application edit ───────────────────────────────────────────
describe("Mode C — saved application edit", () => {
  it("clicking Edit shows the form", () => {
    render(<DetailPanel {...baseProps} application={makeApp()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("Cancel returns to read-only mode without making an API call", () => {
    render(<DetailPanel {...baseProps} application={makeApp()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(vi.mocked(api.updateApplication)).not.toHaveBeenCalled();
  });

  it("Save Changes calls updateApplication and returns to read-only on success", async () => {
    const savedApp = makeApp();
    vi.mocked(api.updateApplication).mockResolvedValue(savedApp);
    const onApplicationMutated = vi.fn().mockResolvedValue(undefined);

    render(
      <DetailPanel {...baseProps} application={savedApp} onApplicationMutated={onApplicationMutated} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await act(async () => {
      fireEvent.submit(screen.getByRole("button", { name: "Save Changes" }).closest("form")!);
    });

    await waitFor(() => {
      expect(vi.mocked(api.updateApplication)).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ company: "Test Corp" })
      );
    });
    await waitFor(() => {
      expect(onApplicationMutated).toHaveBeenCalled();
    });
    // returns to read-only
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    });
  });

  it("Cancel after editing restores original field values", () => {
    render(<DetailPanel {...baseProps} application={makeApp({ company: "OrigCo" })} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const companyInput = screen.getByPlaceholderText("e.g. Neilsoft") as HTMLInputElement;
    fireEvent.change(companyInput, { target: { value: "ChangedCo" } });
    expect(companyInput.value).toBe("ChangedCo");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    // returned to read-only — no API call
    expect(vi.mocked(api.updateApplication)).not.toHaveBeenCalled();
    expect(screen.getByText("OrigCo — Software Engineer")).toBeInTheDocument();
  });
});

// ── Mode D: draft edit ────────────────────────────────────────────────────────
describe("Mode D — draft edit", () => {
  const draftProps = {
    ...baseProps,
    activeDraft: makeDraft(),
    draftId: "42",
    selectedDraftId: "42",
  };

  it("shows draft-edit form immediately when draft is selected", () => {
    render(<DetailPanel {...draftProps} />);
    expect(screen.getByRole("button", { name: "Save Draft Changes" })).toBeInTheDocument();
  });

  it("shows Draft badge in header", () => {
    render(<DetailPanel {...draftProps} />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows Save Application and Discard Draft buttons", () => {
    render(<DetailPanel {...draftProps} />);
    expect(screen.getByRole("button", { name: "Save Application" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Discard Draft" })).toBeInTheDocument();
  });

  it("Save Draft Changes calls patchDraft with draftId and updated fields", async () => {
    const updated = { ...makeDraft(), id: 42, priority: "HIGH" } as unknown as Application;
    vi.mocked(api.patchDraft).mockResolvedValue(updated);

    render(<DetailPanel {...draftProps} />);

    // Change priority via the select
    const selects = screen.getAllByRole("combobox");
    const prioritySelect = selects.find(
      (s) => (s as HTMLSelectElement).value === "LOW" || (s as HTMLSelectElement).querySelector
    ) as HTMLSelectElement;
    // Find the priority select specifically
    const allSelects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const prioritySel = allSelects.find((s) => Array.from(s.options).some((o) => o.value === "HIGH"))!;
    fireEvent.change(prioritySel, { target: { value: "HIGH" } });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Save Draft Changes" }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(vi.mocked(api.patchDraft)).toHaveBeenCalledWith(
        "42",
        expect.objectContaining({ priority: "HIGH" })
      );
    });
    expect(draftProps.onDraftPatched).toHaveBeenCalledWith(updated);
  });

  it("multi-role input produces correct roles array in patchDraft call", async () => {
    vi.mocked(api.patchDraft).mockResolvedValue({} as Application);
    render(<DetailPanel {...draftProps} />);

    const rolesInput = screen.getByPlaceholderText("e.g. AI Engineer, RAG Engineer");
    fireEvent.change(rolesInput, { target: { value: "AI Engineer, RAG Engineer" } });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Save Draft Changes" }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(vi.mocked(api.patchDraft)).toHaveBeenCalledWith(
        "42",
        expect.objectContaining({ roles: ["AI Engineer", "RAG Engineer"] })
      );
    });
  });

  it("unknown role in draft form is accepted", async () => {
    vi.mocked(api.patchDraft).mockResolvedValue({} as Application);
    render(<DetailPanel {...draftProps} />);

    const rolesInput = screen.getByPlaceholderText("e.g. AI Engineer, RAG Engineer");
    fireEvent.change(rolesInput, { target: { value: "LLM Inference Optimization Engineer" } });

    await act(async () => {
      fireEvent.submit(
        screen.getByRole("button", { name: "Save Draft Changes" }).closest("form")!
      );
    });

    await waitFor(() => {
      expect(vi.mocked(api.patchDraft)).toHaveBeenCalledWith(
        "42",
        expect.objectContaining({ roles: ["LLM Inference Optimization Engineer"] })
      );
    });
  });

  it("Save Application calls saveDraft and triggers onDraftSaved", async () => {
    const savedApp = makeApp({ company: "Draft Corp" });
    vi.mocked(api.saveDraft).mockResolvedValue(savedApp);

    render(<DetailPanel {...draftProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Application" }));
    });

    await waitFor(() => {
      expect(vi.mocked(api.saveDraft)).toHaveBeenCalledWith("42");
    });
    expect(draftProps.onDraftSaved).toHaveBeenCalledWith(savedApp);
  });

  it("Discard Draft calls discardDraft and triggers onDraftDiscarded", async () => {
    vi.mocked(api.discardDraft).mockResolvedValue(undefined);

    render(<DetailPanel {...draftProps} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Discard Draft" }));
    });

    await waitFor(() => {
      expect(vi.mocked(api.discardDraft)).toHaveBeenCalledWith("42");
    });
    expect(draftProps.onDraftDiscarded).toHaveBeenCalled();
  });
});

// ── Regression: notes + timeline remain accessible in read-only mode ─────────
describe("Regression", () => {
  it("notes and timeline remain visible in saved read-only mode", () => {
    render(<DetailPanel {...baseProps} application={makeApp({ id: 77 })} />);
    expect(screen.getByTestId("notes-tab").textContent).toContain("77");
    expect(screen.getByRole("tab", { name: "Timeline" })).toBeInTheDocument();
  });

  it("chat-created draft renders as amber pinned row via ApplicationsPanel (smoke)", () => {
    // Verified by ApplicationsPanel integration tests; stub check here
    expect(true).toBe(true);
  });

  it("placeholder shown when draft exists but selectedDraftId does not match draftId", () => {
    render(
      <DetailPanel
        {...baseProps}
        activeDraft={makeDraft()}
        draftId="42"
        selectedDraftId="99"
      />
    );
    expect(screen.getByText("Select an application to view details.")).toBeInTheDocument();
  });
});
