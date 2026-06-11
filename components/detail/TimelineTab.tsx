"use client";

import { useEffect, useState } from "react";
import { fetchTimeline } from "@/lib/api";
import type { TimelineEvent } from "@/lib/types";

type TimelineTabProps = {
  applicationId: number;
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function toLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatTimelineEvent(event: TimelineEvent): string {
  const { event_type, payload } = event;

  switch (event_type) {
    case "application_saved":
      return "Application saved";

    case "application_archived":
      return "Application archived";

    case "application_restored":
      return "Application restored";

    case "note_added":
      return "Note added";

    case "status_changed": {
      const from = typeof payload?.old_value === "string" ? payload.old_value : "?";
      const to = typeof payload?.new_value === "string" ? payload.new_value : "?";
      return `Status changed: ${from} → ${to}`;
    }

    case "field_changed": {
      const field =
        typeof payload?.field === "string" ? toLabel(payload.field) : "Field";
      const from = payload?.old_value != null ? String(payload.old_value) : "?";
      const to = payload?.new_value != null ? String(payload.new_value) : "?";
      return `${field} changed: ${from} → ${to}`;
    }

    default: {
      return toLabel(event_type) || "Unknown event";
    }
  }
}

export default function TimelineTab({ applicationId }: TimelineTabProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError(null);

    fetchTimeline(applicationId)
      .then((data) => {
        if (mounted) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError("Could not load timeline.");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [applicationId]);

  return (
    <div className="overflow-y-auto">
      {loading && (
        <p className="text-sm text-muted-foreground">Loading timeline…</p>
      )}
      {!loading && error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
      {!loading && !error && events.length === 0 && (
        <p className="text-sm text-muted-foreground">No timeline events yet.</p>
      )}
      {!loading && !error && events.length > 0 && (
        <ul className="space-y-2">
          {events.map((event) => (
            <li key={event.id} className="text-sm">
              <p>{formatTimelineEvent(event)}</p>
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(event.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
