"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Mic, MicOff, LoaderCircle } from "lucide-react";
import { Room, RoomEvent } from "livekit-client";
import { fetchLiveKitToken } from "@/lib/api";

export type VoiceState =
  | "idle"
  | "connecting"
  | "recording"
  | "transcribing"
  | "unavailable";

type VoiceButtonProps = {
  disabled?: boolean;
  onFinalTranscript: (text: string) => void;
  onError?: (message: string) => void;
  onStateChange?: (state: VoiceState) => void;
};

function makeUtteranceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function VoiceButton({
  disabled = false,
  onFinalTranscript,
  onError,
  onStateChange,
}: VoiceButtonProps) {
  const [voiceState, setVoiceStateRaw] = useState<VoiceState>("idle");
  const mountedRef = useRef(true);
  const roomRef = useRef<Room | null>(null);
  const currentUtteranceIdRef = useRef<string | null>(null);

  function setVoiceState(s: VoiceState) {
    if (!mountedRef.current) return;
    setVoiceStateRaw(s);
    onStateChange?.(s);
  }

  const handleDataReceived = useCallback(
    (payload: Uint8Array) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder().decode(payload));
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== "object") return;
      const pkt = parsed as Record<string, unknown>;
      const type = pkt["type"];
      const uid = pkt["utterance_id"];

      if (type === "final_transcript") {
        if (uid !== currentUtteranceIdRef.current) return;
        const text = pkt["text"];
        if (typeof text !== "string" || text.length === 0) return;
        currentUtteranceIdRef.current = null;
        setVoiceState("idle");
        onFinalTranscript(text);
        return;
      }

      if (type === "transcription_error") {
        if (uid !== currentUtteranceIdRef.current) return;
        currentUtteranceIdRef.current = null;
        setVoiceState("idle");
        onError?.("Voice transcription failed. Try again.");
        return;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onFinalTranscript, onError],
  );

  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;

  const handleDisconnected = useCallback(() => {
    if (!mountedRef.current) return;
    const current = voiceStateRef.current;
    if (current !== "idle" && current !== "unavailable") {
      setVoiceState("unavailable");
      onError?.("Voice connection lost.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const room = roomRef.current;
      if (room) {
        room.localParticipant
          .setMicrophoneEnabled(false)
          .catch(() => {/* best effort */});
        room.off(RoomEvent.DataReceived, handleDataReceived);
        room.off(RoomEvent.Disconnected, handleDisconnected);
        room.disconnect();
        roomRef.current = null;
      }
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startRecording() {
    setVoiceState("connecting");
    let room = roomRef.current;
    let isNewRoom = false;

    if (!room || room.state === "disconnected") {
      room = new Room();
      isNewRoom = true;
    }

    try {
      if (isNewRoom) {
        const token = await fetchLiveKitToken();
        room.on(RoomEvent.DataReceived, handleDataReceived);
        room.on(RoomEvent.Disconnected, handleDisconnected);
        await room.connect(token.url, token.access_token);
        roomRef.current = room;
      }

      await room.localParticipant.setMicrophoneEnabled(true);

      const utteranceId = makeUtteranceId();
      currentUtteranceIdRef.current = utteranceId;

      const packet = JSON.stringify({ type: "utterance_start", utterance_id: utteranceId });
      const data = new TextEncoder().encode(packet);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await room.localParticipant.publishData(data as any, { reliable: true });

      setVoiceState("recording");
    } catch {
      currentUtteranceIdRef.current = null;
      try { await room.localParticipant.setMicrophoneEnabled(false); } catch { /* best effort */ }
      try { room.off(RoomEvent.DataReceived, handleDataReceived); } catch { /* best effort */ }
      try { room.off(RoomEvent.Disconnected, handleDisconnected); } catch { /* best effort */ }
      try { await room.disconnect(); } catch { /* best effort */ }
      roomRef.current = null;
      setVoiceState("unavailable");
      onError?.("Could not connect to voice service.");
    }
  }

  async function stopRecording() {
    const room = roomRef.current;
    const utteranceId = currentUtteranceIdRef.current;
    if (!room || !utteranceId) return;

    try {
      const packet = JSON.stringify({ type: "utterance_end", utterance_id: utteranceId });
      const data = new TextEncoder().encode(packet);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await room.localParticipant.publishData(data as any, { reliable: true });
    } catch { /* best effort */ }

    try {
      await room.localParticipant.setMicrophoneEnabled(false);
    } catch { /* best effort */ }

    setVoiceState("transcribing");
  }

  async function handleClick() {
    if (disabled) return;
    if (voiceState === "idle" || voiceState === "unavailable") {
      await startRecording();
    } else if (voiceState === "recording") {
      await stopRecording();
    }
  }

  const isLoading = voiceState === "connecting" || voiceState === "transcribing";
  const isUnavailable = voiceState === "unavailable";
  const isRecording = voiceState === "recording";
  const isDisabled = disabled || isLoading || isUnavailable;

  const title = isUnavailable
    ? "Voice unavailable"
    : voiceState === "connecting"
    ? "Connecting…"
    : voiceState === "recording"
    ? "Recording… (click to stop)"
    : voiceState === "transcribing"
    ? "Transcribing…"
    : "Start voice input";

  const ariaLabel = isUnavailable ? "Voice unavailable" : title;

  return (
    <div className="flex items-center gap-1.5">
      {voiceState !== "idle" && (
        <span className="text-xs text-muted-foreground">
          {voiceState === "connecting" && "Connecting…"}
          {voiceState === "recording" && "Recording…"}
          {voiceState === "transcribing" && "Transcribing…"}
          {voiceState === "unavailable" && "Voice unavailable"}
        </span>
      )}
      <button
        type="button"
        title={title}
        aria-label={ariaLabel}
        disabled={isDisabled}
        onClick={() => { void handleClick(); }}
        className={[
          "relative flex items-center justify-center rounded-full p-2 transition-colors",
          isUnavailable
            ? "cursor-not-allowed text-muted-foreground opacity-40"
            : isLoading
            ? "cursor-not-allowed opacity-60"
            : isRecording
            ? "text-red-500 hover:bg-red-50"
            : "text-muted-foreground hover:bg-muted",
        ].join(" ")}
      >
        {isRecording && (
          <span
            className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40"
            aria-hidden
          />
        )}
        {isLoading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : isUnavailable ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className={["h-4 w-4", isRecording ? "text-red-500" : ""].join(" ")} />
        )}
      </button>
    </div>
  );
}
