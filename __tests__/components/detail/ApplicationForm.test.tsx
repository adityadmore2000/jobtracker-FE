import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ApplicationForm, { parseRoles } from "@/components/detail/ApplicationForm";
import type { Application } from "@/lib/types";

const makeApp = (overrides?: Partial<Application>): Application => ({
  id: 1,
  company: "Test Corp",
  roles: ["AI Engineer"],
  status: "applied",
  priority: "MEDIUM",
  location: "remote",
  job_link: "",
  employment_types: ["Full Time"],
  current_stages: ["Applied"],
  engaged_days: 2,
  next_action: "Follow up",
  comments: "Ref pending",
  is_draft: false,
  draft_created_at: null,
  archived_at: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

describe("parseRoles", () => {
  it("splits comma-separated roles and trims whitespace", () => {
    expect(parseRoles("AI Engineer, RAG Engineer")).toEqual(["AI Engineer", "RAG Engineer"]);
  });

  it("removes blank entries", () => {
    expect(parseRoles("AI Engineer, , RAG Engineer")).toEqual(["AI Engineer", "RAG Engineer"]);
  });

  it("accepts unknown roles", () => {
    expect(parseRoles("LLM Inference Optimization Engineer")).toEqual([
      "LLM Inference Optimization Engineer",
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(parseRoles("")).toEqual([]);
  });
});

describe("ApplicationForm", () => {
  it("prefills company from initial", () => {
    render(
      <ApplicationForm
        initial={makeApp({ company: "Neilsoft" })}
        submitting={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText("e.g. Neilsoft")).toHaveValue("Neilsoft");
  });

  it("prefills roles as comma-separated input", () => {
    render(
      <ApplicationForm
        initial={makeApp({ roles: ["AI Engineer", "RAG Engineer"] })}
        submitting={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />
    );
    expect(
      screen.getByPlaceholderText("e.g. AI Engineer, RAG Engineer")
    ).toHaveValue("AI Engineer, RAG Engineer");
  });

  it("calls onSubmit with parsed roles on form submit", () => {
    const onSubmit = vi.fn();
    render(
      <ApplicationForm
        initial={makeApp({ roles: ["AI Engineer"] })}
        submitting={false}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    );
    const rolesInput = screen.getByPlaceholderText("e.g. AI Engineer, RAG Engineer");
    fireEvent.change(rolesInput, { target: { value: "AI Engineer, RAG Engineer" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ rolesInput: "AI Engineer, RAG Engineer" })
    );
  });

  it("calls onSubmit with unknown role accepted", () => {
    const onSubmit = vi.fn();
    render(
      <ApplicationForm
        initial={makeApp({ roles: [] })}
        submitting={false}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    );
    const rolesInput = screen.getByPlaceholderText("e.g. AI Engineer, RAG Engineer");
    fireEvent.change(rolesInput, {
      target: { value: "LLM Inference Optimization Engineer" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ rolesInput: "LLM Inference Optimization Engineer" })
    );
  });

  it("shows submit button disabled while submitting", () => {
    render(
      <ApplicationForm
        initial={makeApp()}
        submitting={true}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("renders extraActions slot", () => {
    render(
      <ApplicationForm
        initial={makeApp()}
        submitting={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
        extraActions={<button type="button">Cancel</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("resets form values when initial prop changes", () => {
    const { rerender } = render(
      <ApplicationForm
        initial={makeApp({ company: "OriginalCo" })}
        submitting={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText("e.g. Neilsoft")).toHaveValue("OriginalCo");

    rerender(
      <ApplicationForm
        initial={makeApp({ company: "NewCo" })}
        submitting={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText("e.g. Neilsoft")).toHaveValue("NewCo");
  });
});
