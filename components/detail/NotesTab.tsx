"use client";

import { useEffect, useState } from "react";
import { fetchNotes } from "@/lib/api";
import type { ApplicationNote } from "@/lib/types";

type NotesTabProps = {
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

export default function NotesTab({ applicationId }: NotesTabProps) {
  const [notes, setNotes] = useState<ApplicationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError(null);

    fetchNotes(applicationId)
      .then((data) => {
        if (mounted) {
          setNotes(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setError("Could not load notes.");
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
        <p className="text-sm text-muted-foreground">Loading notes…</p>
      )}
      {!loading && error && (
        <p className="text-sm text-rose-600">{error}</p>
      )}
      {!loading && !error && notes.length === 0 && (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}
      {!loading && !error && notes.length > 0 && (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="text-sm">
              <p>{note.text}</p>
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(note.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
