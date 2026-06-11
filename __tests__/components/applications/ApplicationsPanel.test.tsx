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
  deleteDraft: vi.fn(),
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
  routeApplicationId?: number | null;
  routeDraftId?: string | null;
  routeNotFound?: string | null;
};

function renderPanel({
  activeDraft = null,
  routeApplicationId = null,
  routeDraftId = null,
  routeNotFound = null,
}: RenderPanelOpts = {}) {
  const ref = createRef<ApplicationsPanelHandle>();
  const onActiveDraftChange = vi.fn();
  const onNavigateApplication = vi.fn();
  const onNavigateDraft = vi.fn();
  const onNavigateOverview = vi.fn();
  const result = render(
    <SelectionProvider>
      <ApplicationsPanel
        ref={ref}
        activeDraft={activeDraft}
        routeApplicationId={routeApplicationId}
        routeDraftId={routeDraftId}
        routeNotFound={routeNotFound}
        onActiveDraftChange={onActiveDraftChange}
        onNavigateApplication={onNavigateApplication}
        onNavigateDraft={onNavigateDraft}
        onNavigateOverview={onNavigateOverview}
      />
    </SelectionProvider>
  );
  return {
    ref,
    onActiveDraftChange,
    onNavigateApplication,
    onNavigateDraft,
    onNavigateOverview,
    ...result,
  };
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

describe("ApplicationsPanel — saved-row navigation", () => {
  it("clicking a saved row navigates to /applications/{id}", async () => {
    const { onNavigateApplication } = renderPanel();
    await waitFor(() => screen.getByText("Company 1"));

    fireEvent.click(screen.getByText("Company 1").closest("tr")!);

    expect(onNavigateApplication).toHaveBeenCalledWith(1);
  });

  it("clicking an archived row navigates to /applications/{id}", async () => {
    const { onNavigateApplication } = renderPanel();
    await waitFor(() => screen.getByText("Company 1"));
    fireEvent.click(screen.getByText(/Archived/));
    await waitFor(() => screen.getByText("Archived Co"));

    fireEvent.click(screen.getByText("Archived Co").closest("tr")!);

    expect(onNavigateApplication).toHaveBeenCalledWith(10);
  });

  it("lower detail empty state renders when no row is route-selected", async () => {
    renderPanel();
    await waitFor(() => screen.getByText("Company 1"));
    expect(screen.getByText("Select an application to view details.")).toBeInTheDocument();
  });

  it("route-selected saved application renders its header (direct-link refresh)", async () => {
    renderPanel({ routeApplicationId: 1 });
    await waitFor(() =>
      expect(screen.getByText("Company 1 — Role 1")).toBeInTheDocument()
    );
  });

  it("route-selected archived application renders Restore", async () => {
    renderPanel({ routeApplicationId: 10 });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument()
    );
  });

  it("route-selected saved row is highlighted", async () => {
    renderPanel({ routeApplicationId: 1 });
    await waitFor(() => {
      const row = screen.getByText("Company 1").closest("tr")!;
      expect(row.className).toContain("bg-blue-50");
    });
  });
});

describe("ApplicationsPanel — draft navigation & detail", () => {
  const draft: Partial<Application> = {
    id: 42,
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

  beforeEach(() => {
    vi.mocked(api.fetchDrafts).mockResolvedValue([makeApp(42, { company: "Draft Co", role: "Draft Role", is_draft: true })]);
  });

  it("clicking a draft row navigates to /drafts/{id}", async () => {
    const { onNavigateDraft } = renderPanel();
    fireEvent.click(screen.getByText(/Drafts/));
    await waitFor(() => screen.getByText("Draft Co"));

    fireEvent.click(screen.getByText("Draft Co").closest("tr")!);

    expect(onNavigateDraft).toHaveBeenCalledWith("42");
  });

  it("route-selected draft opens the draft-edit form", async () => {
    renderPanel({ activeDraft: draft, routeDraftId: "42" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Draft Changes" })).toBeInTheDocument();
    });
  });

  it("draft edit form shows Save Application and Discard Draft buttons", async () => {
    renderPanel({ activeDraft: draft, routeDraftId: "42" });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Application" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Discard Draft" })).toBeInTheDocument();
    });
  });

  it("Save Application calls saveDraft then navigates to the saved application", async () => {
    const savedApp = makeApp(99, { company: "Draft Co" });
    vi.mocked(api.saveDraft).mockResolvedValue(savedApp);

    const { onActiveDraftChange, onNavigateApplication } = renderPanel({
      activeDraft: draft,
      routeDraftId: "42",
    });
    await waitFor(() => screen.getByRole("button", { name: "Save Application" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save Application" }));
    });

    await waitFor(() => {
      expect(vi.mocked(api.saveDraft)).toHaveBeenCalledWith("42");
      expect(onActiveDraftChange).toHaveBeenCalledWith(null);
      expect(onNavigateApplication).toHaveBeenCalledWith(99);
    });
  });

  it("Discard Draft calls deleteDraft then navigates to overview", async () => {
    vi.mocked(api.deleteDraft).mockResolvedValue(undefined);

    const { onActiveDraftChange, onNavigateOverview } = renderPanel({
      activeDraft: draft,
      routeDraftId: "42",
    });
    await waitFor(() => screen.getByRole("button", { name: "Discard Draft" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Discard Draft" }));
    });

    await waitFor(() => {
      expect(vi.mocked(api.deleteDraft)).toHaveBeenCalledWith("42");
      expect(onActiveDraftChange).toHaveBeenCalledWith(null);
      expect(onNavigateOverview).toHaveBeenCalled();
    });
  });
});

describe("ApplicationsPanel — not-found state", () => {
  it("renders the route not-found message in the detail panel", async () => {
    renderPanel({ routeNotFound: "Draft not found" });
    await waitFor(() =>
      expect(screen.getByText("Draft not found")).toBeInTheDocument()
    );
  });
});
