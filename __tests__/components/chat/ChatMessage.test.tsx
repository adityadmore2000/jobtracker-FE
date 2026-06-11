import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatMessage from "@/components/chat/ChatMessage";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

function makeMsg(overrides: Partial<ChatMessageType> = {}): ChatMessageType {
  return {
    id: "test-id",
    role: "user",
    text: "Hello",
    timestamp: "2024-01-01T10:30:00.000Z",
    ...overrides,
  };
}

describe("ChatMessage", () => {
  it("renders user message text", () => {
    render(<ChatMessage message={makeMsg({ text: "User says hi" })} />);
    expect(screen.getByText("User says hi")).toBeTruthy();
  });

  it("user message is right-aligned", () => {
    const { container } = render(<ChatMessage message={makeMsg({ role: "user" })} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-end");
  });

  it("user message has blue background", () => {
    const { container } = render(<ChatMessage message={makeMsg({ role: "user" })} />);
    const bubble = container.querySelector(".bg-blue-600");
    expect(bubble).toBeTruthy();
  });

  it("system message is left-aligned", () => {
    const { container } = render(<ChatMessage message={makeMsg({ role: "system", text: "System msg" })} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-start");
  });

  it("system message has border and muted background", () => {
    const { container } = render(<ChatMessage message={makeMsg({ role: "system", text: "System msg" })} />);
    const bubble = container.querySelector(".border");
    expect(bubble).toBeTruthy();
    const muted = container.querySelector("[class*='bg-muted']");
    expect(muted).toBeTruthy();
  });

  it("draft message is left-aligned", () => {
    const { container } = render(<ChatMessage message={makeMsg({ role: "draft", text: "Draft" })} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("justify-start");
  });

  it("draft message has amber styling", () => {
    const { container } = render(<ChatMessage message={makeMsg({ role: "draft", text: "Draft" })} />);
    const amber = container.querySelector(".bg-amber-50");
    expect(amber).toBeTruthy();
  });

  it("draft message renders pencil icon", () => {
    const { container } = render(<ChatMessage message={makeMsg({ role: "draft", text: "Draft" })} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders timestamp", () => {
    render(<ChatMessage message={makeMsg({ timestamp: "2024-01-01T10:30:00.000Z" })} />);
    // timestamp is rendered as a localized time string - just check it exists
    const timeEls = document.querySelectorAll("[class*='text-xs']");
    expect(timeEls.length).toBeGreaterThan(0);
  });

  it("renders message text for system", () => {
    render(<ChatMessage message={makeMsg({ role: "system", text: "System response here" })} />);
    expect(screen.getByText("System response here")).toBeTruthy();
  });

  it("renders message text for draft", () => {
    render(<ChatMessage message={makeMsg({ role: "draft", text: "Draft: Neilsoft · AI Engineer" })} />);
    expect(screen.getByText("Draft: Neilsoft · AI Engineer")).toBeTruthy();
  });

  it("renders suggested phrasings as clickable chips", () => {
    const onSuggestionClick = vi.fn();
    render(
      <ChatMessage
        message={makeMsg({
          role: "system",
          text: "I am not sure which field you want to change.",
          suggestions: ["set priority of Neilsoft to medium"],
        })}
        onSuggestionClick={onSuggestionClick}
      />,
    );
    const chip = screen.getByRole("button", { name: "set priority of Neilsoft to medium" });
    expect(chip).toBeTruthy();
    fireEvent.click(chip);
    expect(onSuggestionClick).toHaveBeenCalledWith("set priority of Neilsoft to medium");
  });

  it("does not render a chip area when there are no suggestions", () => {
    render(<ChatMessage message={makeMsg({ role: "system", text: "ok" })} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
