import { redirect } from "next/navigation";

export default async function FounderQaCompatibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/conversations/${encodeURIComponent(id)}`);
}
