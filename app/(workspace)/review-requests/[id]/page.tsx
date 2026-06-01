import { notFound } from "next/navigation";
import { getApprovalTasksData } from "@/data/queries";
import { logPageViewEvent } from "@/lib/analytics";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { buildReviewRequestDetailPageModel } from "@/features/inbox-followup-review-request/detail-model";
import { InboxFollowupReviewRequestDetailView } from "@/features/inbox-followup-review-request/detail-view";

export default async function ReviewRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  const user = await requireCurrentUser();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  const tasks = await getApprovalTasksData(workspace.id);
  const task = tasks.find((item) => item.id === id) ?? null;

  if (!task) return notFound();

  await logPageViewEvent({
    eventName: "review_request_detail_opened",
    sourcePage: `/review-requests/${task.id}`,
    targetType: "ApprovalTask",
    targetId: task.id,
    metadata: {
      actor: user.id,
      mode: "review-request-detail",
    },
  });

  const model = buildReviewRequestDetailPageModel({
    task,
    english,
  });

  return (
    <InboxFollowupReviewRequestDetailView model={model} english={english} />
  );
}
