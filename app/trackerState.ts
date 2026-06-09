import type { Application } from "@/lib/types";

export type ApplicationRecord = Application;

export type ApplicationFormState = Omit<ApplicationRecord, "id" | "created_at" | "updated_at">;

export type ActiveDraftState = {
  company: string;
  roles: string[];
  employment_types: string[];
  job_link: string;
  location: string;
  status: string;
  current_stages: string[];
  priority: string;
  engaged_days: number | null;
  next_action: string;
  comments: string;
};

export function toggleMultiSelectValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function normalizeApplicationRecord(record: ApplicationRecord): ApplicationRecord {
  return {
    ...record,
    roles: Array.isArray(record.roles) ? record.roles : [],
    employment_types: Array.isArray(record.employment_types) ? record.employment_types : [],
    current_stages: Array.isArray(record.current_stages) ? record.current_stages : [],
    company: record.company ?? "",
    job_link: record.job_link ?? "",
    location: record.location ?? "",
    status: record.status ?? "",
    priority: record.priority ?? "",
    engaged_days: Number.isInteger(record.engaged_days) ? record.engaged_days : 0,
    next_action: record.next_action ?? "",
    comments: record.comments ?? "",
  };
}

export function upsertApplicationRecord(records: ApplicationRecord[], savedRecord: ApplicationRecord) {
  const normalizedRecord = normalizeApplicationRecord(savedRecord);
  const existingIndex = records.findIndex((record) => record.id === normalizedRecord.id);

  if (existingIndex === -1) {
    return [normalizedRecord, ...records];
  }

  return records.map((record) => (record.id === normalizedRecord.id ? normalizedRecord : record));
}

export function toActiveDraftState(value: ApplicationFormState): ActiveDraftState {
  return {
    company: value.company,
    roles: value.roles,
    employment_types: value.employment_types,
    job_link: value.job_link,
    location: value.location,
    status: value.status,
    current_stages: value.current_stages,
    priority: value.priority,
    engaged_days: Number.isFinite(value.engaged_days) ? value.engaged_days : null,
    next_action: value.next_action,
    comments: value.comments,
  };
}
