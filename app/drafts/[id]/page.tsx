import AppShell from "@/components/layout/AppShell";

export default async function DraftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AppShell routeDraftId={id} />;
}
