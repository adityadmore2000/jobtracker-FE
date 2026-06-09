import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ApplicationsTable from "@/components/applications/ApplicationsTable";
import type { Application } from "@/lib/types";

const makeApp = (id: number, overrides?: Partial<Application>): Application => ({
  id,
  company: `Company ${id}`,
  roles: [`Role ${id}`],
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

const defaultProps = {
  applications: [makeApp(1), makeApp(2)],
  archived: [makeApp(3, { company: "Archived Co" })],
  activeDraft: null,
  activeTab: "active" as const,
  loading: false,
  error: null,
  selectedApplicationId: null,
  onActiveTabChange: vi.fn(),
  onSelectApplication: vi.fn(),
  onRetry: vi.fn(),
};

describe("ApplicationsTable", () => {
  it("renders active rows by default", () => {
    render(<ApplicationsTable {...defaultProps} />);
    expect(screen.getByText("Company 1")).toBeInTheDocument();
    expect(screen.getByText("Company 2")).toBeInTheDocument();
  });

  it("draft row appears before saved rows in the active tab", () => {
    const draft = { company: "Draft Co", roles: ["AI Engineer"] };
    render(
      <ApplicationsTable
        {...defaultProps}
        activeDraft={draft}
        activeTab="active"
      />
    );
    const rows = screen.getAllByRole("row");
    const draftRowIndex = rows.findIndex((r) => r.textContent?.includes("Draft Co"));
    const savedRowIndex = rows.findIndex((r) => r.textContent?.includes("Company 1"));
    expect(draftRowIndex).toBeLessThan(savedRowIndex);
  });

  it("draft row is absent in the archived tab", () => {
    const draft = { company: "Draft Co", roles: ["AI Engineer"] };
    render(
      <ApplicationsTable
        {...defaultProps}
        activeDraft={draft}
        activeTab="archived"
      />
    );
    expect(screen.queryByText("Draft Co")).not.toBeInTheDocument();
  });

  it("clicking the archived tab renders archived rows", () => {
    const onActiveTabChange = vi.fn();
    render(
      <ApplicationsTable
        {...defaultProps}
        onActiveTabChange={onActiveTabChange}
      />
    );
    fireEvent.click(screen.getByText(/Archived/));
    expect(onActiveTabChange).toHaveBeenCalledWith("archived");
  });

  it("archived tab shows archived rows when activeTab is archived", () => {
    render(
      <ApplicationsTable
        {...defaultProps}
        activeTab="archived"
      />
    );
    expect(screen.getByText("Archived Co")).toBeInTheDocument();
  });

  it("active button shows count including draft", () => {
    const draft = { company: "Draft Co" };
    render(
      <ApplicationsTable
        {...defaultProps}
        activeDraft={draft}
      />
    );
    // 2 saved + 1 draft = 3
    expect(screen.getByText(/Active 3/)).toBeInTheDocument();
  });

  it("archived button shows archived count", () => {
    render(<ApplicationsTable {...defaultProps} />);
    expect(screen.getByText(/Archived 1/)).toBeInTheDocument();
  });

  it("empty active state renders correct message", () => {
    render(
      <ApplicationsTable
        {...defaultProps}
        applications={[]}
        activeDraft={null}
        activeTab="active"
      />
    );
    expect(screen.getByText("No active applications yet.")).toBeInTheDocument();
  });

  it("empty archived state renders correct message", () => {
    render(
      <ApplicationsTable
        {...defaultProps}
        archived={[]}
        activeTab="archived"
      />
    );
    expect(screen.getByText("No archived applications.")).toBeInTheDocument();
  });

  it("loading state renders loading message", () => {
    render(<ApplicationsTable {...defaultProps} loading />);
    expect(screen.getByText("Loading applications…")).toBeInTheDocument();
  });

  it("error state renders retry button", () => {
    render(
      <ApplicationsTable
        {...defaultProps}
        error="Network error"
      />
    );
    expect(screen.getByText("Could not load applications.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("clicking retry invokes onRetry", () => {
    const onRetry = vi.fn();
    render(
      <ApplicationsTable
        {...defaultProps}
        error="Network error"
        onRetry={onRetry}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("selected row receives blue styling", () => {
    render(
      <ApplicationsTable
        {...defaultProps}
        selectedApplicationId={1}
      />
    );
    const selectedRow = screen.getByText("Company 1").closest("tr")!;
    expect(selectedRow.className).toContain("bg-blue-50");
  });
});
