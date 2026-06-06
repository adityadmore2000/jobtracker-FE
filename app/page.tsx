"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  ApplicationFormState,
  ApplicationRecord,
  normalizeApplicationRecord,
  toggleMultiSelectValue,
  upsertApplicationRecord,
} from "./trackerState";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "./config";

const ROLE_OPTIONS = [
  "AI Engineer",
  "Generative AI Engineer",
  "GenAI Engineer",
  "LLM Engineer",
  "RAG Engineer",
  "AI Systems Engineer",
  "ML Engineer",
  "Computer Vision Engineer",
  "Agentic AI Engineer",
  "Data Science",
  "Prompt Engineer",
  "Platform Engineer",
  "GET",
  "AI Product Engineer",
] as const;

const TYPE_OPTIONS = ["Internship", "Full Time", "Part Time"] as const;
const LOCATION_OPTIONS = ["remote", "hybrid", "onsite"] as const;
const STAGE_OPTIONS = ["Tailored", "Applied", "Networked", "Engaged", "COLD_MAIL", "Followed up"] as const;
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"] as const;
const STATUS_OPTIONS = ["Interested", "Applied", "Rejected", "Interview", "Offer", "Archived"] as const;

type BrowserContext = {
  id: number;
  url: string;
  page_title: string;
  captured_at: string;
};

type BrowserContextStatus = "idle" | "loading" | "loaded" | "error";
type TranscriptStatus = "idle" | "parsing" | "draft-ready" | "applying-correction" | "saving" | "saved" | "error";

type JobDraftPatch = {
  company: string | null;
  roles_add: string[];
  roles_remove: string[];
  employment_types_add: string[];
  employment_types_remove: string[];
  job_link: string | null;
  use_latest_browser_url: boolean;
  location: string | null;
  status: string | null;
  current_stages_add: string[];
  current_stages_remove: string[];
  priority: string | null;
  engaged_days: number | null;
  next_action: string | null;
  comments_replace: string | null;
  comments_append: string | null;
};

type ParsedTranscriptCommand = {
  intent: "ADD_APPLICATION" | "PATCH_ACTIVE_DRAFT" | "SAVE_ACTIVE_DRAFT" | "CANCEL_ACTIVE_DRAFT" | "UNKNOWN";
  patch: JobDraftPatch;
  raw_transcript: string;
  warnings: string[];
};

type ApplicationCreateCandidateRequest = ApplicationFormState & {
  raw_transcript?: string | null;
  original_extracted_company_name?: string | null;
  audio_reference?: string | null;
};

type ApplicationCreateCandidateResponse =
  | {
      status: "created";
      requires_confirmation: false;
      application: ApplicationRecord;
    }
  | {
      status: "confirmation_required";
      requires_confirmation: true;
      candidate: ApplicationCreateCandidateRequest;
    };

type PendingCompanyConfirmation = {
  source: "form" | "draft";
  candidate: ApplicationCreateCandidateRequest;
  confirmedCompanyName: string;
};

type DraftAsrContext = {
  rawTranscript: string | null;
  originalExtractedCompanyName: string | null;
  audioReference: string | null;
};

const emptyForm: ApplicationFormState = {
  company: "",
  roles_json: [],
  employment_types_json: [],
  job_link: "",
  location: "",
  status: "",
  current_stages_json: [],
  priority: "",
  engaged_days: 0,
  next_action: "",
  comments: "",
};

function toFormState(record: ApplicationRecord): ApplicationFormState {
  return {
    company: record.company,
    roles_json: record.roles_json,
    employment_types_json: record.employment_types_json,
    job_link: record.job_link,
    location: record.location,
    status: normalizeStatusForSelect(record.status),
    current_stages_json: record.current_stages_json,
    priority: record.priority,
    engaged_days: record.engaged_days,
    next_action: record.next_action,
    comments: record.comments,
  };
}

function normalizeStatusForSelect(status: string) {
  return STATUS_OPTIONS.find((option) => option.toLowerCase() === status.toLowerCase()) ?? "";
}

