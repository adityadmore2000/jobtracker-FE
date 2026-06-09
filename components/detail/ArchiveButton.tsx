"use client";

import { useState } from "react";
import { archiveApplication, restoreApplication } from "@/lib/api";
import type { Application } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type ArchiveButtonProps = {
  application: Application;
  isArchived: boolean;
  onMutated: () => void | Promise<void>;
};

export default function ArchiveButton({
  application,
  isArchived,
  onMutated,
}: ArchiveButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchiveConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await archiveApplication(application.id);
      setDialogOpen(false);
      await onMutated();
    } catch {
      setError("Could not update application.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await restoreApplication(application.id);
      await onMutated();
    } catch {
      setError("Could not update application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isArchived) {
    return (
      <div className="flex items-center gap-2">
        {error && <span className="text-xs text-rose-600">{error}</span>}
        <button
          className="rounded border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50"
          onClick={handleRestore}
          disabled={submitting}
        >
          Restore
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-rose-600">{error}</span>}
      <button
        className="rounded border px-2 py-0.5 text-xs hover:bg-muted disabled:opacity-50"
        onClick={() => setDialogOpen(true)}
        disabled={submitting}
      >
        Archive
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive application?</DialogTitle>
            <DialogDescription>
              This will move {application.company} to the archived list. You can
              restore it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              className="rounded border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="rounded bg-foreground px-3 py-1.5 text-sm text-background hover:opacity-90 disabled:opacity-50"
              onClick={handleArchiveConfirm}
              disabled={submitting}
            >
              Archive
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
