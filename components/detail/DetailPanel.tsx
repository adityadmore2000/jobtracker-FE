import type { Application } from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import NotesTab from "./NotesTab";
import TimelineTab from "./TimelineTab";
import ArchiveButton from "./ArchiveButton";

type DetailPanelProps = {
  application: Application | null;
  isArchived: boolean;
  onApplicationMutated: () => void | Promise<void>;
};

export default function DetailPanel({
  application,
  isArchived,
  onApplicationMutated,
}: DetailPanelProps) {
  return (
    <div className="flex h-56 shrink-0 flex-col overflow-hidden border-t">
      {application === null ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Select an application to view details.
          </p>
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between px-4 py-2">
            <span className="text-sm font-medium">
              {application.company} — {application.role}
            </span>
            <ArchiveButton
              application={application}
              isArchived={isArchived}
              onMutated={onApplicationMutated}
            />
          </div>

          <Tabs defaultValue="notes" className="flex min-h-0 flex-1 flex-col px-4 pb-2">
            <TabsList className="shrink-0">
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="notes" className="min-h-0 flex-1 overflow-y-auto">
              <NotesTab applicationId={application.id} />
            </TabsContent>
            <TabsContent value="timeline" className="min-h-0 flex-1 overflow-y-auto">
              <TimelineTab applicationId={application.id} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
