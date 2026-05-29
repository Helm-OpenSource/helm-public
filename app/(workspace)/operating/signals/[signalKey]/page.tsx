import { notFound } from "next/navigation";
import fixturePack from "@/evals/operating-signal-flow/signal-flow-cases.json";
import { OperatingSignalDetailPage } from "@/features/internal-operating-workspace/operating-signal-detail-page";
import type { OperatingSignalFlowFixturePack } from "@/lib/operating-signal-flow/contract";
import { buildOperatingSignalFlowDetailDisplayModel } from "@/lib/operating-signal-flow/projection";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";

const flowFixturePack = fixturePack as OperatingSignalFlowFixturePack;

export default async function OperatingSignalDetailRoute({
  params,
}: {
  params: Promise<{ signalKey: string }>;
}) {
  const [{ signalKey }, session] = await Promise.all([
    params,
    getCurrentWorkspaceSession(),
  ]);
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: session.workspace.defaultLocale,
  });
  const english = locale === "en-US";
  const model = buildOperatingSignalFlowDetailDisplayModel(
    flowFixturePack,
    locale,
    signalKey,
  );

  if (!model) {
    return notFound();
  }

  return <OperatingSignalDetailPage english={english} model={model} />;
}
