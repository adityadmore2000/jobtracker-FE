"use client";

import { useState, useEffect } from "react";
import type { Application } from "@/lib/types";

const STATUS_OPTIONS = ["", "in_touch", "applied", "accepted", "rejected"] as const;
const PRIORITY_OPTIONS = ["", "LOW", "MEDIUM", "HIGH"] as const;
const LOCATION_OPTIONS = ["", "remote", "hybrid", "onsite"] as const;
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
  rolesInput: string;
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
    rolesInput: (app.roles ?? []).join(", "),
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

export function parseRoles(rolesInput: string): string[] {
  return rolesInput
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
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

export default function ApplicationForm({
  initial,
  submitting,
  submitLabel,
  onSubmit,
  extraActions,
}: ApplicationFormProps) {
  const [values, setValues] = useState<ApplicationFormValues>(() => toFormValues(initial));

  // Reset form when the initial application changes (e.g. switching selected rows)
  useEffect(() => {
    setValues(toFormValues(initial));
  }, [initial]);

  const set = <K extends keyof ApplicationFormValues>(key: K, value: ApplicationFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

      {/* Row 2: roles (comma-separated) */}
      <div className={fieldCls}>
        <label className={labelCls}>Roles (comma-separated)</label>
        <input
          className={inputCls}
          value={values.rolesInput}
          onChange={(e) => set("rolesInput", e.target.value)}
          placeholder="e.g. AI Engineer, RAG Engineer"
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
