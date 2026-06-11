import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import ApplicationsPanel, { type ApplicationsPanelHandle } from "@/components/applications/ApplicationsPanel";
import { SelectionProvider } from "@/lib/SelectionContext";
import type { Application } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchApplications: vi.fn(),
  fetchArchivedApplications: vi.fn(),
  fetchDrafts: vi.fn(),
  fetchNotes: vi.fn().mockResolvedValue([]),
  fetchTimeline: vi.fn().mockResolvedValue([]),
  patchDraft: vi.fn(),
  saveDraft: vi.fn(),
  discardDraft: vi.fn(),
  updateApplication: vi.fn(),
}));

import * as api from "@/lib/api";

const mockFetchApplications = vi.mocked(api.fetchApplications);
const mockFetchArchivedApplications = vi.mocked(api.fetchArchivedApplications);

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

const archivedApp = makeApp(10, { company: "Archived Co", archived_at: "2024-06-01T00:00:00Z" });

type RenderPanelOpts = {
  activeDraft?: Partial<Application> | null;
  draftId?: string | null;
};

function renderPanel({ activeDraft = null, draftId = null }: RenderPanelOpts = {}) {
  const ref = createRef<ApplicationsPanelHandle>();
  const onActiveDraftChange = vi.fn();
  const onDraftIdChange = vi.fn();
  const result = render(
    <SelectionProvider>
      <ApplicationsPanel
        ref={ref}
        activeDraft={activeDraft}
        draftId={draftId}
        onActiveDraftChange={onActiveDraftChange}
        onDraftIdChange={onDraftIdChange}
      />
    </SelectionProvider>
  );
  return { ref, onActiveDraftChange, onDraftIdChange, ...result };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchApplications.mockResolvedValue([makeApp(1), makeApp(2)]);
  mockFetchArchivedApplications.mockResolvedValue([archivedApp]);
  vi.mocked(api.fetchDrafts).mockResolvedValue([]);
  vi.mocked(api.fetchNotes).mockResolvedValue([]);
  vi.mocked(api.fetchTimeline).mockResolvedValue([]);
});

describe("ApplicationsPanel — data fetching", () => {
  it("fetches active and archived rows on initial mount", async () => {
    renderPanel();
    await waitFor(() => {
      expect(mockFetchApplications).toHaveBeenCalledTimes(1);
      expect(mockFetchArchivedApplications).toHaveBeenCalledTimes(1);
    });
  });

  it("renders fetched active rows", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("Company 1")).toBeInTheDocument();
      expect(screen.getByText("Company 2")).toBeInTheDocument();
    });
  });

  it("archived tab renders fetched archived rows", async () => {
    renderPanel();
    await waitFor(() => screen.getByText("Company 1"));
    fireEvent.click(screen.getByText(/Archived/));
    await waitFor(() => {
      expect(screen.getByText("Archived Co")).toBeInTheDocument();
    });
  });

  it("exposes refresh() through the ref", async () => {
    const { ref } = renderPanel();
    await waitFor(() => screen.getByText("Company 1"));
    expect(typeof ref.current?.refresh).toBe("function");
  });

  it("calling ref.current?.refresh() fetches both endpoints again", async () => {
    const { ref } = renderPanel();
    await waitFor(() => expect(mockFetchApplications).toHaveBeenCalledTimes(1));

    await act(async () => {
      ref.current?.refresh();
    });

    await waitFor(() => {
      expect(mockFetchApplications).toHaveBeenCalledTimes(2);
      expect(mockFetchArchivedApplications).toHaveBeenCalledTimes(2);
    });
  });

  it("API rejection renders error state", async () => {
    mockFetchApplications.mockRejectedValue(new Error("Network error"));
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("Could not load applications.")).toBeInTheDocument();
    });
  });

  it("retrying after an error calls both endpoints again", async () => {
    mockFetchApplications.mockRejectedValueOnce(new Error("fail"));
    renderPanel();
    await waitFor(() => screen.getByText("Could not load applications."));

    mockFetchApplications.mockResolvedValue([makeApp(1)]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(mockFetchApplications).toHaveBeenCalledTimes(2);
      expect(mockFetchArchivedApplications).toHaveBeenCalledTimes(2);
    });
  });
});

describe("ApplicationsPanel — saved-row selection", () => {
  it("clicking a saved row updates selection (blue highlight)", async () => {
    renderPanel();
    await waitFor(() => screen.getByText("Company 1"));

    fireEvent.click(screen.getByText("Company 1").closest("tr")!);

    await waitFor(() => {
      const row = screen.getByText("Company 1").closest("tr")!;
      expect(row.className).toContain("bg-blue-50");
    });
  });

  it("lower detail empty state renders when no row is selected", async () => {
    renderPanel();
    await waitFor(() => screen.getByText("Company 1"));
    expect(screen.getByText("Select an application to view details.")).toBeInTheDocument();
  });

  it("clicking an active saved row renders its company and role in the detail header", async () => {
    renderPanel();
    await waitFor(() => screen.getByText("Company 1"));

    fireEvent.click(screen.getByText("Company 1").closest("tr")!);

    await waitFor(() =>
      expect(screen.getByText("Company 1 — Role 1")).toBeInTheDocument()
    );
  });

  it("clicking an archived saved row renders Restore in detail header", async () => {
    mockFetchApplications.mockResolvedValue([]);
    mockFetchArchivedApplications.mockResolvedValue([archivedApp]);
    renderPanel();

    await waitFor(() =>
      expect(screen.queryByText("Loading applications…")).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByText(/Archived/));
    await waitFor(() => screen.getByText("Archived Co"));
    fireEvent.click(screen.getByText("Archived Co").closest("tr")!);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument()
    );
  });
});

