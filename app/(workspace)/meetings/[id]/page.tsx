import { notFound } from "next/navigation";
import { FirstLoopSurfaceSummary } from "@/components/shared/first-loop-surface-summary";
import { loadMeetingDetailPageData } from "@/features/meetings/page-loader";
import { MeetingDetailClient } from "@/features/meetings/meeting-detail-client";
import { ConversationChainExtensionDetailView } from "@/features/conversation-chain-extension/detail-view";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await loadMeetingDetailPageData(id);

  if (!detail) return notFound();

  const {
    actionGovernance,
    auditLogs,
    chainModel,
    english,
    firstLoopModel,
    meeting,
    memberships,
    recommendations,
    runtimeGovernance,
  } =
    detail;
  const meetingRouteIdentity = { sourcePage: `/meetings/${meeting.id}` as const };

  return (
    <div className="space-y-6" data-source-page={meetingRouteIdentity.sourcePage}>
      <ConversationChainExtensionDetailView model={chainModel} english={english} />
      <FirstLoopSurfaceSummary
        model={firstLoopModel}
        english={english}
        eyebrow={english ? "Meeting detail → first loop" : "会议详情 → 首轮闭环"}
      />
      <div data-conversation-chain-object-detail="meeting-detail">
        <MeetingDetailClient
          actionGovernance={actionGovernance}
          runtimeGovernance={runtimeGovernance}
          meeting={meeting}
          memberships={memberships}
          auditLogs={auditLogs}
          recommendations={recommendations}
        />
      </div>
    </div>
  );
}
