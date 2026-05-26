import { notFound } from "next/navigation";
import { TenantHealthPage } from "@/features/self-tenant-health/tenant-health-page";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import {
  getSelfTenantHealthDashboardData,
  TenantHealthRateLimitError,
} from "@/lib/self-tenant-health/queries";
import { TenantHealthAccessDeniedError } from "@/lib/self-tenant-health/privacy";

export default async function OperatingTenantHealthPage() {
  const session = await getCurrentWorkspaceSession();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: session.workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  let data;

  try {
    data = await getSelfTenantHealthDashboardData({
      viewerWorkspace: session.workspace,
      viewerWorkspaceId: session.workspace.id,
      viewerUserId: session.user.id,
      viewerName: session.user.name,
      windowDays: 7,
    });
  } catch (error) {
    if (
      error instanceof TenantHealthAccessDeniedError ||
      error instanceof TenantHealthRateLimitError
    ) {
      notFound();
    }
    throw error;
  }

  return <TenantHealthPage data={data} english={english} />;
}
