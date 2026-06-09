import type { Application } from "@/lib/types";

type ChatPanelProps = {
  activeDraft: Partial<Application> | null;
  draftId: string | null;
  onActiveDraftChange: (draft: Partial<Application> | null) => void;
  onDraftIdChange: (draftId: string | null) => void;
  onApplicationMutated: () => void;
};

export default function ChatPanel(_props: ChatPanelProps) {
  return null;
}
