import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRef } from "react";
import ApplicationsPanel, { type ApplicationsPanelHandle } from "@/components/applications/ApplicationsPanel";
import { SelectionProvider } from "@/lib/SelectionContext";
import type { Application } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchApplications: vi.fn(),
  fetchArchivedApplications: vi.fn(),
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
  location_mode: "remote",
  job_link: "",
  employment_type: "Full Time",
  current_stage: "Applied",
  is_draft: false,
  draft_created_at: null,
  archived_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const archivedApp = makeApp(10, { company: "Archived Co" });

function renderPanel(activeDraft = null as Partial<Application> | null) {
  const ref = createRef<ApplicationsPanelHandle>();
  const result = render(
    <SelectionProvider>
      <ApplicationsPanel ref={ref} activeDraft={activeDraft} draftId={null} />
    </SelectionProvider>
  );
  return { ref, ...result };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchApplications.mockResolvedValue([makeApp(1), makeApp(2)]);
  mockFetchArchivedApplications.mockResolvedValue([archivedApp]);
});

describe("ApplicationsPanel", () => {
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

  it("clicking a saved row updates selection context", async () => {
    renderPanel();
    await waitFor(() => screen.getByText("Company 1"));

    fireEvent.click(screen.getByText("Company 1").closest("tr")!);

    // The selected row should receive blue styling
    await waitFor(() => {
      const row = screen.getByText("Company 1").closest("tr")!;
      expect(row.className).toContain("bg-blue-50");
    });
  });
});
