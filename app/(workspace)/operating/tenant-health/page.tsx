import Link from "next/link";
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
    if (error instanceof TenantHealthRateLimitError) {
      return (
        <TenantHealthUnavailable
          english={english}
          title={english ? "Health readout is cooling down" : "客户健康读取暂缓"}
          detail={
            english
              ? "This readout was opened too often in a short window. Return to customer work and check again shortly."
              : "刚才读取太频繁。先回到客户推进，稍后再看这组健康信号。"
          }
        />
      );
    }
    if (error instanceof TenantHealthAccessDeniedError) {
      return (
        <TenantHealthUnavailable
          english={english}
          title={english ? "No tenant health assets here" : "这里没有客户健康资产"}
          detail={
            english
              ? "The current workspace does not expose a tenant health queue."
              : "当前工作区没有可展示的客户健康队列。"
          }
        />
      );
    }
    throw error;
  }

  return <TenantHealthPage data={data} english={english} />;
}

function TenantHealthUnavailable({
  english,
  title,
  detail,
}: {
  english: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className="workspace-surface-stack" data-source-page="/operating/tenant-health">
      <section className="mx-auto max-w-2xl rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-6 text-center shadow-[0_18px_60px_-46px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mode-link)]">
          {english ? "Customer health" : "客户健康"}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {detail}
        </p>
        <Link
          href="/operating"
          className="mt-5 inline-flex items-center justify-center rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-foreground)]"
        >
          {english ? "Back to customer work" : "回到客户推进"}
        </Link>
      </section>
    </div>
  );
}
