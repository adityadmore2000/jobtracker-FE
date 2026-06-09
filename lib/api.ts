import { API_BASE_URL } from "@/app/config";
import {
  Application,
  ApplicationNote,
  LiveKitTokenResponse,
  TimelineEvent,
  TranscriptContext,
  TranscriptResponse,
} from "./types";

const BASE_URL = API_BASE_URL;

export type ApplicationUpdatePayload = {
  company?: string;
  roles_json?: string[];
  employment_types_json?: string[];
  job_link?: string;
  location?: string;
  status?: string;
  current_stages_json?: string[];
  priority?: string;
  engaged_days?: number;
  next_action?: string;
  comments?: string;
};

export type DraftPatchPayload = {
  company?: string;
  roles?: string[];
  employment_types?: string[];
  job_link?: string;
  location?: string;
  status?: string;
  current_stages?: string[];
  priority?: string;
  engaged_days?: number;
  next_action?: string;
  comments?: string;
};

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchApplications(): Promise<Application[]> {
  const res = await fetch(`${BASE_URL}/applications`);
  return handleResponse(res);
}

export async function fetchArchivedApplications(): Promise<Application[]> {
  const res = await fetch(`${BASE_URL}/applications/archived`);
  return handleResponse(res);
}

export async function fetchNotes(applicationId: number): Promise<ApplicationNote[]> {
  const res = await fetch(`${BASE_URL}/applications/${applicationId}/notes`);
  const data = await handleResponse<{ notes: ApplicationNote[] }>(res);
  return data.notes;
}

export async function fetchTimeline(applicationId: number): Promise<TimelineEvent[]> {
  const res = await fetch(`${BASE_URL}/applications/${applicationId}/timeline`);
  const data = await handleResponse<{ timeline: TimelineEvent[] }>(res);
  return data.timeline;
}

export async function submitTranscript(
  transcript: string,
  context: TranscriptContext,
): Promise<TranscriptResponse> {
  const res = await fetch(`${BASE_URL}/transcript/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, context }),
  });
  return handleResponse(res);
}

export async function archiveApplication(applicationId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/applications/${applicationId}/archive`, {
    method: "POST",
  });
  return handleResponse(res);
}

export async function restoreApplication(applicationId: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/applications/${applicationId}/restore`, {
    method: "POST",
  });
  return handleResponse(res);
}

export async function updateApplication(
  applicationId: number,
  payload: ApplicationUpdatePayload,
): Promise<Application> {
  const res = await fetch(`${BASE_URL}/applications/${applicationId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Application>(res);
}

export async function patchDraft(draftId: string, payload: DraftPatchPayload): Promise<Application> {
  const res = await fetch(`${BASE_URL}/drafts/${draftId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Application>(res);
}

export async function saveDraft(draftId: string): Promise<Application> {
  const res = await fetch(`${BASE_URL}/drafts/${draftId}/save`, { method: "POST" });
  return handleResponse<Application>(res);
}

export async function discardDraft(draftId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/drafts/${draftId}/discard`, { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
}

export async function fetchLiveKitToken(roomName?: string): Promise<LiveKitTokenResponse> {
  const body = roomName ? { room_name: roomName } : {};
  const res = await fetch(`${BASE_URL}/livekit/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}
