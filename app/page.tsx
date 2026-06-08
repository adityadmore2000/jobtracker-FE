"use client";

import { DataPacket_Kind, Participant, Room, RoomEvent } from "livekit-client";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActiveDraftState,
  ApplicationFormState,
  ApplicationRecord,
  normalizeApplicationRecord,
  toActiveDraftState,
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
const VOICE_AGENT_IDENTITY = "job-tracker-local-agent";
const UTTERANCE_END_DRAIN_MS = 200;

type BrowserContext = {
  id: number;
  url: string;
  page_title: string;
  captured_at: string;
};

type BrowserContextStatus = "idle" | "loading" | "loaded" | "error";
type TranscriptStatus = "idle" | "parsing" | "draft-ready" | "saving" | "saved" | "error";
type VoiceStatus = "disconnected" | "connecting" | "connected" | "recording" | "processing";

type LiveKitTokenResponse = {
  url: string;
  room_name: string;
  participant_identity: string;
  access_token: string;
  expires_at: string;
};

type AgentPacket =
  | {
      type: "final_transcript";
      utterance_id: string;
      text: string;
    }
  | {
      type: "transcription_error";
      utterance_id: string;
      message: string;
    };

type SemanticFieldPatch = {
  company?: string | null;
  roles?: string[] | null;
  employment_types?: string[] | null;
  job_link?: string | null;
  location?: string | null;
  status?: string | null;
  current_stages?: string[] | null;
  priority?: string | null;
  engaged_days?: number | null;
  next_action?: string | null;
  comments?: string | null;
};

type SemanticToolCallProposal = {
  tool_name:
    | "patch_active_draft"
    | "preview_existing_application_update"
    | "request_draft_save"
    | "attach_latest_browser_context"
    | "ask_clarification"
    | null;
  arguments: Record<string, unknown>;
};

type SemanticInterpreterMetrics = {
  latency_ms: number;
  total_duration_ns: number | null;
  load_duration_ns: number | null;
  prompt_eval_duration_ns: number | null;
  eval_duration_ns: number | null;
};

