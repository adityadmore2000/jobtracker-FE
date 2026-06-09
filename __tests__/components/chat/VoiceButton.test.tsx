import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Event listener registry — module-level so mock factory can close over it
// ---------------------------------------------------------------------------
const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

function emitRoomEvent(event: string, ...args: unknown[]) {
  (listeners[event] ?? []).forEach((h) => h(...args));
}

// Shared mock room internals — reset per test via beforeEach
const mockFns = {
  setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined),
  publishData: vi.fn().mockResolvedValue(undefined),
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(handler);
  }),
  off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (listeners[event]) {
      listeners[event] = listeners[event].filter((h) => h !== handler);
    }
  }),
};

// ---------------------------------------------------------------------------
// Mock livekit-client — Room must be usable as `new Room()`
// ---------------------------------------------------------------------------
vi.mock("livekit-client", () => {
  // Use a real class so `new Room()` works
  class MockRoom {
    state = "disconnected";
    localParticipant = {
      setMicrophoneEnabled: (...args: unknown[]) => mockFns.setMicrophoneEnabled(...args),
      publishData: (...args: unknown[]) => mockFns.publishData(...args),
    };
    connect(...args: unknown[]) { return mockFns.connect(...args); }
    disconnect(...args: unknown[]) { return mockFns.disconnect(...args); }
    on(...args: unknown[]) { return mockFns.on(...(args as [string, (...a: unknown[]) => void])); }
    off(...args: unknown[]) { return mockFns.off(...(args as [string, (...a: unknown[]) => void])); }
  }

  return {
    Room: MockRoom,
    RoomEvent: {
      DataReceived: "dataReceived",
      Disconnected: "disconnected",
    },
  };
});

// ---------------------------------------------------------------------------
// Mock API
// ---------------------------------------------------------------------------
vi.mock("@/lib/api", () => ({
  fetchLiveKitToken: vi.fn().mockResolvedValue({
    url: "ws://localhost:7880",
    room_name: "job-tracker-local",
    participant_identity: "test-user",
    access_token: "test-token",
    expires_at: "2099-01-01T00:00:00Z",
  }),
  submitTranscript: vi.fn(),
}));

import { RoomEvent } from "livekit-client";
import * as api from "@/lib/api";
import VoiceButton from "@/components/chat/VoiceButton";

const mockFetchToken = vi.mocked(api.fetchLiveKitToken);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTextPacket(obj: object): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj));
}

function renderVoiceButton(props: {
  onFinalTranscript?: ReturnType<typeof vi.fn>;
  onError?: ReturnType<typeof vi.fn>;
  onStateChange?: ReturnType<typeof vi.fn>;
  disabled?: boolean;
} = {}) {
  const onFinalTranscript = props.onFinalTranscript ?? vi.fn();
  const onError = props.onError ?? vi.fn();
  const onStateChange = props.onStateChange ?? vi.fn();
  const result = render(
    <VoiceButton
      onFinalTranscript={onFinalTranscript}
      onError={onError}
      onStateChange={onStateChange}
      disabled={props.disabled}
    />
  );
  return { ...result, onFinalTranscript, onError, onStateChange };
}

