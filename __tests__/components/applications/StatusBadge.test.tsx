import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import StatusBadge from "@/components/applications/StatusBadge";

const KNOWN_STATUSES = [
  { status: "Interested", expectedClass: "bg-sky-100" },
  { status: "Applied", expectedClass: "bg-blue-100" },
  { status: "Interview", expectedClass: "bg-violet-100" },
  { status: "Offer", expectedClass: "bg-emerald-100" },
  { status: "Rejected", expectedClass: "bg-rose-100" },
  { status: "Archived", expectedClass: "bg-slate-100" },
  { status: "ghosted", expectedClass: "bg-slate-100" },
  { status: "withdrawn", expectedClass: "bg-slate-100" },
];

describe("StatusBadge", () => {
  it.each(KNOWN_STATUSES)("renders $status without crashing", ({ status }) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it("renders draft", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it.each(KNOWN_STATUSES)("applies expected semantic class for $status", ({ status, expectedClass }) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(status).className).toContain(expectedClass);
  });

  it("applies amber class for draft", () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText("draft").className).toContain("bg-amber-100");
  });

  it("renders unknown status with neutral fallback class", () => {
    render(<StatusBadge status="unknown-xyz" />);
    const el = screen.getByText("unknown-xyz");
    expect(el.className).toContain("bg-neutral-100");
  });
});
