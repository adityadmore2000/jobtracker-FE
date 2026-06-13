"use client";

import { useState, useEffect } from "react";
import type { Application } from "@/lib/types";

const STATUS_OPTIONS = ["", "in_touch", "applied", "accepted", "rejected"] as const;
const PRIORITY_OPTIONS = ["", "LOW", "MEDIUM", "HIGH"] as const;
const LOCATION_OPTIONS = ["", "remote", "hybrid", "on-site"] as const;
const EMPLOYMENT_TYPE_OPTIONS = ["Internship", "Full Time", "Part Time"] as const;
const CURRENT_STAGE_OPTIONS = [
  "Tailored",
  "Applied",
  "Networked",
  "Engaged",
  "COLD_MAIL",
  "Followed up",
] as const;

export type ApplicationFormValues = {
  company: string;
  role: string;
  employment_types: string[];
  job_link: string;
  location: string;
  status: string;
  current_stages: string[];
  priority: string;
  engaged_days: number;
  next_action: string;
  comments: string;
};

function toFormValues(app: Partial<Application>): ApplicationFormValues {
  return {
    company: app.company ?? "",
    role: app.role ?? "",
    employment_types: app.employment_types ?? [],
    job_link: app.job_link ?? "",
    location: app.location ?? "",
    status: app.status ?? "",
    current_stages: app.current_stages ?? [],
    priority: app.priority ?? "",
    engaged_days: app.engaged_days ?? 0,
    next_action: app.next_action ?? "",
    comments: app.comments ?? "",
  };
}


type ApplicationFormProps = {
  initial: Partial<Application>;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (values: ApplicationFormValues) => void;
  extraActions?: React.ReactNode;
};

function toggleCheckbox(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// Categorical / enum-like fields guarded against redundant (no-op) updates.
const CATEGORICAL_FIELDS = ["status", "priority", "location"] as const;
type CategoricalField = (typeof CATEGORICAL_FIELDS)[number];

const CATEGORICAL_LABELS: Record<CategoricalField, string> = {
  status: "Status",
  priority: "Priority",
  location: "Location",
};

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function hasAnyChange(initial: ApplicationFormValues, values: ApplicationFormValues): boolean {
  return (
    initial.company !== values.company ||
    initial.role !== values.role ||
    initial.job_link !== values.job_link ||
    initial.status !== values.status ||
    initial.priority !== values.priority ||
    initial.location !== values.location ||
    initial.engaged_days !== values.engaged_days ||
    initial.next_action !== values.next_action ||
    initial.comments !== values.comments ||
    !arraysEqual(initial.employment_types, values.employment_types) ||
    !arraysEqual(initial.current_stages, values.current_stages)
  );
}

export default function ApplicationForm({
  initial,
  submitting,
  submitLabel,
  onSubmit,
  extraActions,
}: ApplicationFormProps) {
  const [values, setValues] = useState<ApplicationFormValues>(() => toFormValues(initial));
  // Baseline reflecting the persisted record, used to detect redundant updates.
  const [baseline, setBaseline] = useState<ApplicationFormValues>(() => toFormValues(initial));
  const [notice, setNotice] = useState<string | null>(null);

  // Reset form when the initial application changes (e.g. switching selected rows)
  useEffect(() => {
    const next = toFormValues(initial);
    setValues(next);
    setBaseline(next);
    setNotice(null);
  }, [initial]);

  const set = <K extends keyof ApplicationFormValues>(key: K, value: ApplicationFormValues[K]) => {
    if (notice) setNotice(null);
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Block redundant updates: when no field actually changed, surface a
    // field-level message for the categorical fields rather than calling the API.
    if (!hasAnyChange(baseline, values)) {
      const unchangedCategorical = CATEGORICAL_FIELDS.find(
        (field) => baseline[field] === values[field]
      );
      if (unchangedCategorical) {
        const currentValue = values[unchangedCategorical] || "—";
        setNotice(
          `${CATEGORICAL_LABELS[unchangedCategorical]} value is already set to ${currentValue}`
        );
      } else {
        setNotice("No changes to save.");
      }
      return;
    }

    setNotice(null);
    onSubmit(values);
  };

  const inputCls =
    "w-full rounded border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-0.5";
  const fieldCls = "flex flex-col gap-0.5";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-4 py-3 text-sm">
      {/* Row 1: company + job_link */}
      <div className="grid grid-cols-2 gap-3">
        <div className={fieldCls}>
          <label className={labelCls}>Company</label>
          <input
            className={inputCls}
            value={values.company}
            onChange={(e) => set("company", e.target.value)}
            placeholder="e.g. Neilsoft"
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls}>Job link</label>
          <input
            className={inputCls}
            value={values.job_link}
            onChange={(e) => set("job_link", e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>

      {/* Row 2: role */}
      <div className={fieldCls}>
        <label className={labelCls}>Role</label>
        <input
          className={inputCls}
          value={values.role}
          onChange={(e) => set("role", e.target.value)}
          placeholder="e.g. AI Engineer"
        />
      </div>

      {/* Row 3: status + priority + location */}
      <div className="grid grid-cols-3 gap-3">
        <div className={fieldCls}>
          <label className={labelCls}>Status</label>
          <select
            className={inputCls}
            value={values.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "—"}
              </option>
            ))}
          </select>
        </div>
        <div className={fieldCls}>
          <label className={labelCls}>Priority</label>
          <select
            className={inputCls}
            value={values.priority}
            onChange={(e) => set("priority", e.target.value)}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "—"}
              </option>
            ))}
          </select>
        </div>
        <div className={fieldCls}>
          <label className={labelCls}>Location</label>
          <select
            className={inputCls}
            value={values.location}
            onChange={(e) => set("location", e.target.value)}
          >
            {LOCATION_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt || "—"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 4: employment_types checkboxes */}
      <div className={fieldCls}>
        <span className={labelCls}>Employment type</span>
        <div className="flex flex-wrap gap-3">
          {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={values.employment_types.includes(opt)}
                onChange={() => set("employment_types", toggleCheckbox(values.employment_types, opt))}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      {/* Row 5: current_stages checkboxes */}
      <div className={fieldCls}>
        <span className={labelCls}>Current stages</span>
        <div className="flex flex-wrap gap-3">
          {CURRENT_STAGE_OPTIONS.map((opt) => (
            <label key={opt} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={values.current_stages.includes(opt)}
                onChange={() => set("current_stages", toggleCheckbox(values.current_stages, opt))}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>

      {/* Row 6: engaged_days + next_action */}
      <div className="grid grid-cols-2 gap-3">
        <div className={fieldCls}>
          <label className={labelCls}>Engaged days</label>
          <input
            type="number"
            min={0}
            className={inputCls}
            value={values.engaged_days}
            onChange={(e) => set("engaged_days", Math.max(0, parseInt(e.target.value, 10) || 0))}
          />
        </div>
        <div className={fieldCls}>
          <label className={labelCls}>Next action</label>
          <input
            className={inputCls}
            value={values.next_action}
            onChange={(e) => set("next_action", e.target.value)}
            placeholder="e.g. Follow up Monday"
          />
        </div>
      </div>

      {/* Row 7: comments */}
      <div className={fieldCls}>
        <label className={labelCls}>Comments</label>
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          value={values.comments}
          onChange={(e) => set("comments", e.target.value)}
          placeholder="Notes about this application…"
        />
      </div>

      {notice && (
        <p className="text-xs text-amber-700" role="status">
          {notice}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background hover:opacity-80 disabled:opacity-50"
        >
          {submitting ? "Saving…" : submitLabel}
        </button>
        {extraActions}
      </div>
    </form>
  );
}
