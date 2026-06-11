import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import TimelineTab, { formatTimelineEvent } from "@/components/detail/TimelineTab";
import type { TimelineEvent } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  fetchTimeline: vi.fn(),
}));

import * as api from "@/lib/api";

const mockFetchTimeline = vi.mocked(api.fetchTimeline);

const makeEvent = (id: number, overrides?: Partial<TimelineEvent>): TimelineEvent => ({
  id,
  event_type: "application_saved",
  payload: {},
  created_at: "2024-06-01T10:00:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("formatTimelineEvent", () => {
  it("formats application_saved", () => {
    expect(formatTimelineEvent(makeEvent(1, { event_type: "application_saved" }))).toBe(
      "Application saved"
    );
  });

  it("formats status_changed with old and new values", () => {
    const event = makeEvent(1, {
      event_type: "status_changed",
      payload: { old_value: "Applied", new_value: "Interview" },
    });
    expect(formatTimelineEvent(event)).toBe("Status changed: Applied → Interview");
  });

  it("formats field_changed with readable field name", () => {
    const event = makeEvent(1, {
      event_type: "field_changed",
      payload: { field: "priority", old_value: "LOW", new_value: "HIGH" },
    });
    expect(formatTimelineEvent(event)).toBe("Priority changed: LOW → HIGH");
  });

  it("formats application_archived", () => {
    expect(
      formatTimelineEvent(makeEvent(1, { event_type: "application_archived" }))
    ).toBe("Application archived");
  });

  it("formats application_restored", () => {
    expect(
      formatTimelineEvent(makeEvent(1, { event_type: "application_restored" }))
    ).toBe("Application restored");
  });

  it("handles unknown event type safely", () => {
    const result = formatTimelineEvent(makeEvent(1, { event_type: "some_weird_event" }));
    expect(result).toBeTruthy();
    expect(result).not.toContain("{");
  });

  it("handles missing payload values safely for status_changed", () => {
    const event = makeEvent(1, { event_type: "status_changed", payload: {} });
    const result = formatTimelineEvent(event);
    expect(result).toContain("Status changed");
    expect(result).not.toThrow;
  });
});

describe("TimelineTab", () => {
  it("fetches timeline on mount", async () => {
    mockFetchTimeline.mockResolvedValue([]);
    render(<TimelineTab applicationId={1} />);
    await waitFor(() => expect(mockFetchTimeline).toHaveBeenCalledWith(1));
  });

  it("renders loading state initially", () => {
    mockFetchTimeline.mockReturnValue(new Promise(() => {}));
    render(<TimelineTab applicationId={1} />);
    expect(screen.getByText("Loading timeline…")).toBeInTheDocument();
  });

  it("renders empty state when no events returned", async () => {
    mockFetchTimeline.mockResolvedValue([]);
    render(<TimelineTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("No timeline events yet.")).toBeInTheDocument()
    );
  });

  it("renders error state on fetch failure", async () => {
    mockFetchTimeline.mockRejectedValue(new Error("fail"));
    render(<TimelineTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Could not load timeline.")).toBeInTheDocument()
    );
  });

  it("renders Application saved event", async () => {
    mockFetchTimeline.mockResolvedValue([makeEvent(1, { event_type: "application_saved" })]);
    render(<TimelineTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Application saved")).toBeInTheDocument()
    );
  });

  it("renders readable status change", async () => {
    mockFetchTimeline.mockResolvedValue([
      makeEvent(1, {
        event_type: "status_changed",
        payload: { old_value: "Applied", new_value: "Interview" },
      }),
    ]);
    render(<TimelineTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Status changed: Applied → Interview")).toBeInTheDocument()
    );
  });

  it("renders readable generic field change", async () => {
    mockFetchTimeline.mockResolvedValue([
      makeEvent(1, {
        event_type: "field_changed",
        payload: { field: "priority", old_value: "LOW", new_value: "HIGH" },
      }),
    ]);
    render(<TimelineTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Priority changed: LOW → HIGH")).toBeInTheDocument()
    );
  });

  it("renders archive event", async () => {
    mockFetchTimeline.mockResolvedValue([
      makeEvent(1, { event_type: "application_archived" }),
    ]);
    render(<TimelineTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Application archived")).toBeInTheDocument()
    );
  });

  it("renders restore event", async () => {
    mockFetchTimeline.mockResolvedValue([
      makeEvent(1, { event_type: "application_restored" }),
    ]);
    render(<TimelineTab applicationId={1} />);
    await waitFor(() =>
      expect(screen.getByText("Application restored")).toBeInTheDocument()
    );
  });

  it("handles unknown event type safely without throwing", async () => {
    mockFetchTimeline.mockResolvedValue([
      makeEvent(1, { event_type: "totally_unknown_type" }),
    ]);
    render(<TimelineTab applicationId={1} />);
    await waitFor(() => {
      expect(screen.queryByText("Loading timeline…")).not.toBeInTheDocument();
    });
  });

  it("refetches when applicationId changes", async () => {
    mockFetchTimeline.mockResolvedValue([]);
    const { rerender } = render(<TimelineTab applicationId={1} />);
    await waitFor(() => expect(mockFetchTimeline).toHaveBeenCalledWith(1));

    await act(async () => {
      rerender(<TimelineTab applicationId={2} />);
    });

    await waitFor(() => expect(mockFetchTimeline).toHaveBeenCalledWith(2));
  });
});
