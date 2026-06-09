"use client";

import { Pencil } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

type ChatMessageProps = {
  message: ChatMessageType;
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const { role, text, timestamp } = message;

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[90%] rounded-lg bg-blue-600 px-3 py-2 text-white">
          <p className="whitespace-pre-wrap text-sm">{text}</p>
          <p className="mt-1 text-right text-xs text-blue-200">{formatTimestamp(timestamp)}</p>
        </div>
      </div>
    );
  }

  if (role === "draft") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[90%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
          <div className="mb-1 flex items-center gap-1.5">
            <Pencil className="h-3 w-3 text-amber-600" aria-hidden="true" />
            <span className="text-xs font-medium text-amber-700">Draft</span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{text}</p>
          <p className="mt-1 text-xs text-amber-600">{formatTimestamp(timestamp)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-lg border bg-muted/40 px-3 py-2">
        <p className="whitespace-pre-wrap text-sm text-foreground">{text}</p>
        <p className="mt-1 text-xs text-muted-foreground">{formatTimestamp(timestamp)}</p>
      </div>
    </div>
  );
}
