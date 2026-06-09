"use client";

import { useState, KeyboardEvent } from "react";

type ChatInputProps = {
  submitting: boolean;
  onSubmit: (text: string) => void | Promise<void>;
};

export default function ChatInput({ submitting, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState("");

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !submitting;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!canSend) return;
      const text = trimmed;
      setValue("");
      void onSubmit(text);
    }
  }

  function handleSend() {
    if (!canSend) return;
    const text = trimmed;
    setValue("");
    void onSubmit(text);
  }

  return (
    <div className="shrink-0 border-t p-3">
      <label className="sr-only" htmlFor="chat-input">
        Application update
      </label>
      <textarea
        id="chat-input"
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        rows={3}
        placeholder="Add or update an application…"
        value={value}
        disabled={submitting}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          aria-label="Send"
          disabled={!canSend}
          onClick={handleSend}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
