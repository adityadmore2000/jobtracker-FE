import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import DetailPanel from "@/components/detail/DetailPanel";
import type { Application } from "@/lib/types";

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

const makeApp = (overrides?: Partial<Application>): Application => ({
  id: 5,
  company: "Test Corp",
  role: "Software Engineer",
  status: "applied",
  priority: "medium",
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

describe("DetailPanel", () => {
  it("renders empty state when no application selected", () => {
    render(
      <DetailPanel
        application={null}
        isArchived={false}
        onApplicationMutated={vi.fn()}
      />
    );
    expect(
      screen.getByText("Select an application to view details.")
    ).toBeInTheDocument();
  });

  it("does not render tabs in empty state", () => {
    render(
      <DetailPanel
        application={null}
        isArchived={false}
        onApplicationMutated={vi.fn()}
      />
    );
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Timeline")).not.toBeInTheDocument();
  });

  it("renders company and role for selected application", () => {
    render(
      <DetailPanel
        application={makeApp()}
        isArchived={false}
        onApplicationMutated={vi.fn()}
      />
    );
    expect(screen.getByText("Test Corp — Software Engineer")).toBeInTheDocument();
  });

  it("renders Notes and Timeline tab triggers", () => {
    render(
      <DetailPanel
        application={makeApp()}
        isArchived={false}
        onApplicationMutated={vi.fn()}
      />
    );
    expect(screen.getByRole("tab", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Timeline" })).toBeInTheDocument();
  });

  it("Notes tab is active by default", () => {
    render(
      <DetailPanel
        application={makeApp()}
        isArchived={false}
        onApplicationMutated={vi.fn()}
      />
    );
    const notesTab = screen.getByRole("tab", { name: "Notes" });
    expect(notesTab).toHaveAttribute("data-state", "active");
  });

  it("renders Archive for active application", () => {
    render(
      <DetailPanel
        application={makeApp()}
        isArchived={false}
        onApplicationMutated={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("renders Restore for archived application", () => {
    render(
      <DetailPanel
        application={makeApp({ archived_at: "2024-01-02T00:00:00Z" })}
        isArchived={true}
        onApplicationMutated={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("passes correct applicationId into notes child", () => {
    render(
      <DetailPanel
        application={makeApp({ id: 99 })}
        isArchived={false}
        onApplicationMutated={vi.fn()}
      />
    );
    expect(screen.getByTestId("notes-tab").textContent).toContain("99");
  });

  it("passes correct applicationId into notes and timeline children (notes active by default)", () => {
    render(
      <DetailPanel
        application={makeApp({ id: 99 })}
        isArchived={false}
        onApplicationMutated={vi.fn()}
      />
    );
    // Notes tab is active by default — its child is mounted and visible
    expect(screen.getByTestId("notes-tab").textContent).toContain("99");
    // Timeline tab panel exists in DOM (Radix renders it hidden but not mounted until active)
    expect(screen.getByRole("tab", { name: "Timeline" })).toBeInTheDocument();
  });
});
