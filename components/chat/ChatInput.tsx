"use client";

import { useState, useRef, KeyboardEvent } from "react";
import VoiceButton from "./VoiceButton";

type ChatInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  submitting: boolean;
  onSubmit: (text: string) => void | Promise<void>;
  countdown: number | null;
  onCountdownChange: (countdown: number | null) => void;
  onStartCountdown: (text: string) => void;
};

export default function ChatInput({
  value,
  onValueChange,
  submitting,
  onSubmit,
  countdown,
  onCountdownChange,
  onStartCountdown,
}: ChatInputProps) {
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !submitting && countdown === null;
  const sendButtonDisabled = submitting || (countdown === null && trimmed.length === 0);

  function clearCountdownTimer() {
    if (countdownTimerRef.current !== null) {
      clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }

  function cancelCountdown() {
    clearCountdownTimer();
    onCountdownChange(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape" && countdown !== null) {
      e.preventDefault();
      cancelCountdown();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (submitting) return;
      if (countdown !== null) {
        const text = value.trim();
        cancelCountdown();
        if (text.length > 0) {
          onValueChange("");
          void onSubmit(text);
        }
        return;
      }
      if (!canSend) return;
      const text = trimmed;
      onValueChange("");
      void onSubmit(text);
    }
  }

  function handleSend() {
    if (submitting) return;
    if (countdown !== null) {
      const text = value.trim();
      cancelCountdown();
      if (text.length > 0) {
        onValueChange("");
        void onSubmit(text);
      }
      return;
    }
    if (!canSend) return;
    const text = trimmed;
    onValueChange("");
    void onSubmit(text);
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (countdown !== null) {
      cancelCountdown();
    }
    onValueChange(e.target.value);
  }

  function handleFinalTranscript(text: string) {
    setVoiceError(null);
    onValueChange(text);
    onStartCountdown(text);
  }

  function handleVoiceError(message: string) {
    setVoiceError(message);
  }

  return (
    <div className="shrink-0 border-t p-3">
      {voiceError && (
        <p className="mb-2 text-xs text-red-500">{voiceError}</p>
      )}
      {countdown !== null && (
        <p className="mb-1 text-xs text-muted-foreground" aria-live="polite">
          Submitting in {countdown}…
        </p>
      )}
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
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <VoiceButton
          disabled={submitting || countdown !== null}
          onFinalTranscript={handleFinalTranscript}
          onError={handleVoiceError}
        />
        <button
          type="button"
          aria-label="Send"
          disabled={sendButtonDisabled}
          onClick={handleSend}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
