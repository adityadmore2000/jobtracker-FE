export type Application = {
  id: number;
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

export type ApplicationChangeDraft = {
  id: number;
  kind: string;
  target_application_id: number;
  original: Application;
  preview: Application;
  changed_fields: string[];
  created_at: string;
  updated_at: string;
};

export type TranscriptStatus =
  | "draft_created"
  | "draft_updated"
  | "saved"
  | "discarded"
  | "updated"
  | "pending_changes_created"
  | "pending_changes_updated"
  | "changes_applied"
  | "changes_discarded"
  | "clarification"
  | "no_change"
  | "error";

export type TranscriptResponse = {
  status: TranscriptStatus;
  message: string;
  application_id: number | null;
  draft_id: string | null;
  draft: Application | null;
  application?: Application | null;
  pending_changes: ApplicationChangeDraft | null;
  warnings: string[];
  clarification_question: string | null;
};

export type LiveKitTokenResponse = {
  url: string;
  room_name: string;
  participant_identity: string;
  access_token: string;
  expires_at: string;
};
