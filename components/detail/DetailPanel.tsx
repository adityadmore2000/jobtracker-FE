"use client";

import { useState } from "react";
import type { Application, ApplicationChangeDraft } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import NotesTab from "./NotesTab";
import TimelineTab from "./TimelineTab";
import ArchiveButton from "./ArchiveButton";
import ApplicationForm, { type ApplicationFormValues } from "./ApplicationForm";
import {
  patchDraft,
  saveDraft,
  deleteDraft,
  updateApplication,
  applyApplicationChangeDraft,
  discardApplicationChangeDraft,
  type ApplicationUpdatePayload,
} from "@/lib/api";

type DetailPanelProps = {
  // saved-application selection
  application: Application | null;
  isArchived: boolean;
  onApplicationMutated: () => void | Promise<void>;
  // Optimistic, immediate local patch with the server's updated row.
  onApplicationUpdated?: (updated: Application) => void;
  // draft selection
  activeDraft: Partial<Application> | null;
  draftId: string | null;
  selectedDraftId: string | null;
  // Set when a direct URL visit addressed a missing or wrong-type record.
  routeNotFound?: string | null;
  // True while a direct /drafts/{id} visit is still fetching the draft.
  routeLoading?: boolean;
  onDraftSaved: (savedApp: Application) => void;
  onDraftDiscarded: () => void;
  onDraftPatched: (updated: Application) => void;
  // pending changes selection
  selectedChangeDraft?: ApplicationChangeDraft | null;
  onChangeDraftMutated?: (changeDraftId: number) => void;
};

type EditMode = "readonly" | "edit";

function DraftBadge() {
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
      Draft
    </span>
  );
}

