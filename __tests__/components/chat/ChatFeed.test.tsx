import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatFeed from "@/components/chat/ChatFeed";
import type { ChatMessage } from "@/lib/types";

function makeMsg(id: string, role: ChatMessage["role"], text: string): ChatMessage {
  return { id, role, text, timestamp: new Date().toISOString() };
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe("ChatFeed", () => {
  it("renders intro card when messages is empty", () => {
    render(<ChatFeed messages={[]} />);
    expect(screen.getByText("Keep your job search organised")).toBeTruthy();
  });

  it("intro card contains 'Add a new application'", () => {
    render(<ChatFeed messages={[]} />);
    expect(screen.getByText(/Add a new application/)).toBeTruthy();
  });

  it("intro card contains example command", () => {
    render(<ChatFeed messages={[]} />);
    expect(screen.getByText(/Applied for an AI Engineer role at Neilsoft/)).toBeTruthy();
  });

  it("hides intro card when messages exist", () => {
    render(<ChatFeed messages={[makeMsg("1", "user", "Hello")]} />);
    expect(screen.queryByText("Keep your job search organised")).toBeNull();
  });

  it("renders multiple messages", () => {
    const msgs = [
      makeMsg("1", "user", "First message"),
      makeMsg("2", "system", "Second message"),
      makeMsg("3", "draft", "Draft message"),
    ];
    render(<ChatFeed messages={msgs} />);
    expect(screen.getByText("First message")).toBeTruthy();
    expect(screen.getByText("Second message")).toBeTruthy();
    expect(screen.getByText("Draft message")).toBeTruthy();
  });

  it("calls scrollIntoView when messages change", async () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;
    render(<ChatFeed messages={[makeMsg("1", "user", "msg")]} />);
    expect(scrollSpy).toHaveBeenCalled();
  });
});
