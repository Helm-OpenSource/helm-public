import { WorkspaceRole } from "@prisma/client";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/shared/page-header";
import { OperatorConsole } from "@/features/caio-operator/operator-console.client";
import { getCaioOperatorReadout } from "@/features/caio-operator/queries";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";

// Stale reasons can carry internal detail, so only the closed status label is rendered.
const GATE_STATUS_LABELS: Readonly<Record<string, { zh: string; en: string }>> = {
  not_accepted: { zh: "未受理", en: "Not accepted" },
  accepted: { zh: "已受理", en: "Accepted" },
  revoked: { zh: "已撤销", en: "Revoked" },
  stale: { zh: "已失效（需重新评估）", en: "Stale (reassess)" },
};

function gateStatusLabel(status: string, english: boolean): string {
  const label = GATE_STATUS_LABELS[status];
  if (!label) return english ? "Unknown status" : "未知状态";
  return english ? label.en : label.zh;
}

export default async function CaioOperatorPage() {
  const session = await getCurrentWorkspaceSession();

  // Same boundary as /caio: the operator surface is OWNER-only. CEO acts submitted from here (G0
  // acceptance) are still authorized by the services against the registered principal binding.
  if (session.membership.role !== WorkspaceRole.OWNER) {
    notFound();
  }

  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: session.workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  const readout = await getCaioOperatorReadout({
    workspaceId: session.workspace.id,
    actorUserId: session.user.id,
    membershipRole: session.membership.role,
    english,
  });

  return (
    <div className="space-y-6" data-source-page="/caio/operator" data-caio-owner-surface="true">
      <PageHeader
        english={english}
        eyebrow={english ? "CEO-direct AI" : "CEO 直属 AI"}
        title={english ? "Helm CAIO operator registration" : "Helm CAIO 运营登记"}
        description={
          english
            ? "Registers governance records and initialization evidence only. It grants no runtime permission and triggers no execution or outbound effect."
            : "本页只登记治理记录与初始化证据，不授予任何运行时权限，不触发执行或外发。"
        }
      />

      <section
        aria-labelledby="caio-operator-state-title"
        className="border-y border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-5 py-4"
        data-caio-operator-state="true"
      >
        <h2 id="caio-operator-state-title" className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? "Current state" : "当前状态"}
        </h2>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[color:var(--muted-foreground)]">{english ? "G0 initialization gate" : "G0 初始化验收门"}</dt>
            <dd className="text-[color:var(--foreground)]">
              {readout?.gate.available
                ? gateStatusLabel(readout.gate.status.status, english)
                : english ? "Unavailable (read failed; not shown as empty)" : "暂不可读（读取失败，不按空状态显示）"}
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--muted-foreground)]">{english ? "Owner-loop readout" : "一把手闭环读数"}</dt>
            <dd className="text-[color:var(--foreground)]">
              {readout?.ownerLoop.available
                ? english ? "Available on /caio" : "可在 /caio 查看"
                : english ? "No projectable evidence yet" : "尚无可投影证据"}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-[color:var(--muted-foreground)]" data-caio-operator-governance-cli="true">
          {english
            ? "Principal bindings, mandates, guardian stops and CEO resumes are not registered on this page: governance records have no web entry and go through the controlled governance CLI (validation only unless --apply)."
            : "身份绑定、授权任命、guardian 急停与 CEO 恢复不在本页登记：治理记录不设网页入口，经受控治理命令行登记（默认只校验，带 --apply 才写入）。"}
        </p>
      </section>

      <OperatorConsole english={english} />
    </div>
  );
}
