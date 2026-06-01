import { redirect } from "next/navigation";

export default async function SalesObjectionCompatibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/conversations/${encodeURIComponent(id)}`);
}
