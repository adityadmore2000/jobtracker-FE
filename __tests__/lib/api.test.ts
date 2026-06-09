import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchLiveKitToken } from "@/lib/api";

describe("fetchLiveKitToken", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(status: number, body: unknown) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(String(body)),
    });
  }

  const tokenResponse = {
    url: "ws://localhost:7880",
    room_name: "job-tracker-local",
    participant_identity: "test-user-123",
    access_token: "eyJhbGciOiJIUzI1NiJ9.test",
    expires_at: "2099-01-01T00:00:00Z",
  };

  it("uses POST method", async () => {
    mockFetch(200, tokenResponse);
    await fetchLiveKitToken();
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].method).toBe("POST");
  });

  it("sends Content-Type: application/json header", async () => {
    mockFetch(200, tokenResponse);
    await fetchLiveKitToken();
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers["Content-Type"]).toBe("application/json");
  });

  it("calls /livekit/token path", async () => {
    mockFetch(200, tokenResponse);
    await fetchLiveKitToken();
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toMatch(/\/livekit\/token$/);
  });

  it("sends room_name in body when provided", async () => {
    mockFetch(200, tokenResponse);
    await fetchLiveKitToken("my-room");
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.room_name).toBe("my-room");
  });

  it("sends empty body when no room name is provided", async () => {
    mockFetch(200, tokenResponse);
    await fetchLiveKitToken();
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.room_name).toBeUndefined();
  });

  it("returns parsed token response on success", async () => {
    mockFetch(200, tokenResponse);
    const result = await fetchLiveKitToken();
    expect(result).toEqual(tokenResponse);
  });

  it("throws on non-2xx response", async () => {
    mockFetch(401, "Unauthorized");
    await expect(fetchLiveKitToken()).rejects.toThrow();
  });
});
