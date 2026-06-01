"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  partnerProgramStatusLabels,
  revenueBeneficiaryLabels,
} from "@/features/settings/formatters/labels";
import { formatSettingsCommercialText } from "@/features/settings/display-copy";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingProgramCatalogData = Pick<
  SettingsClientProps["data"],
  "partnerPrograms" | "programApplicationSummary"
>;

type BillingProgramCatalogPanelsProps = {
  canManageManualSettlement: boolean;
  children: ReactNode;
  data: BillingProgramCatalogData;
  english: boolean;
  formatDateLabel: (value: Date | string | null | undefined) => string;
};

export function BillingProgramCatalogPanels({
  canManageManualSettlement,
  children,
  data,
  english,
  formatDateLabel,
}: BillingProgramCatalogPanelsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{english ? "Program catalog and application intake" : "合作项目目录与申请入口"}</CardTitle>
        <CardDescription>
          {english
            ? "Programs, terms, applications, invites — all by hand."
            : "项目、条款、申请、邀请——都走人工。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
          {english
            ? `Manual settlement workflow is ${canManageManualSettlement ? "enabled" : "read-only"} for the current role. Batch actions, export, paid, and reversal updates remain capability-gated.`
            : `当前角色的手工结算工作流为${canManageManualSettlement ? "可操作" : "只读"}；批次动作、导出、已支付和已冲回更新继续受能力边界控制。`}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Info label={english ? "Programs" : "合作项目数"} value={english ? `${data.partnerPrograms.length}` : `${data.partnerPrograms.length} 条`} />
          <Info label={english ? "Applications" : "申请总数"} value={english ? `${data.programApplicationSummary.totalCount}` : `${data.programApplicationSummary.totalCount} 条`} />
          <Info label={english ? "Submitted" : "待审核"} value={english ? `${data.programApplicationSummary.submittedCount}` : `${data.programApplicationSummary.submittedCount} 条`} />
          <Info label={english ? "Accepted / pending invite" : "已接受 / 待发邀请"} value={english ? `${data.programApplicationSummary.acceptedCount}` : `${data.programApplicationSummary.acceptedCount} 条`} />
          <Info label={english ? "Waitlisted" : "等待名单"} value={english ? `${data.programApplicationSummary.waitlistedCount}` : `${data.programApplicationSummary.waitlistedCount} 条`} />
          <Info label={english ? "Invite issued" : "已发邀请"} value={english ? `${data.programApplicationSummary.invitedCount}` : `${data.programApplicationSummary.invitedCount} 条`} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Published programs" : "当前开放的合作项目"}</p>
              <Button asChild variant="ghost" size="sm">
                <Link href="/programs">{english ? "Open public catalog" : "打开公开目录"}</Link>
              </Button>
            </div>
            {data.partnerPrograms.length ? (
              data.partnerPrograms.map((program) => (
                <div key={program.id} className="theme-surface-panel rounded-2xl px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {formatSettingsCommercialText(program.title, english)}
                    </p>
                    <Badge
                      variant={
                        program.status === "ACTIVE"
                          ? "success"
                          : program.status === "PAUSED"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {partnerProgramStatusLabels[program.status][english ? "en" : "zh"]}
                    </Badge>
                    {program.activeTermsVersion ? (
                      <Badge variant="approval">{program.activeTermsVersion.versionKey}</Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Info label={english ? "Beneficiary line" : "收益线"} value={revenueBeneficiaryLabels[program.beneficiaryType][english ? "en" : "zh"]} />
                    <Info label={english ? "Applications" : "申请数"} value={english ? `${program.applicationCount}` : `${program.applicationCount} 条`} />
                    <Info
                      label={english ? "Terms version" : "条款版本"}
                      value={formatSettingsCommercialText(
                        program.activeTermsVersion?.title ?? (english ? "Not published" : "尚未发布"),
                        english,
                      )}
                    />
                    <Info label={english ? "Published at" : "发布时间"} value={formatDateLabel(program.activeTermsVersion?.publishedAt ?? program.activeTermsVersion?.effectiveFrom ?? null)} />
                  </div>
                  <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {formatSettingsCommercialText(program.summary, english)}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {formatSettingsCommercialText(program.boundarySummary, english)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState
                title={english ? "No programs yet" : "当前还没有合作项目"}
                description={english ? "Program foundation will appear here once the host workspace is initialized." : "等宿主工作区初始化完成后，这里会显示合作项目基础面。"}
              />
            )}
          </div>

          <div className="space-y-4">{children}</div>
        </div>
      </CardContent>
    </Card>
  );
}
