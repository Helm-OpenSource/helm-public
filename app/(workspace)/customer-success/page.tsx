import { ConnectorProvider } from "@prisma/client";
import { logPageViewEvent } from "@/lib/analytics";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getWorkspaceBusinessLoopGapReadout } from "@/lib/helm-v2/runtime-upgrade";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { getLocalizedStageLabels } from "@/lib/i18n/labels";
import { getCustomerSuccessQueueData } from "@/data/queries";
import { getInboxData } from "@/features/inbox/queries";
import { buildCustomerSuccessQueueSurfaceModel } from "@/features/customer-success-handoff/queue-model";
import { CustomerSuccessQueueSurfaceView } from "@/features/customer-success-handoff/queue-view";

export default async function CustomerSuccessQueuePage() {
  const workspace = await getCurrentWorkspace();
  const user = await requireCurrentUser();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);

  const [stageLabels, queueData, businessLoopGapReadout, connector] =
    await Promise.all([
      getLocalizedStageLabels(locale),
      getCustomerSuccessQueueData(workspace.id),
      getWorkspaceBusinessLoopGapReadout(workspace.id),
      db.connector.findUnique({
        where: {
          workspaceId_userId_provider: {
            workspaceId: workspace.id,
            userId: user.id,
            provider: ConnectorProvider.GMAIL,
          },
        },
      }),
    ]);
  const inbox = await getInboxData(workspace.id, {
    viewerEmail: connector?.externalAccountEmail ?? null,
  });
  const visibleInboxThreadIds = new Set(
    inbox.threads.map((thread) => thread.id),
  );

  await logPageViewEvent({
    eventName: "customer_success_queue_opened",
    sourcePage: "/customer-success",
    targetType: "Workspace",
    targetId: workspace.id,
    metadata: {
      actor: user.id,
      mode: "customer-success-queue",
    },
  });

  const model = buildCustomerSuccessQueueSurfaceModel({
    queueDetails: queueData.queueDetails.map((entry) => ({
      ...entry,
      stageLabel: stageLabels[entry.detail.stage] ?? entry.detail.stage,
    })),
    successInboxThreads: queueData.successInboxThreads.filter((thread) =>
      visibleInboxThreadIds.has(thread.id),
    ),
    currentUserId: user.id,
    english,
  });

  return (
    <CustomerSuccessQueueSurfaceView
      model={model}
      english={english}
      businessLoopGapSummary={businessLoopGapReadout.businessLoopGapSummary}
    />
  );
}