function matchesText(value: string, search: string) {
  return value.toLowerCase().includes(search.toLowerCase());
}

function stringValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function stringListValue(formData: FormData, name: string) {
  return formData.getAll(name).filter((value): value is string => typeof value === "string");
}

function formStateFromFormData(formData: FormData): ApplicationFormState {
  return {
    company: stringValue(formData, "company"),
    roles_json: stringListValue(formData, "roles_json"),
    employment_types_json: stringListValue(formData, "employment_types_json"),
    job_link: stringValue(formData, "job_link"),
    location: stringValue(formData, "location"),
    status: normalizeStatusForSelect(stringValue(formData, "status")),
    current_stages_json: stringListValue(formData, "current_stages_json"),
    priority: stringValue(formData, "priority"),
    engaged_days: Number(stringValue(formData, "engaged_days")),
    next_action: stringValue(formData, "next_action"),
    comments: stringValue(formData, "comments"),
  };
}

function sameValues(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function addUniqueValues(currentValues: string[], valuesToAdd: string[]) {
  return valuesToAdd.reduce((nextValues, value) => {
    return nextValues.includes(value) ? nextValues : [...nextValues, value];
  }, currentValues);
}

function removeValues(currentValues: string[], valuesToRemove: string[]) {
  return currentValues.filter((value) => !valuesToRemove.includes(value));
}

function appendText(currentValue: string, appendedValue: string) {
  const cleanCurrent = currentValue.trim();
  const cleanAppend = appendedValue.trim();
  if (!cleanCurrent) {
    return cleanAppend;
  }
  if (!cleanAppend) {
    return cleanCurrent;
  }
  return `${cleanCurrent}\n${cleanAppend}`;
}

function areFormStatesEqual(left: ApplicationFormState, right: ApplicationFormState) {
  return (
    left.company === right.company &&
    sameValues(left.roles_json, right.roles_json) &&
    sameValues(left.employment_types_json, right.employment_types_json) &&
    left.job_link === right.job_link &&
    left.location === right.location &&
    left.status === right.status &&
    sameValues(left.current_stages_json, right.current_stages_json) &&
    left.priority === right.priority &&
    left.engaged_days === right.engaged_days &&
    left.next_action === right.next_action &&
    left.comments === right.comments
  );
}

async function requestJson<T>(path: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
    });
    const responseText = await response.text();
    const responseBody = responseText ? JSON.parse(responseText) : null;

    if (!response.ok) {
      const detail = responseBody?.detail;
      throw new Error(typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : `Request failed with ${response.status}.`);
    }

    return responseBody as T;
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError") {
      throw new Error("The API request timed out. Check that the backend is running and try again.");
    }

    if (caught instanceof SyntaxError) {
      throw new Error("The API returned an unreadable response.");
    }

    throw caught;
  } finally {
    window.clearTimeout(timeout);
  }
}

function Chips({ values }: { values: string[] }) {
  if (!values.length) {
    return <span className="muted">-</span>;
  }

  return (
    <div className="chips">
      {values.map((value) => (
        <span className="chip" key={value}>
          {value}
        </span>
      ))}
    </div>
  );
}

