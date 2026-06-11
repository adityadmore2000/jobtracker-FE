import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ApplicationForm from "@/components/detail/ApplicationForm";
import type { Application } from "@/lib/types";

const makeApp = (overrides?: Partial<Application>): Application => ({
  id: 1,
  company: "Test Corp",
  role: "AI Engineer",
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

  it("prefills role input from initial", () => {
    render(
      <ApplicationForm
        initial={makeApp({ role: "AI Engineer" })}
        submitting={false}
        submitLabel="Save"
        onSubmit={vi.fn()}
      />
    );
    expect(
      screen.getByPlaceholderText("e.g. AI Engineer")
    ).toHaveValue("AI Engineer");
  });

  it("calls onSubmit with role on form submit", () => {
    const onSubmit = vi.fn();
    render(
      <ApplicationForm
        initial={makeApp({ role: "AI Engineer" })}
        submitting={false}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    );
    const roleInput = screen.getByPlaceholderText("e.g. AI Engineer");
    fireEvent.change(roleInput, { target: { value: "RAG Engineer" } });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ role: "RAG Engineer" })
    );
  });

  it("calls onSubmit with unknown role accepted", () => {
    const onSubmit = vi.fn();
    render(
      <ApplicationForm
        initial={makeApp({ role: "" })}
        submitting={false}
        submitLabel="Save"
        onSubmit={onSubmit}
      />
    );
    const roleInput = screen.getByPlaceholderText("e.g. AI Engineer");
    fireEvent.change(roleInput, {
      target: { value: "LLM Inference Optimization Engineer" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Save" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ role: "LLM Inference Optimization Engineer" })
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
