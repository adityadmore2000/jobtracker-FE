import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ApplicationRow from "@/components/applications/ApplicationRow";
import type { Application } from "@/lib/types";

const savedApp: Application = {
  id: 1,
  company: "Acme Corp",
  roles: ["ML Engineer"],
  status: "Applied",
  priority: "HIGH",
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
};

const draftApp: Partial<Application> = {
  company: "Draft Co",
  roles: ["AI Engineer"],
};

describe("ApplicationRow", () => {
  it("renders company and role for a saved application", () => {
    render(<table><tbody><ApplicationRow application={savedApp} /></tbody></table>);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("ML Engineer")).toBeInTheDocument();
  });

  it("renders the saved application status badge", () => {
    render(<table><tbody><ApplicationRow application={savedApp} /></tbody></table>);
    const badges = screen.getAllByText("Applied");
    const statusBadge = badges.find((el) => el.tagName === "SPAN");
    expect(statusBadge).toBeInTheDocument();
  });

  it("clicking a saved row calls onSelect with the correct ID", () => {
    const onSelect = vi.fn();
    render(
      <table><tbody><ApplicationRow application={savedApp} onSelect={onSelect} /></tbody></table>
    );
    fireEvent.click(screen.getByText("Acme Corp").closest("tr")!);
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("pressing Enter on a saved row calls onSelect", () => {
    const onSelect = vi.fn();
    render(
      <table><tbody><ApplicationRow application={savedApp} onSelect={onSelect} /></tbody></table>
    );
    const row = screen.getByText("Acme Corp").closest("tr")!;
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("pressing Space on a saved row calls onSelect", () => {
    const onSelect = vi.fn();
    render(
      <table><tbody><ApplicationRow application={savedApp} onSelect={onSelect} /></tbody></table>
    );
    const row = screen.getByText("Acme Corp").closest("tr")!;
    fireEvent.keyDown(row, { key: " " });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("draft row has an amber class", () => {
    render(
      <table><tbody><ApplicationRow application={draftApp} isDraft /></tbody></table>
    );
    const row = screen.getByText("Draft Co").closest("tr")!;
    expect(row.className).toContain("bg-amber-50");
  });

  it("draft row renders a pencil icon", () => {
    render(
      <table><tbody><ApplicationRow application={draftApp} isDraft /></tbody></table>
    );
    expect(screen.getByLabelText("draft")).toBeInTheDocument();
  });

  it("draft row renders draft status", () => {
    render(
      <table><tbody><ApplicationRow application={draftApp} isDraft /></tbody></table>
    );
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("clicking a draft row does not call onSelect", () => {
    const onSelect = vi.fn();
    render(
      <table><tbody><ApplicationRow application={draftApp} isDraft onSelect={onSelect} /></tbody></table>
    );
    fireEvent.click(screen.getByText("Draft Co").closest("tr")!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selected saved row has a blue-tinted class", () => {
    render(
      <table><tbody><ApplicationRow application={savedApp} isSelected /></tbody></table>
    );
    const row = screen.getByText("Acme Corp").closest("tr")!;
    expect(row.className).toContain("bg-blue-50");
  });

  it("renders multiple roles as comma-separated text", () => {
    const multiRoleApp: Partial<Application> = {
      company: "MultiCo",
      roles: ["AI Engineer", "RAG Engineer"],
    };
    render(<table><tbody><ApplicationRow application={multiRoleApp} isDraft /></tbody></table>);
    expect(screen.getByText("AI Engineer, RAG Engineer")).toBeInTheDocument();
  });

  it("renders multiple employment_types as comma-separated text", () => {
    const multiTypeApp: Application = {
      ...savedApp,
      employment_types: ["Full Time", "Part Time"],
    };
    render(<table><tbody><ApplicationRow application={multiTypeApp} /></tbody></table>);
    expect(screen.getByText("Full Time, Part Time")).toBeInTheDocument();
  });

  it("renders multiple current_stages as comma-separated text", () => {
    const multiStageApp: Application = {
      ...savedApp,
      current_stages: ["Tailored", "Applied"],
    };
    render(<table><tbody><ApplicationRow application={multiStageApp} /></tbody></table>);
    expect(screen.getByText("Tailored, Applied")).toBeInTheDocument();
  });
});