function MultiSelectField({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <fieldset className="field fieldset">
      <legend>{label}</legend>
      <div className="checkGrid">
        {options.map((option) => (
          <label className="checkItem" key={option}>
            <input
              name={label === "Role" ? "roles_json" : label === "Type" ? "employment_types_json" : "current_stages_json"}
              type="checkbox"
              value={option}
              checked={values.includes(option)}
              onChange={() => onChange(toggleMultiSelectValue(values, option))}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ApplicationForm({
  mode,
  heading,
  submitLabel,
  savingLabel,
  cancelLabel,
  value,
  error,
  saving,
  onChange,
  onCancel,
  cancelDisabled,
  onSubmit,
  browserContext,
  browserContextStatus,
  browserContextError,
  onUseCapturedUrl,
}: {
  mode: "add" | "edit";
  heading?: string;
  submitLabel?: string;
  savingLabel?: string;
  cancelLabel?: string;
  value: ApplicationFormState;
  error: string;
  saving: boolean;
  onChange: (value: ApplicationFormState) => void;
  onCancel: () => void;
  cancelDisabled: boolean;
  onSubmit: (nextValue: ApplicationFormState) => void;
  browserContext: BrowserContext | null;
  browserContextStatus: BrowserContextStatus;
  browserContextError: string;
  onUseCapturedUrl: () => void;
}) {
  function update<K extends keyof ApplicationFormState>(key: K, nextValue: ApplicationFormState[K]) {
    onChange({ ...value, [key]: nextValue });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValue = formStateFromFormData(new FormData(event.currentTarget));
    onChange(nextValue);
    onSubmit(nextValue);
  }

  return (
    <form className="formPanel" onSubmit={submit}>
      <div className="formHeader">
        <h2>{heading ?? (mode === "add" ? "Add Application" : "Edit Application")}</h2>
        <button className="secondaryButton" type="button" onClick={onCancel} disabled={cancelDisabled}>
          {cancelLabel ?? "Cancel"}
        </button>
      </div>

      {error ? <p className="errorText">{error}</p> : null}

      <div className="formGrid">
        <label className="field">
          <span>Company</span>
          <input
            name="company"
            required
            value={value.company}
            onChange={(event) => update("company", event.target.value)}
            placeholder="Bootcoding Pvt. LTD"
          />
        </label>

        <label className="field">
          <span>JOB LINK</span>
          <input
            name="job_link"
            type="url"
            value={value.job_link}
            onChange={(event) => update("job_link", event.target.value)}
            placeholder="https://example.com/job"
          />
        </label>

        <div className="capturedContext">
          <span>Latest captured page</span>
          {browserContextStatus === "loading" ? <p>Loading captured page...</p> : null}
          {browserContextStatus === "error" ? <p className="inlineError">Unable to load captured page: {browserContextError}</p> : null}
          {browserContextStatus === "loaded" && !browserContext ? <p>No captured page available</p> : null}
          {browserContextStatus === "loaded" && browserContext ? (
            <>
              <p className="contextStatus">Latest captured page available</p>
              <strong>{browserContext.page_title || "Untitled page"}</strong>
              <a href={browserContext.url} rel="noreferrer" target="_blank">
                {browserContext.url}
              </a>
            </>
          ) : null}
          <button className="secondaryButton" disabled={!browserContext} type="button" onClick={onUseCapturedUrl}>
            Use captured URL
          </button>
        </div>

        <label className="field">
          <span>LOCATION</span>
          <select name="location" value={value.location} onChange={(event) => update("location", event.target.value)}>
            <option value="">None</option>
            {LOCATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>PRIORITY</span>
          <select name="priority" value={value.priority} onChange={(event) => update("priority", event.target.value)}>
            <option value="">None</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>STATUS</span>
          <select name="status" value={value.status} onChange={(event) => update("status", event.target.value)}>
            <option value="">None</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>ENGAGED (# OF DAYS)</span>
          <input
            min="0"
            name="engaged_days"
            type="number"
            value={value.engaged_days}
            onChange={(event) => update("engaged_days", Number(event.target.value))}
          />
        </label>

        <MultiSelectField
          label="Role"
          options={ROLE_OPTIONS}
          values={value.roles_json}
          onChange={(nextValues) => update("roles_json", nextValues)}
        />

        <MultiSelectField
          label="Type"
          options={TYPE_OPTIONS}
          values={value.employment_types_json}
          onChange={(nextValues) => update("employment_types_json", nextValues)}
        />

        <MultiSelectField
          label="Current Stage"
          options={STAGE_OPTIONS}
          values={value.current_stages_json}
          onChange={(nextValues) => update("current_stages_json", nextValues)}
        />

        <label className="field wide">
          <span>NEXT ACTION</span>
          <textarea name="next_action" value={value.next_action} onChange={(event) => update("next_action", event.target.value)} />
        </label>

        <label className="field wide">
          <span>COMMENTS</span>
          <textarea name="comments" value={value.comments} onChange={(event) => update("comments", event.target.value)} />
        </label>
      </div>

      <div className="formActions">
        <button className="primaryButton" disabled={saving} type="submit">
          {saving ? savingLabel ?? "Saving..." : submitLabel ?? "Save"}
        </button>
      </div>
    </form>
  );
}

export default function Home() {
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formValue, setFormValue] = useState<ApplicationFormState>(emptyForm);
  const [initialFormValue, setInitialFormValue] = useState<ApplicationFormState>(emptyForm);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [browserContext, setBrowserContext] = useState<BrowserContext | null>(null);
  const [browserContextStatus, setBrowserContextStatus] = useState<BrowserContextStatus>("idle");
  const [browserContextError, setBrowserContextError] = useState("");
  const [transcript, setTranscript] = useState("");
  const [correctionTranscript, setCorrectionTranscript] = useState("");
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>("idle");
  const [transcriptError, setTranscriptError] = useState("");
  const [transcriptWarnings, setTranscriptWarnings] = useState<string[]>([]);
  const [draftValue, setDraftValue] = useState<ApplicationFormState | null>(null);
  const [draftAsrContext, setDraftAsrContext] = useState<DraftAsrContext | null>(null);
  const [draftError, setDraftError] = useState("");
  const [showDraftDiscardModal, setShowDraftDiscardModal] = useState(false);
  const [pendingCompanyConfirmation, setPendingCompanyConfirmation] = useState<PendingCompanyConfirmation | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    role: "",
    type: "",
    location: "",
    status: "",
    currentStage: "",
    priority: "",
  });

  const loadRecords = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) {
      setLoading(true);
    }
    setError("");
    try {
      const applications = await requestJson<ApplicationRecord[]>("/applications");
      setRecords(applications.map(normalizeApplicationRecord));
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load applications.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const loadLatestBrowserContext = useCallback(async () => {
    setBrowserContextStatus("loading");
    setBrowserContextError("");
    try {
      const response = await requestJson<{ context: BrowserContext | null }>("/browser-context/latest");
      setBrowserContext(response.context);
      setBrowserContextStatus("loaded");
    } catch (caught) {
      setBrowserContext(null);
      setBrowserContextError(caught instanceof Error ? caught.message : "Unable to load captured page.");
      setBrowserContextStatus("error");
    }
  }, []);

  useEffect(() => {
    loadLatestBrowserContext();
  }, [loadLatestBrowserContext]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(records.map((record) => record.status).filter(Boolean))).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const searchMatches =
        !search ||
        matchesText(record.company, search) ||
        matchesText(record.comments, search) ||
        matchesText(record.next_action, search);

      return (
        searchMatches &&
        (!filters.role || record.roles_json.includes(filters.role)) &&
        (!filters.type || record.employment_types_json.includes(filters.type)) &&
        (!filters.location || record.location === filters.location) &&
        (!filters.status || record.status === filters.status) &&
        (!filters.currentStage || record.current_stages_json.includes(filters.currentStage)) &&
        (!filters.priority || record.priority === filters.priority)
      );
    });
  }, [filters, records, search]);

  function resetForm() {
    setFormMode("add");
    setEditingId(null);
    setFormValue(emptyForm);
    setInitialFormValue(emptyForm);
    setFormError("");
  }

  function startEdit(record: ApplicationRecord) {
    const nextFormValue = toFormState(record);
    setFormMode("edit");
    setEditingId(record.id);
    setFormValue(nextFormValue);
    setInitialFormValue(nextFormValue);
    setFormError("");
    loadLatestBrowserContext();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const formIsDirty = !areFormStatesEqual(formValue, initialFormValue);
  const cancelDisabled = formMode === "add" && !formIsDirty;

  function requestCancel() {
    if (cancelDisabled) {
      return;
    }

    if (formIsDirty) {
      setShowDiscardModal(true);
      return;
    }

    resetForm();
  }

  function confirmDiscard() {
    setShowDiscardModal(false);
    resetForm();
  }

  function useCapturedUrl() {
    if (!browserContext) {
      return;
    }

    setFormValue((currentValue) => ({
      ...currentValue,
      job_link: browserContext.url,
    }));
  }

  async function getLatestBrowserContextForDraft() {
    const response = await requestJson<{ context: BrowserContext | null }>("/browser-context/latest");
    setBrowserContext(response.context);
    setBrowserContextStatus("loaded");
    return response.context;
  }

  async function applyDraftPatch(currentDraft: ApplicationFormState, patch: JobDraftPatch) {
    const nextDraft: ApplicationFormState = {
      ...currentDraft,
      roles_json: removeValues(addUniqueValues(currentDraft.roles_json, patch.roles_add), patch.roles_remove),
      employment_types_json: removeValues(
        addUniqueValues(currentDraft.employment_types_json, patch.employment_types_add),
        patch.employment_types_remove,
      ),
      current_stages_json: removeValues(addUniqueValues(currentDraft.current_stages_json, patch.current_stages_add), patch.current_stages_remove),
    };
    const warnings: string[] = [];

    if (patch.company !== null) {
      nextDraft.company = patch.company;
    }
    if (patch.job_link !== null) {
      nextDraft.job_link = patch.job_link;
    }
    if (patch.use_latest_browser_url) {
      try {
        const latestContext = await getLatestBrowserContextForDraft();
        if (latestContext) {
          nextDraft.job_link = latestContext.url;
        } else {
          warnings.push("Latest captured browser URL is unavailable.");
        }
      } catch (caught) {
        warnings.push(caught instanceof Error ? `Latest captured browser URL is unavailable: ${caught.message}` : "Latest captured browser URL is unavailable.");
      }
    }
    if (patch.location !== null) {
      nextDraft.location = patch.location;
    }
    if (patch.status !== null) {
      nextDraft.status = normalizeStatusForSelect(patch.status);
    }
    if (patch.priority !== null) {
      nextDraft.priority = patch.priority;
    }
    if (patch.engaged_days !== null) {
      nextDraft.engaged_days = patch.engaged_days;
    }
    if (patch.next_action !== null) {
      nextDraft.next_action = patch.next_action;
    }
    if (patch.comments_replace !== null) {
      nextDraft.comments = patch.comments_replace;
    }
    if (patch.comments_append !== null) {
      nextDraft.comments = appendText(nextDraft.comments, patch.comments_append);
    }

    return { nextDraft, warnings };
  }

  async function parseTranscriptCommand() {
    setTranscriptError("");
    setTranscriptWarnings([]);
    const trimmedTranscript = transcript.trim();
    if (!trimmedTranscript) {
      setTranscriptError("Enter a transcript to parse.");
      setTranscriptStatus("error");
      return;
    }

    setTranscriptStatus("parsing");
    setDraftError("");
    try {
      const parsed = await requestJson<ParsedTranscriptCommand>("/transcript/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: trimmedTranscript }),
      });
      const { nextDraft, warnings } = await applyDraftPatch(emptyForm, parsed.patch);
      setDraftValue(nextDraft);
      setDraftAsrContext({
        rawTranscript: parsed.raw_transcript,
        originalExtractedCompanyName: parsed.patch.company,
        audioReference: null,
      });
      setTranscriptWarnings([...parsed.warnings, ...warnings]);
      setTranscriptStatus("draft-ready");
    } catch (caught) {
      setTranscriptError(caught instanceof Error ? caught.message : "Transcript parsing failed.");
      setTranscriptStatus("error");
    }
  }

  async function applyCorrectionTranscript() {
    setTranscriptError("");
    setTranscriptWarnings([]);
    if (!draftValue) {
      setTranscriptError("Create a draft before applying a correction.");
      setTranscriptStatus("error");
      return;
    }

    const trimmedCorrection = correctionTranscript.trim();
    if (!trimmedCorrection) {
      setTranscriptError("Enter a correction transcript to apply.");
      setTranscriptStatus("error");
      return;
    }

    setTranscriptStatus("applying-correction");
    setDraftError("");
    try {
      const parsed = await requestJson<ParsedTranscriptCommand>("/transcript/parse-correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: trimmedCorrection }),
      });
      const { nextDraft, warnings } = await applyDraftPatch(draftValue, parsed.patch);
      setDraftValue(nextDraft);
      setTranscriptWarnings([...parsed.warnings, ...warnings]);
      setCorrectionTranscript("");
      setTranscriptStatus("draft-ready");
    } catch (caught) {
      setTranscriptError(caught instanceof Error ? caught.message : "Correction parsing failed.");
      setTranscriptStatus("error");
    }
  }

  async function saveDraft(nextValue = draftValue) {
    if (!nextValue) {
      return;
    }
    if (!nextValue.company.trim()) {
      setDraftError("Company is required.");
      return;
    }

    setTranscriptStatus("saving");
    setDraftError("");
    setTranscriptError("");
    try {
      await submitCreateCandidate(
        {
          ...nextValue,
          raw_transcript: draftAsrContext?.rawTranscript ?? null,
          original_extracted_company_name: draftAsrContext?.originalExtractedCompanyName ?? null,
          audio_reference: draftAsrContext?.audioReference ?? null,
        },
        "draft",
      );
    } catch (caught) {
      setDraftError(caught instanceof Error ? caught.message : "Draft save failed.");
      setTranscriptStatus("error");
    }
  }

  function requestDraftDiscard() {
    if (!draftValue) {
      return;
    }
    setShowDraftDiscardModal(true);
  }

  function confirmDraftDiscard() {
    setShowDraftDiscardModal(false);
    setDraftValue(null);
    setDraftAsrContext(null);
    setCorrectionTranscript("");
    setTranscriptWarnings([]);
    setDraftError("");
    setTranscriptStatus("idle");
  }

  async function handleCreatedApplication(savedRecord: ApplicationRecord, source: "form" | "draft") {
    setRecords((currentRecords) => upsertApplicationRecord(currentRecords, savedRecord));
    if (source === "draft") {
      setDraftValue(null);
      setDraftAsrContext(null);
      setTranscript("");
      setCorrectionTranscript("");
      setTranscriptWarnings([]);
      setTranscriptStatus("saved");
    } else {
      resetForm();
    }
    await loadRecords({ showLoading: false });
  }

  async function submitCreateCandidate(candidate: ApplicationCreateCandidateRequest, source: "form" | "draft") {
    const response = await requestJson<ApplicationCreateCandidateResponse>("/applications/create-candidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(candidate),
    });

    if (response.status === "created") {
      await handleCreatedApplication(response.application, source);
      return;
    }

    setPendingCompanyConfirmation({
      source,
      candidate: response.candidate,
      confirmedCompanyName: response.candidate.company,
    });
    if (source === "draft") {
      setTranscriptStatus("draft-ready");
    }
  }

  async function confirmPendingCompany() {
    if (!pendingCompanyConfirmation) {
      return;
    }

    const confirmedCompanyName = pendingCompanyConfirmation.confirmedCompanyName.trim();
    if (!confirmedCompanyName) {
      if (pendingCompanyConfirmation.source === "draft") {
        setDraftError("Confirmed company name is required.");
      } else {
        setFormError("Confirmed company name is required.");
      }
      return;
    }

    try {
      const savedRecord = await requestJson<ApplicationRecord>("/applications/confirm-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingCompanyConfirmation.candidate,
          confirmed_company_name: confirmedCompanyName,
        }),
      });
      const source = pendingCompanyConfirmation.source;
      setPendingCompanyConfirmation(null);
      await handleCreatedApplication(savedRecord, source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Company confirmation failed.";
      if (pendingCompanyConfirmation.source === "draft") {
        setDraftError(message);
        setTranscriptStatus("error");
      } else {
        setFormError(message);
      }
    }
  }

  async function saveForm(nextValue = formValue) {
    if (!nextValue.company.trim()) {
      setFormError("Company is required.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      if (formMode === "edit" && editingId) {
        const savedRecord = await requestJson<ApplicationRecord>(`/applications/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextValue),
        });
        setRecords((currentRecords) => upsertApplicationRecord(currentRecords, savedRecord));
        resetForm();
        await loadRecords({ showLoading: false });
      } else {
        await submitCreateCandidate(nextValue, "form");
      }
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete(id: number) {
    setError("");
    try {
      await requestJson<null>(`/applications/${id}`, { method: "DELETE" });
      setPendingDeleteId(null);
      setRecords((currentRecords) => currentRecords.filter((record) => record.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Delete failed.");
    }
  }

  return (
    <main className="pageShell">
      <header className="topBar">
        <div>
          <p className="eyebrow">ApplicationOps MVP</p>
          <h1>Job Application Tracker</h1>
        </div>
        <button className="secondaryButton" type="button" onClick={() => loadRecords()}>
          Refresh
        </button>
      </header>

      <ApplicationForm
        mode={formMode}
        value={formValue}
        error={formError}
        saving={saving}
        onChange={setFormValue}
        onCancel={requestCancel}
        cancelDisabled={cancelDisabled}
        onSubmit={saveForm}
        browserContext={browserContext}
        browserContextStatus={browserContextStatus}
        browserContextError={browserContextError}
        onUseCapturedUrl={useCapturedUrl}
      />

      <section className="formPanel transcriptPanel">
        <div className="formHeader">
          <h2>Transcript Command</h2>
        </div>

        {transcriptError ? <p className="errorText">{transcriptError}</p> : null}
        {transcriptWarnings.length ? (
          <div className="warningBox">
            {transcriptWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        {transcriptStatus === "saved" ? <p className="successText">Draft saved as an application.</p> : null}

        <label className="field">
          <span>Transcript</span>
          <textarea
            className="transcriptInput"
            placeholder="Add a Bootcoding AI Engineer internship. Use the current link. Set priority to medium. Add Tailored and Applied stages."
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
        </label>
        <div className="formActions">
          <button className="primaryButton" disabled={transcriptStatus === "parsing"} type="button" onClick={parseTranscriptCommand}>
            {transcriptStatus === "parsing" ? "Parsing transcript..." : "Parse Transcript"}
          </button>
        </div>
      </section>

      {draftValue ? (
        <>
          <ApplicationForm
            mode="add"
            heading="Structured Draft Preview"
            submitLabel="Save Application"
            savingLabel="Saving..."
            cancelLabel="Discard Draft"
            value={draftValue}
            error={draftError}
            saving={transcriptStatus === "saving"}
            onChange={(nextValue) => setDraftValue(nextValue)}
            onCancel={requestDraftDiscard}
            cancelDisabled={false}
            onSubmit={saveDraft}
            browserContext={browserContext}
            browserContextStatus={browserContextStatus}
            browserContextError={browserContextError}
            onUseCapturedUrl={() => {
              if (!browserContext) {
                return;
              }
              setDraftValue((currentDraft) => (currentDraft ? { ...currentDraft, job_link: browserContext.url } : currentDraft));
            }}
          />

          <section className="formPanel transcriptPanel">
            <div className="formHeader">
              <h2>Correction Transcript</h2>
            </div>
            <label className="field">
              <span>Correction</span>
              <textarea
                className="transcriptInput"
                placeholder="Remove Agentic AI Engineer tag. Add Networked stage. Append comment saying one request is pending."
                value={correctionTranscript}
                onChange={(event) => setCorrectionTranscript(event.target.value)}
              />
            </label>
            <div className="formActions">
              <button
                className="primaryButton"
                disabled={transcriptStatus === "applying-correction"}
                type="button"
                onClick={applyCorrectionTranscript}
              >
                {transcriptStatus === "applying-correction" ? "Applying correction..." : "Apply Correction"}
              </button>
            </div>
          </section>
        </>
      ) : null}

      {showDiscardModal ? (
        <div className="modalBackdrop" role="presentation">
          <div aria-modal="true" className="modalPanel" role="dialog">
            <h2>Discard changes?</h2>
            <p>Unsaved edits in the tracker form will be lost.</p>
            <div className="modalActions">
              <button className="dangerButton" type="button" onClick={confirmDiscard}>
                Discard
              </button>
              <button className="secondaryButton" type="button" onClick={() => setShowDiscardModal(false)}>
                Keep editing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDraftDiscardModal ? (
        <div className="modalBackdrop" role="presentation">
          <div aria-modal="true" className="modalPanel" role="dialog">
            <h2>Discard draft?</h2>
            <p>The structured transcript draft will be lost.</p>
            <div className="modalActions">
              <button className="dangerButton" type="button" onClick={confirmDraftDiscard}>
                Discard
              </button>
              <button className="secondaryButton" type="button" onClick={() => setShowDraftDiscardModal(false)}>
                Keep editing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingCompanyConfirmation ? (
        <div className="modalBackdrop" role="presentation">
          <div aria-modal="true" className="modalPanel" role="dialog">
            <h2>Confirm company name</h2>
            <label className="field">
              <span>Company</span>
              <input
                value={pendingCompanyConfirmation.confirmedCompanyName}
                onChange={(event) =>
                  setPendingCompanyConfirmation((current) =>
                    current ? { ...current, confirmedCompanyName: event.target.value } : current,
                  )
                }
              />
            </label>
            {pendingCompanyConfirmation.candidate.roles_json.length ? (
              <p>Role: {pendingCompanyConfirmation.candidate.roles_json.join(", ")}</p>
            ) : null}
            <div className="modalActions">
              <button className="secondaryButton" type="button" onClick={() => setPendingCompanyConfirmation(null)}>
                Cancel
              </button>
              <button className="primaryButton" type="button" onClick={confirmPendingCompany}>
                Confirm and Add
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="controls">
        <label className="field searchField">
          <span>Search Company, COMMENTS, NEXT ACTION</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>

        <label className="field">
          <span>Role</span>
          <select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}>
            <option value="">All</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Type</span>
          <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">All</option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>LOCATION</span>
          <select value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })}>
            <option value="">All</option>
            {LOCATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>STATUS</span>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Current Stage</span>
          <select
            value={filters.currentStage}
            onChange={(event) => setFilters({ ...filters, currentStage: event.target.value })}
          >
            <option value="">All</option>
            {STAGE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>PRIORITY</span>
          <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
            <option value="">All</option>
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="tableSection">
        {error ? <p className="errorText">{error}</p> : null}
        {loading ? <p className="stateText">Loading applications...</p> : null}
        {!loading && !filteredRecords.length ? <p className="stateText">No applications match the current view.</p> : null}

        {!loading && filteredRecords.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Type</th>
                  <th>JOB LINK</th>
                  <th>LOCATION</th>
                  <th>STATUS</th>
                  <th>Current Stage</th>
                  <th>PRIORITY</th>
                  <th>ENGAGED (# OF DAYS)</th>
                  <th>NEXT ACTION</th>
                  <th>COMMENTS</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.company}</td>
                    <td>
                      <Chips values={record.roles_json} />
                    </td>
                    <td>
                      <Chips values={record.employment_types_json} />
                    </td>
                    <td>
                      {record.job_link ? (
                        <a href={record.job_link} rel="noreferrer" target="_blank">
                          Open
                        </a>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>{record.location || <span className="muted">-</span>}</td>
                    <td>{record.status || <span className="muted">-</span>}</td>
                    <td>
                      <Chips values={record.current_stages_json} />
                    </td>
                    <td>{record.priority || <span className="muted">-</span>}</td>
                    <td>{record.engaged_days}</td>
                    <td>{record.next_action || <span className="muted">-</span>}</td>
                    <td>{record.comments || <span className="muted">-</span>}</td>
                    <td className="actionsCell">
                      <button className="secondaryButton" type="button" onClick={() => startEdit(record)}>
                        Edit
                      </button>
                      {pendingDeleteId === record.id ? (
                        <div className="confirmDelete">
                          <span>Confirm?</span>
                          <button className="dangerButton" type="button" onClick={() => confirmDelete(record.id)}>
                            Delete
                          </button>
                          <button className="secondaryButton" type="button" onClick={() => setPendingDeleteId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="dangerButton" type="button" onClick={() => setPendingDeleteId(record.id)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
