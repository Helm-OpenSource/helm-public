import { cookies } from "next/headers";
import type { Metadata } from "next";
import { WorkspaceUiProvider } from "@/components/providers/workspace-ui-provider";
import { ParticipantPortalOnboardingClient } from "@/features/participant-portal/participant-portal-onboarding-client";
import { getParticipantPortalInvitePreview } from "@/features/participant-portal/queries";
import { resolveUiLocale } from "@/lib/i18n/config";
import { defaultWorkspaceFeatureFlags } from "@/lib/workspace-ops";

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const english = locale === "en-US";

  return {
    title: english ? "Helm | Complete participant portal access" : "Helm | 完成贡献方门户访问",
    description: english
      ? "Complete your narrow contributor onboarding and payout profile basics before entering Helm's self-only participant portal."
      : "先完成受控的贡献方开通与结算资料，再进入 Helm 的仅本人可见贡献方门户。",
  };
}

export default async function ParticipantPortalAccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const locale = resolveUiLocale((await cookies()).get("helm-ui-locale")?.value);
  const { token } = await params;
  const preview = await getParticipantPortalInvitePreview(token);

  return (
    <WorkspaceUiProvider
      locale={locale}
      pilotMode
      captureConsentRequired
      dataRetentionDays={90}
      featureFlags={defaultWorkspaceFeatureFlags}
      demoMode={null}
    >
      <ParticipantPortalOnboardingClient locale={locale} token={token} preview={preview} />
    </WorkspaceUiProvider>
  );
}