type SemanticTranscriptResponse = {
  status: "preview" | "clarification_required" | "unsupported" | "unavailable";
  operation: "create" | "update" | "none";
  proposal: SemanticToolCallProposal;
  raw_transcript: string;
  application_id: number | null;
  draft: ApplicationFormState | null;
  drafts: ApplicationFormState[];
  warnings: string[];
  needs_confirmation: boolean;
  confirmation_kind: "none" | "multi_application" | "context";
  clarification_question: string | null;
  interpreter_metrics: SemanticInterpreterMetrics | null;
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

type TranscriptContext = {
  active_draft: ActiveDraftState | null;
  active_application: { application_id: number } | null;
  recent_actions: string[];
};

type DraftMode = "create" | "update";

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

function primaryRole(value: ApplicationFormState | ApplicationRecord | null) {
  return value?.roles_json[0] ?? null;
}

function pushRecentAction(recentActions: string[], nextAction: string) {
  return [...recentActions, nextAction.trim()].filter(Boolean).slice(-3);
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

function normalizeDraftFieldPatch(fields: unknown): Partial<Record<keyof SemanticFieldPatch, true>> {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return {};
  }

  return Object.fromEntries(Object.keys(fields).map((key) => [key, true])) as Partial<Record<keyof SemanticFieldPatch, true>>;
}

function mergeDraftWithExplicitPatch(currentDraft: ApplicationFormState | null, parsedDraft: ApplicationFormState, fields: unknown) {
  const explicitFields = normalizeDraftFieldPatch(fields);
  const nextDraft = currentDraft ? { ...currentDraft } : { ...emptyForm };

  if (explicitFields.company) nextDraft.company = parsedDraft.company;
  if (explicitFields.roles) nextDraft.roles_json = parsedDraft.roles_json;
  if (explicitFields.employment_types) nextDraft.employment_types_json = parsedDraft.employment_types_json;
  if (explicitFields.job_link) nextDraft.job_link = parsedDraft.job_link;
  if (explicitFields.location) nextDraft.location = parsedDraft.location;
  if (explicitFields.status) nextDraft.status = parsedDraft.status;
  if (explicitFields.current_stages) nextDraft.current_stages_json = parsedDraft.current_stages_json;
  if (explicitFields.priority) nextDraft.priority = parsedDraft.priority;
  if (explicitFields.engaged_days) nextDraft.engaged_days = parsedDraft.engaged_days;
  if (explicitFields.next_action) nextDraft.next_action = parsedDraft.next_action;
  if (explicitFields.comments) nextDraft.comments = parsedDraft.comments;

  if (!currentDraft) {
    if (!explicitFields.company) nextDraft.company = parsedDraft.company;
    if (!explicitFields.roles) nextDraft.roles_json = parsedDraft.roles_json;
    if (!explicitFields.employment_types) nextDraft.employment_types_json = parsedDraft.employment_types_json;
    if (!explicitFields.job_link) nextDraft.job_link = parsedDraft.job_link;
    if (!explicitFields.location) nextDraft.location = parsedDraft.location;
    if (!explicitFields.status) nextDraft.status = parsedDraft.status;
    if (!explicitFields.current_stages) nextDraft.current_stages_json = parsedDraft.current_stages_json;
    if (!explicitFields.priority) nextDraft.priority = parsedDraft.priority;
    if (!explicitFields.engaged_days) nextDraft.engaged_days = parsedDraft.engaged_days;
    if (!explicitFields.next_action) nextDraft.next_action = parsedDraft.next_action;
    if (!explicitFields.comments) nextDraft.comments = parsedDraft.comments;
  }

  return nextDraft;
}

function safeTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseLiveKitTokenResponse(value: unknown): LiveKitTokenResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The voice token response was invalid.");
  }

  const candidate = value as Partial<LiveKitTokenResponse>;
  const url = safeTrimmedString(candidate.url);
  const roomName = safeTrimmedString(candidate.room_name);
  const participantIdentity = safeTrimmedString(candidate.participant_identity);
  const accessToken = safeTrimmedString(candidate.access_token);
  const expiresAt = safeTrimmedString(candidate.expires_at);

  if (!url || !roomName || !participantIdentity || !accessToken || !expiresAt) {
    throw new Error("The voice token response was missing required fields.");
  }

  return {
    url,
    room_name: roomName,
    participant_identity: participantIdentity,
    access_token: accessToken,
    expires_at: expiresAt,
  };
}

function parseAgentPacket(payload: Uint8Array, participantIdentity: string | null, activeUtteranceId: string | null): AgentPacket | null {
  if (participantIdentity !== VOICE_AGENT_IDENTITY || !activeUtteranceId) {
    return null;
  }

  let decodedPayload = "";
  try {
    decodedPayload = new TextDecoder("utf-8", { fatal: true }).decode(payload);
  } catch {
    return null;
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(decodedPayload);
  } catch {
    return null;
  }

  if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
    return null;
  }

  const packet = parsedValue as Record<string, unknown>;
  const type = safeTrimmedString(packet.type);
  const utteranceId = safeTrimmedString(packet.utterance_id);
  if (!utteranceId || utteranceId !== activeUtteranceId) {
    return null;
  }

  if (type === "final_transcript") {
    const text = safeTrimmedString(packet.text);
    return text ? { type, utterance_id: utteranceId, text } : null;
  }

  if (type === "transcription_error") {
    const message = safeTrimmedString(packet.message);
    return message ? { type, utterance_id: utteranceId, message } : null;
  }

  return null;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function voiceStatusLabel(status: VoiceStatus) {
  switch (status) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "recording":
      return "Recording";
    case "processing":
      return "Processing transcript";
    default:
      return "Disconnected";
  }
}

function toVoiceConnectErrorMessage(caught: unknown) {
  if (caught instanceof Error && caught.message) {
    return `Voice connect failed: ${caught.message}`;
  }

  return "Voice connect failed. Check that the backend and LiveKit server are running.";
}

