import { redirect } from "next/navigation";

export default async function DeliveryReviewCompatibilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  redirect(`/conversations/${encodeURIComponent(id)}`);
}
