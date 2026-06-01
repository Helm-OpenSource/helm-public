import { redirect } from "next/navigation";

export default async function SalesFollowupCompatibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/follow-ups/${encodeURIComponent(id)}`);
}
