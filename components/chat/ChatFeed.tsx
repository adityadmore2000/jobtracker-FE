"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import ChatMessage from "./ChatMessage";

type ChatFeedProps = {
  messages: ChatMessageType[];
};

function IntroCard() {
  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-semibold text-foreground">Keep your job search organised</p>
      <p className="mt-1 text-muted-foreground">Update applications in plain language.</p>
      <ul className="mt-3 space-y-1 text-muted-foreground">
        <li>✓ Add a new application</li>
        <li>✓ Save or discard a draft</li>
        <li>✓ Update status, priority, or job details</li>
        <li>✓ Add notes and track what changed</li>
        <li>✓ Archive applications you no longer need</li>
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">Try something like:</p>
      <p className="mt-1 rounded bg-muted px-2 py-1 font-mono text-xs">
        Applied for an AI Engineer role at Neilsoft
      </p>
    </div>
  );
}

export default function ChatFeed({ messages }: ChatFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
      {messages.length === 0 ? (
        <IntroCard />
      ) : (
        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
