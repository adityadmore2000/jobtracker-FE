import AppShell from "@/components/layout/AppShell";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  // A non-numeric id can never match a record; render as not-found via null id
  // so AppShell shows "Application not found".
  return (
    <AppShell routeApplicationId={Number.isNaN(numericId) ? -1 : numericId} />
  );
}