function getMicButton() {
  const buttons = screen.getAllByRole("button");
  return buttons[buttons.length - 1];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("VoiceButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(listeners).forEach((k) => { listeners[k] = []; });

    // Restore default resolutions
    mockFns.setMicrophoneEnabled.mockResolvedValue(undefined);
    mockFns.publishData.mockResolvedValue(undefined);
    mockFns.connect.mockResolvedValue(undefined);
    mockFns.disconnect.mockResolvedValue(undefined);
    mockFns.on.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    });
    mockFns.off.mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      }
    });

    mockFetchToken.mockResolvedValue({
      url: "ws://localhost:7880",
      room_name: "job-tracker-local",
      participant_identity: "test-user",
      access_token: "test-token",
      expires_at: "2099-01-01T00:00:00Z",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("idle state renders mic button", () => {
    renderVoiceButton();
    expect(getMicButton()).toBeTruthy();
  });

  it("first click fetches a token", async () => {
    renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(mockFetchToken).toHaveBeenCalledTimes(1);
  });

  it("first click connects the room", async () => {
    renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(mockFns.connect).toHaveBeenCalledWith("ws://localhost:7880", "test-token");
  });

  it("first click enables microphone", async () => {
    renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(mockFns.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  });

  it("first click publishes utterance_start reliably", async () => {
    renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(mockFns.publishData).toHaveBeenCalledTimes(1);
    const [data, options] = mockFns.publishData.mock.calls[0] as [Uint8Array, { reliable: boolean }];
    const parsed = JSON.parse(new TextDecoder().decode(data));
    expect(parsed.type).toBe("utterance_start");
    expect(typeof parsed.utterance_id).toBe("string");
    expect(options.reliable).toBe(true);
  });

  it("first click enters recording state", async () => {
    const { onStateChange } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(onStateChange).toHaveBeenCalledWith("recording");
  });

  it("second click publishes utterance_end reliably", async () => {
    renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    const startData = mockFns.publishData.mock.calls[0][0] as Uint8Array;
    const { utterance_id } = JSON.parse(new TextDecoder().decode(startData)) as { utterance_id: string };

    await act(async () => { fireEvent.click(getMicButton()); });
    expect(mockFns.publishData).toHaveBeenCalledTimes(2);
    const endData = mockFns.publishData.mock.calls[1][0] as Uint8Array;
    const endPkt = JSON.parse(new TextDecoder().decode(endData)) as { type: string; utterance_id: string };
    expect(endPkt.type).toBe("utterance_end");
    expect(endPkt.utterance_id).toBe(utterance_id);
    expect((mockFns.publishData.mock.calls[1][1] as { reliable: boolean }).reliable).toBe(true);
  });

  it("second click disables microphone", async () => {
    renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(mockFns.setMicrophoneEnabled).toHaveBeenCalledWith(false);
  });

  it("second click enters transcribing state", async () => {
    const { onStateChange } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(onStateChange).toHaveBeenCalledWith("transcribing");
  });

  it("matching final_transcript calls onFinalTranscript", async () => {
    const { onFinalTranscript } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    const startData = mockFns.publishData.mock.calls[0][0] as Uint8Array;
    const { utterance_id } = JSON.parse(new TextDecoder().decode(startData)) as { utterance_id: string };
    act(() => {
      emitRoomEvent(RoomEvent.DataReceived, makeTextPacket({
        type: "final_transcript",
        utterance_id,
        text: "I applied at Acme",
      }));
    });
    expect(onFinalTranscript).toHaveBeenCalledWith("I applied at Acme");
  });

  it("matching final_transcript returns to idle state", async () => {
    const { onStateChange } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    const startData = mockFns.publishData.mock.calls[0][0] as Uint8Array;
    const { utterance_id } = JSON.parse(new TextDecoder().decode(startData)) as { utterance_id: string };
    act(() => {
      emitRoomEvent(RoomEvent.DataReceived, makeTextPacket({
        type: "final_transcript",
        utterance_id,
        text: "some text",
      }));
    });
    expect(onStateChange).toHaveBeenCalledWith("idle");
  });

  it("different utterance_id is ignored", async () => {
    const { onFinalTranscript } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    act(() => {
      emitRoomEvent(RoomEvent.DataReceived, makeTextPacket({
        type: "final_transcript",
        utterance_id: "different-id",
        text: "stale text",
      }));
    });
    expect(onFinalTranscript).not.toHaveBeenCalled();
  });

  it("malformed packet is ignored", async () => {
    const { onFinalTranscript, onError } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    act(() => {
      emitRoomEvent(RoomEvent.DataReceived, new TextEncoder().encode("not json"));
    });
    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("unknown packet type is ignored", async () => {
    const { onFinalTranscript, onError } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    const startData = mockFns.publishData.mock.calls[0][0] as Uint8Array;
    const { utterance_id } = JSON.parse(new TextDecoder().decode(startData)) as { utterance_id: string };
    act(() => {
      emitRoomEvent(RoomEvent.DataReceived, makeTextPacket({
        type: "partial_transcript",
        utterance_id,
        text: "partial",
      }));
    });
    expect(onFinalTranscript).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("matching transcription_error calls onError", async () => {
    const { onError } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    const startData = mockFns.publishData.mock.calls[0][0] as Uint8Array;
    const { utterance_id } = JSON.parse(new TextDecoder().decode(startData)) as { utterance_id: string };
    act(() => {
      emitRoomEvent(RoomEvent.DataReceived, makeTextPacket({
        type: "transcription_error",
        utterance_id,
        message: "Whisper failed",
      }));
    });
    expect(onError).toHaveBeenCalledWith("Voice transcription failed. Try again.");
  });

  it("token-fetch failure enters unavailable state", async () => {
    mockFetchToken.mockRejectedValue(new Error("Network error"));
    const { onStateChange, onError } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(onStateChange).toHaveBeenCalledWith("unavailable");
    expect(onError).toHaveBeenCalled();
  });

  it("room-connect failure enters unavailable state", async () => {
    mockFns.connect.mockRejectedValue(new Error("Connection refused"));
    const { onStateChange, onError } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(onStateChange).toHaveBeenCalledWith("unavailable");
    expect(onError).toHaveBeenCalled();
  });

  it("unavailable button is disabled after token failure", async () => {
    mockFetchToken.mockRejectedValue(new Error("fail"));
    renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    await waitFor(() => {
      expect(getMicButton()).toBeDisabled();
    });
  });

  it("unexpected disconnect enters unavailable state while recording", async () => {
    const { onStateChange } = renderVoiceButton();
    await act(async () => { fireEvent.click(getMicButton()); });
    act(() => {
      emitRoomEvent(RoomEvent.Disconnected);
    });
    await waitFor(() => {
      expect(onStateChange).toHaveBeenCalledWith("unavailable");
    });
  });

  it("unmount disconnects room", async () => {
    const { unmount } = render(<VoiceButton onFinalTranscript={vi.fn()} />);
    await act(async () => { fireEvent.click(getMicButton()); });
    unmount();
    expect(mockFns.disconnect).toHaveBeenCalled();
  });

  it("unmount disables microphone best-effort", async () => {
    const { unmount } = render(<VoiceButton onFinalTranscript={vi.fn()} />);
    await act(async () => { fireEvent.click(getMicButton()); });
    unmount();
    expect(mockFns.setMicrophoneEnabled).toHaveBeenCalledWith(false);
  });

  it("external disabled prop prevents starting a recording", async () => {
    renderVoiceButton({ disabled: true });
    await act(async () => { fireEvent.click(getMicButton()); });
    expect(mockFetchToken).not.toHaveBeenCalled();
    expect(mockFns.connect).not.toHaveBeenCalled();
  });
});
