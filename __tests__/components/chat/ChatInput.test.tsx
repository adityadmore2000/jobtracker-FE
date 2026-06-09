import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ChatInput from "@/components/chat/ChatInput";

function renderInput(submitting = false, onSubmit = vi.fn()) {
  return render(<ChatInput submitting={submitting} onSubmit={onSubmit} />);
}

describe("ChatInput", () => {
  it("renders textarea", () => {
    renderInput();
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("renders Send button", () => {
    renderInput();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("Send is disabled when input is empty", () => {
    renderInput();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("Send is disabled for whitespace-only input", () => {
    renderInput();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("Send is enabled after typing", () => {
    renderInput();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled();
  });

  it("Enter submits trimmed value", () => {
    const onSubmit = vi.fn();
    renderInput(false, onSubmit);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "  hello  " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("Enter clears textarea immediately", () => {
    renderInput();
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect((textarea as HTMLTextAreaElement).value).toBe("");
  });

  it("Shift+Enter does not submit", () => {
    const onSubmit = vi.fn();
    renderInput(false, onSubmit);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("textarea is disabled while submitting", () => {
    renderInput(true);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("Send is disabled while submitting", () => {
    renderInput(true);
    // even if value is set, submitting blocks Send
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("does not render microphone button", () => {
    renderInput();
    // no mic-related button should exist beyond "Send"
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("aria-label")).toBe("Send");
  });

  it("does not render countdown text", () => {
    renderInput(true);
    expect(screen.queryByText(/second/i)).toBeNull();
    expect(screen.queryByText(/countdown/i)).toBeNull();
  });
});