export default function DetailPanel({
  application,
  isArchived,
  onApplicationMutated,
  onApplicationUpdated,
  activeDraft,
  draftId,
  selectedDraftId,
  routeNotFound = null,
  routeLoading = false,
  onDraftSaved,
  onDraftDiscarded,
  onDraftPatched,
  selectedChangeDraft = null,
  onChangeDraftMutated,
}: DetailPanelProps) {
  const [editMode, setEditMode] = useState<EditMode>("readonly");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraftSelected = selectedDraftId !== null && selectedDraftId === draftId;

  // Direct URL visit to a missing / wrong-type record. Surface before any
  // selection-based mode so /drafts/999999 and /drafts/{saved_id} are explicit.
  if (routeNotFound !== null) {
    return (
      <div className="flex h-56 shrink-0 flex-col overflow-hidden border-t">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">{routeNotFound}</p>
        </div>
      </div>
    );
  }

  // Direct /drafts/{id} visit still resolving — show a loading placeholder
  // rather than briefly flashing the "no selection" state.
  if (routeLoading && activeDraft === null) {
    return (
      <div className="flex h-56 shrink-0 flex-col overflow-hidden border-t">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  // Mode E: pending changes review
  if (selectedChangeDraft !== null) {
    const cd = selectedChangeDraft;
    const { original, preview, changed_fields } = cd;

    const handleApply = async () => {
      setError(null);
      setSubmitting(true);
      try {
        await applyApplicationChangeDraft(cd.id);
        onChangeDraftMutated?.(cd.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to apply changes");
      } finally {
        setSubmitting(false);
      }
    };

    const handleDiscard = async () => {
      setError(null);
      setSubmitting(true);
      try {
        await discardApplicationChangeDraft(cd.id);
        onChangeDraftMutated?.(cd.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to discard changes");
        setSubmitting(false);
      }
    };

    const FIELD_LABELS: Record<string, string> = {
      company: "Company",
      role: "Role",
      status: "Status",
      priority: "Priority",
      location: "Location",
      employment_types: "Employment types",
      current_stages: "Stages",
      job_link: "Job link",
      next_action: "Next action",
      comments: "Comments",
      engaged_days: "Engaged days",
    };

    return (
      <div className="flex h-72 shrink-0 flex-col overflow-hidden border-t">
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            {original.company} — {original.role}
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
              Pending Changes
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleApply()}
              className="rounded bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-80 disabled:opacity-50"
            >
              Apply Changes
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleDiscard()}
              className="rounded border px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        </div>
        {error && <p className="px-4 py-1 text-xs text-rose-600">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-1 pr-4 font-medium">Field</th>
                <th className="pb-1 pr-4 font-medium">Current</th>
                <th className="pb-1 font-medium">After applying</th>
              </tr>
            </thead>
            <tbody>
              {changed_fields.map((field) => {
                const origVal = original[field as keyof Application];
                const previewVal = preview[field as keyof Application];
                const fmt = (v: unknown) =>
                  Array.isArray(v) ? (v as string[]).join(", ") || "—" : String(v ?? "—");
                return (
                  <tr key={field} className="border-t">
                    <td className="py-1 pr-4 font-medium text-muted-foreground">
                      {FIELD_LABELS[field] ?? field}
                    </td>
                    <td className="py-1 pr-4 text-muted-foreground line-through">{fmt(origVal)}</td>
                    <td className="py-1 font-medium text-foreground">{fmt(previewVal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Mode A: no selection
  if (!isDraftSelected && application === null) {
    return (
      <div className="flex h-56 shrink-0 flex-col overflow-hidden border-t">
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Select an application to view details.
          </p>
        </div>
      </div>
    );
  }

  // Mode D: draft selected
  if (isDraftSelected && activeDraft !== null && draftId !== null) {
    const handleSaveDraftChanges = async (values: ApplicationFormValues) => {
      setError(null);
      setSubmitting(true);
      try {
        const updated = await patchDraft(draftId, {
          company: values.company || undefined,
          role: values.role || undefined,
          employment_types: values.employment_types,
          job_link: values.job_link || undefined,
          location: values.location || undefined,
          status: values.status || undefined,
          current_stages: values.current_stages,
          priority: values.priority || undefined,
          engaged_days: values.engaged_days,
          next_action: values.next_action,
          comments: values.comments,
        });
        onDraftPatched(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save draft");
      } finally {
        setSubmitting(false);
      }
    };

    const handleSaveApplication = async () => {
      setError(null);
      setSubmitting(true);
      try {
        const saved = await saveDraft(draftId);
        onDraftSaved(saved);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save application");
      } finally {
        setSubmitting(false);
      }
    };

    const handleDiscardDraft = async () => {
      setError(null);
      setSubmitting(true);
      try {
        await deleteDraft(draftId);
        onDraftDiscarded();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to discard draft");
        setSubmitting(false);
      }
    };

    return (
      <div className="flex h-72 shrink-0 flex-col overflow-hidden border-t">
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            {activeDraft.company || "Untitled draft"}
            {activeDraft.role ? ` — ${activeDraft.role}` : ""}
            <DraftBadge />
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveApplication}
              className="rounded bg-foreground px-2.5 py-1 text-xs font-medium text-background hover:opacity-80 disabled:opacity-50"
            >
              Save Application
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleDiscardDraft}
              className="rounded border px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              Discard Draft
            </button>
          </div>
        </div>
        {error && (
          <p className="px-4 py-1 text-xs text-rose-600">{error}</p>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ApplicationForm
            initial={activeDraft}
            submitting={submitting}
            submitLabel="Save Draft Changes"
            onSubmit={handleSaveDraftChanges}
          />
        </div>
      </div>
    );
  }

  // Modes B + C: saved application selected
  if (application !== null) {
    // Mode C: edit form
    if (editMode === "edit") {
      const handleSaveChanges = async (values: ApplicationFormValues) => {
        setError(null);
        setSubmitting(true);
        try {
          const payload: ApplicationUpdatePayload = {
            company: values.company || undefined,
            role: values.role || undefined,
            employment_types_json: values.employment_types,
            job_link: values.job_link || undefined,
            location: values.location || undefined,
            status: values.status || undefined,
            current_stages_json: values.current_stages,
            priority: values.priority || undefined,
            engaged_days: values.engaged_days,
            next_action: values.next_action,
            comments: values.comments,
          };
          const updated = await updateApplication(application.id, payload);
          // Reflect the change in the table immediately, then refetch for the
          // authoritative state (e.g. server-derived fields).
          onApplicationUpdated?.(updated);
          setEditMode("readonly");
          await onApplicationMutated();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to save changes");
        } finally {
          setSubmitting(false);
        }
      };

      return (
        <div className="flex h-72 shrink-0 flex-col overflow-hidden border-t">
          <div className="flex shrink-0 items-center justify-between px-4 py-2">
            <span className="text-sm font-medium">
              {application.company}
              {application.role ? ` — ${application.role}` : ""}
            </span>
            <span className="text-xs text-muted-foreground">Editing</span>
          </div>
          {error && (
            <p className="px-4 py-1 text-xs text-rose-600">{error}</p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ApplicationForm
              initial={application}
              submitting={submitting}
              submitLabel="Save Changes"
              onSubmit={handleSaveChanges}
              extraActions={
                <button
                  type="button"
                  onClick={() => {
                    setEditMode("readonly");
                    setError(null);
                  }}
                  className="rounded border px-3 py-1 text-xs hover:bg-muted"
                >
                  Cancel
                </button>
              }
            />
          </div>
        </div>
      );
    }

    // Mode B: read-only detail
    return (
      <div className="flex h-56 shrink-0 flex-col overflow-hidden border-t">
        <div className="flex shrink-0 items-center justify-between px-4 py-2">
          <span className="text-sm font-medium">
            {application.company}
            {application.role ? ` — ${application.role}` : ""}
          </span>
          <div className="flex items-center gap-2">
            {!isArchived && (
              <button
                type="button"
                onClick={() => {
                  setEditMode("edit");
                  setError(null);
                }}
                className="rounded border px-2.5 py-1 text-xs hover:bg-muted"
              >
                Edit
              </button>
            )}
            <ArchiveButton
              application={application}
              isArchived={isArchived}
              onMutated={onApplicationMutated}
            />
          </div>
        </div>

        <Tabs defaultValue="notes" className="flex min-h-0 flex-1 flex-col px-4 pb-2">
          <TabsList className="shrink-0">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
          <TabsContent value="notes" className="min-h-0 flex-1 overflow-y-auto">
            <NotesTab applicationId={application.id} />
          </TabsContent>
          <TabsContent value="timeline" className="min-h-0 flex-1 overflow-y-auto">
            <TimelineTab applicationId={application.id} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Fallback: neither draft nor saved app matched — show placeholder
  return (
    <div className="flex h-56 shrink-0 flex-col overflow-hidden border-t">
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select an application to view details.
        </p>
      </div>
    </div>
  );
}
