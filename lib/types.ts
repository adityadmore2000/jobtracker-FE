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

export type TranscriptNote = {
  id: number;
  text: string;
  created_at: string | null;
};

export type TimelineEvent = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ChatMessageAction = {
  label: string;
  // Recovery actions for collisions. Payload carried on the message.
  kind:
    | "open_draft"
    | "discard_draft"
    | "open_application"
    | "open_archived_application"
    | "restore_application";
  draftId?: number | null;
  applicationId?: number | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "system" | "draft";
  text: string;
  timestamp: string;
  // Clickable rephrasing chips offered by the semantic extractor.
  suggestions?: string[];
  // Collision-recovery buttons (open / discard / restore).
  actions?: ChatMessageAction[];
};

export type TranscriptContext = {
  active_draft?: Partial<Application>;
  draft_id?: string;
  active_application_id?: number | null;
  recent_actions?: string[];
  pending_command?: PendingCommand | null;
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

export type PendingCommand = {
  operation: string;
  target: {
    company: string | null;
    role: string | null;
    application_id: number | null;
  };
  changes: Record<string, unknown>;
  note: string | null;
  missing_field: "company" | "role" | null;
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
  | "error"
  | "note_added"
  | "application_archived"
  | "application_restored"
  | "context_updated"
  | "unsupported";

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
  note?: TranscriptNote | null;
  pending_command?: PendingCommand | null;
  // Single-call semantic extractor: safe rephrasings rendered as clickable chips.
  suggested_phrasings?: string[];
  // Structured collision metadata when a create command hit an existing row.
  collision?: TranscriptCollision | null;
};

export type TranscriptCollision = {
  kind: "draft" | "active_application" | "archived_application";
  draft_id: number | null;
  application_id: number | null;
  company: string | null;
  role: string | null;
  archived: boolean;
};

export type LiveKitTokenResponse = {
  url: string;
  room_name: string;
  participant_identity: string;
  access_token: string;
  expires_at: string;
};
