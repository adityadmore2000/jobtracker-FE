import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchLiveKitToken, updateApplication, ConflictError } from "@/lib/api";

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

describe("ConflictError", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { globalThis.fetch = originalFetch; });

  function mockFetch(status: number, body: unknown) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
    });
  }

  it("updateApplication throws ConflictError on 409 with JSON detail", async () => {
    mockFetch(409, { detail: "An application for Rockwell — AI Engineer already exists." });
    await expect(updateApplication(1, { role: "AI Engineer" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("ConflictError message contains the backend detail", async () => {
    mockFetch(409, { detail: "An application for Rockwell — AI Engineer already exists." });
    try {
      await updateApplication(1, { role: "AI Engineer" });
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).message).toContain("AI Engineer");
    }
  });

  it("updateApplication throws a generic Error on other 4xx responses", async () => {
    mockFetch(400, "Bad Request");
    const err = await updateApplication(1, { role: "X" }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(ConflictError);
  });
});