describe("ApplicationsPanel — draft selection", () => {
  const draft: Partial<Application> = {
    company: "Draft Co",
    role: "Draft Role",
    employment_types: [],
    current_stages: [],
    status: "",
    priority: "",
    location: "",
    job_link: "",
    next_action: "",
    comments: "",
    engaged_days: 0,
  };

  it("active draft row renders in the table", async () => {
    renderPanel({ activeDraft: draft, draftId: "42" });
    await waitFor(() => screen.getByText("Draft Co"));
    expect(screen.getByText("Draft Co")).toBeInTheDocument();
  });

  it("clicking draft row opens draft-edit form in DetailPanel", async () => {
    renderPanel({ activeDraft: draft, draftId: "42" });
    await waitFor(() => screen.getByText("Draft Co"));

    fireEvent.click(screen.getByText("Draft Co").closest("tr")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Draft Changes" })).toBeInTheDocument();
    });
  });

  it("clicking Edit draft pencil opens draft-edit form", async () => {
    renderPanel({ activeDraft: draft, draftId: "42" });
    await waitFor(() => screen.getByText("Draft Co"));

    fireEvent.click(screen.getByRole("button", { name: "Edit draft" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Draft Changes" })).toBeInTheDocument();
    });
  });

  it("draft edit form shows Save Application and Discard Draft buttons", async () => {
    renderPanel({ activeDraft: draft, draftId: "42" });
    await waitFor(() => screen.getByText("Draft Co"));

    fireEvent.click(screen.getByText("Draft Co").closest("tr")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Application" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Discard Draft" })).toBeInTheDocument();
    });
  });

  it("Save Application button calls saveDraft and clears draft state", async () => {
    const savedApp = makeApp(99, { company: "Draft Co" });
    vi.mocked(api.saveDraft).mockResolvedValue(savedApp);

    const { onActiveDraftChange, onDraftIdChange } = renderPanel({
      activeDraft: draft,
      draftId: "42",
    });
    await waitFor(() => screen.getByText("Draft Co"));

    fireEvent.click(screen.getByText("Draft Co").closest("tr")!);
    await waitFor(() => screen.getByRole("button", { name: "Save Application" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Application" }));
    });

    await waitFor(() => {
      expect(vi.mocked(api.saveDraft)).toHaveBeenCalledWith("42");
      expect(onActiveDraftChange).toHaveBeenCalledWith(null);
      expect(onDraftIdChange).toHaveBeenCalledWith(null);
    });
  });

  it("Discard Draft button calls discardDraft and clears draft state", async () => {
    vi.mocked(api.discardDraft).mockResolvedValue(undefined);

    const { onActiveDraftChange, onDraftIdChange } = renderPanel({
      activeDraft: draft,
      draftId: "42",
    });
    await waitFor(() => screen.getByText("Draft Co"));

    fireEvent.click(screen.getByText("Draft Co").closest("tr")!);
    await waitFor(() => screen.getByRole("button", { name: "Discard Draft" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Discard Draft" }));
    });

    await waitFor(() => {
      expect(vi.mocked(api.discardDraft)).toHaveBeenCalledWith("42");
      expect(onActiveDraftChange).toHaveBeenCalledWith(null);
      expect(onDraftIdChange).toHaveBeenCalledWith(null);
    });
  });
});

describe("ApplicationsPanel — regression", () => {
  it("saved-row selection still works after draft row is added", async () => {
    const draft: Partial<Application> = { company: "Draft Co", role: "Draft Role" };
    renderPanel({ activeDraft: draft, draftId: "42" });

    await waitFor(() => screen.getByText("Company 1"));

    fireEvent.click(screen.getByText("Company 1").closest("tr")!);
    await waitFor(() =>
      expect(screen.getByText("Company 1 — Role 1")).toBeInTheDocument()
    );
  });

  it("draft row still renders as amber when a saved row is also selected", async () => {
    const draft: Partial<Application> = { company: "Draft Co", role: "Draft Role" };
    renderPanel({ activeDraft: draft, draftId: "42" });

    await waitFor(() => screen.getByText("Company 1"));
    fireEvent.click(screen.getByText("Company 1").closest("tr")!);

    await waitFor(() => {
      const draftRow = screen.getByText("Draft Co").closest("tr")!;
      expect(draftRow.className).toContain("bg-amber-50");
    });
  });
});
