export type ApplicationStatus =
  | "applied"
  | "interviewing"
  | "offered"
  | "rejected"
  | "ghosted"
  | "withdrawn";

export type ApplicationPriority = "low" | "medium" | "high";

export type LocationMode = "remote" | "hybrid" | "onsite";

export type Application = {
  id: number;
  company: string;
  role: string;
  status: string;
  priority: string;
  location_mode: string;
  job_link: string;
  employment_type: string;
  current_stage: string;
  is_draft: boolean;
  draft_created_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationNote = {
  id: number;
  text: string;
  created_at: string;
};

export type TimelineEvent = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "system" | "draft";
  text: string;
  timestamp: string;
};

export type TranscriptContext = {
  active_draft?: Partial<Application>;
  draft_id?: string;
  active_application_id?: number | null;
  recent_actions?: string[];
};

export type TranscriptResponse = {
  status: string;
  message: string;
  draft?: Partial<Application>;
  draft_id?: string;
  requires_confirmation?: boolean;
  confirmation_kind?: string;
  clarification_question?: string;
};

export type LiveKitTokenResponse = {
  url: string;
  room_name: string;
  participant_identity: string;
  access_token: string;
  expires_at: string;
};
