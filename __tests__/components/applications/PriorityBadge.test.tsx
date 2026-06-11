import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PriorityBadge from "@/components/applications/PriorityBadge";

describe("PriorityBadge", () => {
  it("renders high", () => {
    render(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("renders medium", () => {
    render(<PriorityBadge priority="MEDIUM" />);
    expect(screen.getByText("MEDIUM")).toBeInTheDocument();
  });

  it("renders low", () => {
    render(<PriorityBadge priority="LOW" />);
    expect(screen.getByText("LOW")).toBeInTheDocument();
  });

  it("applies rose class for high", () => {
    render(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText("HIGH").className).toContain("bg-rose-100");
  });

  it("applies amber class for medium", () => {
    render(<PriorityBadge priority="MEDIUM" />);
    expect(screen.getByText("MEDIUM").className).toContain("bg-amber-100");
  });

  it("applies slate class for low", () => {
    render(<PriorityBadge priority="LOW" />);
    expect(screen.getByText("LOW").className).toContain("bg-slate-100");
  });

  it("renders — for null", () => {
    render(<PriorityBadge priority={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders — for undefined", () => {
    render(<PriorityBadge />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("uses fallback styling for unexpected values", () => {
    render(<PriorityBadge priority="CRITICAL" />);
    expect(screen.getByText("CRITICAL").className).toContain("bg-neutral-100");
  });
});