function toMicrophoneStartErrorMessage(caught: unknown) {
  if (caught instanceof DOMException) {
    if (caught.name === "NotAllowedError") {
      return "Microphone access was denied. Allow microphone access in the browser and try again.";
    }
    if (caught.name === "NotFoundError") {
      return "No microphone was found. Connect a microphone and try again.";
    }
  }

  if (caught instanceof Error && caught.message) {
    return `Microphone start failed: ${caught.message}`;
  }

  return "Microphone start failed. Check microphone permissions and try again.";
}

function toMicrophoneStopErrorMessage(caught: unknown) {
  if (caught instanceof Error && caught.message) {
    return `Microphone stop failed: ${caught.message}`;
  }

  return "Microphone stop failed. Try disconnecting and reconnecting voice.";
}

function toVoicePublishErrorMessage(caught: unknown) {
  if (caught instanceof Error && caught.message) {
    return `Unable to submit the recorded audio: ${caught.message}`;
  }

  return "Unable to submit the recorded audio. Try recording again.";
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
  const roomRef = useRef<Room | null>(null);
  const roomEventHandlersRef = useRef<{
    dataReceived: (payload: Uint8Array, participant?: Participant, kind?: DataPacket_Kind) => void;
    disconnected: () => void;
  } | null>(null);
  const activeUtteranceIdRef = useRef<string | null>(null);
  const intentionalDisconnectRef = useRef(false);
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
  const [transcriptStatus, setTranscriptStatus] = useState<TranscriptStatus>("idle");
  const [transcriptError, setTranscriptError] = useState("");
  const [transcriptWarnings, setTranscriptWarnings] = useState<string[]>([]);
  const [draftValue, setDraftValue] = useState<ApplicationFormState | null>(null);
  const [draftMode, setDraftMode] = useState<DraftMode>("create");
  const [draftApplicationId, setDraftApplicationId] = useState<number | null>(null);
  const [draftAsrContext, setDraftAsrContext] = useState<DraftAsrContext | null>(null);
  const [transcriptContext, setTranscriptContext] = useState<TranscriptContext>({
    active_draft: null,
    active_application: null,
    recent_actions: [],
  });
  const [draftError, setDraftError] = useState("");
  const [showDraftDiscardModal, setShowDraftDiscardModal] = useState(false);
  const [pendingCompanyConfirmation, setPendingCompanyConfirmation] = useState<PendingCompanyConfirmation | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("disconnected");
  const [voiceError, setVoiceError] = useState("");
  const [latestVoiceTranscript, setLatestVoiceTranscript] = useState("");
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
    setTranscriptContext((currentContext) => ({
      ...currentContext,
      active_application: null,
    }));
  }

  function startEdit(record: ApplicationRecord) {
    const nextFormValue = toFormState(record);
    setFormMode("edit");
    setEditingId(record.id);
    setFormValue(nextFormValue);
    setInitialFormValue(nextFormValue);
    setFormError("");
    setTranscriptContext((currentContext) => ({
      ...currentContext,
      active_application: { application_id: record.id },
    }));
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

  function detachRoomEventHandlers(room: Room) {
    if (!roomEventHandlersRef.current) {
      return;
    }

    room.off(RoomEvent.DataReceived, roomEventHandlersRef.current.dataReceived);
    room.off(RoomEvent.Disconnected, roomEventHandlersRef.current.disconnected);
    roomEventHandlersRef.current = null;
  }

  const disconnectVoice = useCallback(
    async ({ preserveError = false } = {}) => {
      intentionalDisconnectRef.current = true;
      activeUtteranceIdRef.current = null;

      const room = roomRef.current;
      roomRef.current = null;

      if (room) {
        try {
          if (room.localParticipant.isMicrophoneEnabled) {
            await room.localParticipant.setMicrophoneEnabled(false);
          }
        } catch {
          // Disconnect continues even if the local microphone could not be muted cleanly.
        }

        detachRoomEventHandlers(room);
        room.disconnect();
      }

      setVoiceStatus("disconnected");
      if (!preserveError) {
        setVoiceError("");
      }
    },
    [],
  );

  useEffect(() => {
    return () => {
      void disconnectVoice({ preserveError: true });
    };
  }, [disconnectVoice]);

  async function connectVoice() {
    if (voiceStatus !== "disconnected") {
      return;
    }

    setVoiceError("");
    setVoiceStatus("connecting");

    const room = new Room();
    const handleDataReceived = (payload: Uint8Array, participant?: Participant) => {
      const packet = parseAgentPacket(payload, participant?.identity ?? null, activeUtteranceIdRef.current);
      if (!packet) {
        return;
      }

      activeUtteranceIdRef.current = null;
      if (packet.type === "final_transcript") {
        setLatestVoiceTranscript(packet.text);
        setVoiceError("");
      } else {
        setVoiceError(packet.message);
      }
      setVoiceStatus("connected");
    };
    const handleDisconnected = () => {
      detachRoomEventHandlers(room);
      roomRef.current = null;
      activeUtteranceIdRef.current = null;
      setVoiceStatus("disconnected");
      if (!intentionalDisconnectRef.current) {
        setVoiceError("Voice disconnected unexpectedly. Reconnect voice to continue.");
      }
      intentionalDisconnectRef.current = false;
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    room.on(RoomEvent.Disconnected, handleDisconnected);
    roomEventHandlersRef.current = {
      dataReceived: handleDataReceived,
      disconnected: handleDisconnected,
    };

    try {
      const tokenResponse = await requestJson<unknown>("/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const token = parseLiveKitTokenResponse(tokenResponse);
      intentionalDisconnectRef.current = false;
      await room.connect(token.url, token.access_token);
      roomRef.current = room;
      setVoiceStatus("connected");
    } catch (caught) {
      detachRoomEventHandlers(room);
      room.disconnect();
      setVoiceStatus("disconnected");
      setVoiceError(toVoiceConnectErrorMessage(caught));
    }
  }

  async function startVoiceRecording() {
    if (voiceStatus !== "connected" || !roomRef.current) {
      return;
    }

    setVoiceError("");
    const utteranceId = crypto.randomUUID();
    try {
      await roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            type: "utterance_start",
            utterance_id: utteranceId,
          }),
        ),
        {
          reliable: true,
          destinationIdentities: [VOICE_AGENT_IDENTITY],
        },
      );
      await roomRef.current.localParticipant.setMicrophoneEnabled(true);
      activeUtteranceIdRef.current = utteranceId;
      setVoiceStatus("recording");
    } catch (caught) {
      activeUtteranceIdRef.current = null;
      setVoiceStatus("connected");
      setVoiceError(toMicrophoneStartErrorMessage(caught));
    }
  }

  async function stopVoiceRecording() {
    const room = roomRef.current;
    const activeUtteranceId = activeUtteranceIdRef.current;
    if (!room || voiceStatus !== "recording" || !activeUtteranceId) {
      return;
    }

    setVoiceError("");
    try {
      await room.localParticipant.setMicrophoneEnabled(false);
    } catch (caught) {
      setVoiceError(toMicrophoneStopErrorMessage(caught));
      return;
    }

    try {
      await delay(UTTERANCE_END_DRAIN_MS);
      await room.localParticipant.publishData(
        new TextEncoder().encode(
          JSON.stringify({
            type: "utterance_end",
            utterance_id: activeUtteranceId,
          }),
        ),
        {
          reliable: true,
          destinationIdentities: [VOICE_AGENT_IDENTITY],
        },
      );
      setVoiceStatus("processing");
    } catch (caught) {
      activeUtteranceIdRef.current = null;
      setVoiceStatus("connected");
      setVoiceError(toVoicePublishErrorMessage(caught));
    }
  }

  function buildTranscriptRequestContext(): TranscriptContext {
    if (draftValue) {
      return {
        active_draft: toActiveDraftState(draftValue),
        active_application: transcriptContext.active_application,
        recent_actions: transcriptContext.recent_actions,
      };
    }

    return transcriptContext;
  }

  function openDraftPreview(draft: ApplicationFormState, mode: DraftMode, applicationId: number | null, asrContext: DraftAsrContext, warnings: string[]) {
    setDraftValue(draft);
    setDraftMode(mode);
    setDraftApplicationId(applicationId);
    setDraftAsrContext(asrContext);
    setTranscriptWarnings(warnings);
    setTranscriptStatus("draft-ready");
    setTranscriptContext((currentContext) => ({
      active_draft: toActiveDraftState(draft),
      active_application: currentContext.active_application,
      recent_actions: pushRecentAction(
        currentContext.recent_actions,
        `${mode === "update" ? "Prepared update preview" : "Prepared draft"} for ${draft.company}${primaryRole(draft) ? ` - ${primaryRole(draft)}` : ""}`,
      ),
    }));
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
      const parsed = await requestJson<SemanticTranscriptResponse>("/transcript/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: trimmedTranscript, context: buildTranscriptRequestContext() }),
      });

      if (parsed.status !== "preview") {
        setTranscriptWarnings(parsed.warnings);
        setTranscriptError(parsed.clarification_question ?? parsed.warnings[0] ?? "Transcript interpretation failed.");
        setTranscriptStatus("error");
        return;
      }

      const proposalFields =
        parsed.proposal.tool_name === "patch_active_draft" && parsed.proposal.arguments && typeof parsed.proposal.arguments === "object"
          ? (parsed.proposal.arguments as { fields?: unknown }).fields
          : undefined;

      const asrContext: DraftAsrContext = {
        rawTranscript: parsed.raw_transcript,
        originalExtractedCompanyName: parsed.draft?.company ?? draftValue?.company ?? null,
        audioReference: null,
      };

      if (parsed.proposal.tool_name === "request_draft_save") {
        setTranscriptWarnings([
          ...parsed.warnings,
          draftMode === "update"
            ? "Review the update preview, then click Save Update to persist it."
            : "Review the draft preview, then click Save Application to persist it.",
        ]);
        if (parsed.draft) {
          openDraftPreview(parsed.draft, draftMode, draftApplicationId, asrContext, [
            ...parsed.warnings,
            draftMode === "update"
              ? "Review the update preview, then click Save Update to persist it."
              : "Review the draft preview, then click Save Application to persist it.",
          ]);
        } else {
          setTranscriptStatus("draft-ready");
        }
        return;
      }

      if (parsed.operation === "update" && parsed.draft && parsed.application_id !== null) {
        openDraftPreview(parsed.draft, "update", parsed.application_id, asrContext, parsed.warnings);
        return;
      }

      if (parsed.operation === "create" && parsed.draft) {
        const mergedDraft = mergeDraftWithExplicitPatch(draftValue, parsed.draft, proposalFields);
        openDraftPreview(mergedDraft, "create", null, asrContext, parsed.warnings);
        return;
      }

      setTranscriptError("Transcript interpretation did not return a usable preview.");
      setTranscriptStatus("error");
    } catch (caught) {
      setTranscriptError(caught instanceof Error ? caught.message : "Transcript parsing failed.");
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
      if (draftMode === "update" && draftApplicationId !== null) {
        const savedRecord = await requestJson<ApplicationRecord>(`/applications/${draftApplicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextValue),
        });
        await handleCreatedApplication(savedRecord, "draft");
      } else {
        await submitCreateCandidate(
          {
            ...nextValue,
            raw_transcript: draftAsrContext?.rawTranscript ?? null,
            original_extracted_company_name: draftAsrContext?.originalExtractedCompanyName ?? null,
            audio_reference: draftAsrContext?.audioReference ?? null,
          },
          "draft",
        );
      }
    } catch (caught) {
      setDraftError(caught instanceof Error ? caught.message : "Draft save failed.");
      setTranscriptStatus("error");
    }
  }

  function clearTranscriptDraftState(nextStatus: TranscriptStatus) {
    setDraftValue(null);
    setDraftMode("create");
    setDraftApplicationId(null);
    setDraftAsrContext(null);
    setTranscript("");
    setTranscriptWarnings([]);
    setDraftError("");
    setTranscriptStatus(nextStatus);
    setTranscriptContext((currentContext) => ({
      ...currentContext,
      active_draft: null,
      active_application: null,
    }));
  }

  function requestDraftDiscard() {
    if (!draftValue) {
      return;
    }
    setShowDraftDiscardModal(true);
  }

  function confirmDraftDiscard() {
    setShowDraftDiscardModal(false);
    clearTranscriptDraftState("idle");
  }

  async function handleCreatedApplication(savedRecord: ApplicationRecord, source: "form" | "draft") {
    setRecords((currentRecords) => upsertApplicationRecord(currentRecords, savedRecord));
    setTranscriptContext((currentContext) => ({
      active_draft: null,
      active_application: currentContext.active_application,
      recent_actions: pushRecentAction(
        currentContext.recent_actions,
        `Saved transcript changes for ${savedRecord.company}${primaryRole(savedRecord) ? ` - ${primaryRole(savedRecord)}` : ""}`,
      ),
    }));
    if (source === "draft") {
      clearTranscriptDraftState("saved");
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

    const currentConfirmation = pendingCompanyConfirmation;
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
          ...currentConfirmation.candidate,
          confirmed_company_name: confirmedCompanyName,
        }),
      });
      setPendingCompanyConfirmation(null);
      await handleCreatedApplication(savedRecord, currentConfirmation.source);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Company confirmation failed.";
      if (currentConfirmation.source === "draft") {
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

  const canConnectVoice = voiceStatus === "disconnected";
  const canStartVoiceRecording = voiceStatus === "connected";
  const canStopVoiceRecording = voiceStatus === "recording";
  const canDisconnectVoice = voiceStatus === "connected" || voiceStatus === "recording" || voiceStatus === "processing";

  return (
    <main className="pageShell">
      <header className="topBar">
        <div>
          <p className="eyebrow">Job Tracker</p>
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

      <section className="formPanel voicePanel">
        <div className="formHeader">
          <h2>Voice Input</h2>
        </div>

        <p className="voiceStatusText">
          Status: <strong>{voiceStatusLabel(voiceStatus)}</strong>
        </p>
        {voiceStatus === "processing" ? (
          <p className="stateText">Waiting for the local LiveKit agent to return the final transcript.</p>
        ) : null}
        <div className="voiceActions">
          <button className="primaryButton" disabled={!canConnectVoice} type="button" onClick={connectVoice}>
            Connect voice
          </button>
          <button className="primaryButton" disabled={!canStartVoiceRecording} type="button" onClick={startVoiceRecording}>
            Start recording
          </button>
          <button className="secondaryButton" disabled={!canStopVoiceRecording} type="button" onClick={stopVoiceRecording}>
            Stop recording
          </button>
          <button className="secondaryButton" disabled={!canDisconnectVoice} type="button" onClick={() => void disconnectVoice()}>
            Disconnect voice
          </button>
        </div>
        <div className="voiceTranscriptBox">
          <span>Latest voice transcript</span>
          <p>{latestVoiceTranscript || "No voice transcript yet."}</p>
        </div>
        {voiceError ? <p className="errorText">Voice error: {voiceError}</p> : null}
      </section>

      <section className="formPanel transcriptPanel">
        <div className="formHeader">
          <h2>Transcript Command</h2>
        </div>

        {transcriptError ? <p className="errorText">Transcript follow-up needs attention: {transcriptError}</p> : null}
        {transcriptWarnings.length ? (
          <div className="warningBox">
            {transcriptWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        {transcriptStatus === "saved" ? <p className="successText">Transcript changes were saved.</p> : null}

        <label className="field">
          <span>Transcript</span>
          <textarea
            className="transcriptInput"
            placeholder="Neilsoft sathi application add kar. GENAI Engineer only, fulltime ani onsite. Applied stage thev."
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
        </label>
        <div className="formActions">
          <button className="primaryButton" disabled={transcriptStatus === "parsing"} type="button" onClick={parseTranscriptCommand}>
            {transcriptStatus === "parsing" ? "Applying transcript..." : "Apply Transcript Command"}
          </button>
        </div>
      </section>

      {draftValue ? (
        <>
          <ApplicationForm
            mode="add"
            heading={draftMode === "update" ? "Structured Update Preview" : "Structured Draft Preview"}
            submitLabel={draftMode === "update" ? "Save Update" : "Save Application"}
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
