"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import type { ParticipantPortalAccessStatus } from "@prisma/client";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  participantPortalStatusLabels,
  revenueBeneficiaryLabels,
} from "@/features/settings/formatters/labels";
import { formatSettingsCommercialText } from "@/features/settings/display-copy";
import type {
  PortalInviteBeneficiaryType,
  SettingsClientProps,
} from "@/features/settings/types/settings-client-props";
import { formatParticipantPortalDateLabel } from "./billing-participant-portal-date-labels";
import { Info } from "./settings-display";

type BillingParticipantPortalData = Pick<
  SettingsClientProps["data"],
  "participantPortalAccesses"
>;

type ParticipantPortalDraft = {
  beneficiaryType: PortalInviteBeneficiaryType;
  beneficiaryId: string;
  inviteEmail: string;
  displayName: string;
  notes: string;
};

type ParticipantPortalOption = {
  id: string;
  label: string;
};

type BillingParticipantPortalPanelsProps = {
  canManageParticipantPortal: boolean;
  data: BillingParticipantPortalData;
  english: boolean;
  formatDateLabel: (value: Date | string | null | undefined) => string;
  issueParticipantPortalAccess: () => void;
  latestParticipantPortalInviteUrl: string | null;
  participantPortalDraft: ParticipantPortalDraft;
  participantPortalOptions: ParticipantPortalOption[];
  pending: boolean;
  setParticipantPortalDraft: Dispatch<SetStateAction<ParticipantPortalDraft>>;
  updateParticipantPortalAccessStatus: (
    accessId: string,
    status: ParticipantPortalAccessStatus,
  ) => void;
};

export function BillingParticipantPortalPanels({
  canManageParticipantPortal,
  data,
  english,
  formatDateLabel,
  issueParticipantPortalAccess,
  latestParticipantPortalInviteUrl,
  participantPortalDraft,
  participantPortalOptions,
  pending,
  setParticipantPortalDraft,
  updateParticipantPortalAccessStatus,
}: BillingParticipantPortalPanelsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {english ? "Participant portal access" : "贡献方门户访问"}
        </CardTitle>
        <CardDescription>
          {english
            ? "Invite-only, self-only access for contributors, partners, and referrers."
            : "仅邀请、仅本人可见——发给贡献方、合作方、转介方。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
          {english
            ? `Participant portal management is ${canManageParticipantPortal ? "enabled" : "read-only"} for the current role. Invite issuance and status changes remain capability-gated.`
            : `当前角色的贡献方门户管理为${canManageParticipantPortal ? "可操作" : "只读"}；邀请发放和状态更新继续受能力边界控制。`}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1.4fr]">
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {english
                ? "Issue participant portal access"
                : "发放贡献方门户访问"}
            </p>
            <div className="mt-3 space-y-3">
              <Select
                value={participantPortalDraft.beneficiaryType}
                onValueChange={(value) =>
                  setParticipantPortalDraft((current) => ({
                    ...current,
                    beneficiaryType: value as PortalInviteBeneficiaryType,
                    beneficiaryId: "",
                    displayName: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WORKER_PUBLISHER">
                    {
                      revenueBeneficiaryLabels.WORKER_PUBLISHER[
                        english ? "en" : "zh"
                      ]
                    }
                  </SelectItem>
                  <SelectItem value="SALES_REFERRAL">
                    {
                      revenueBeneficiaryLabels.SALES_REFERRAL[
                        english ? "en" : "zh"
                      ]
                    }
                  </SelectItem>
                  <SelectItem value="CUSTOM_SERVICES">
                    {
                      revenueBeneficiaryLabels.CUSTOM_SERVICES[
                        english ? "en" : "zh"
                      ]
                    }
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={participantPortalDraft.beneficiaryId}
                onValueChange={(value) =>
                  setParticipantPortalDraft((current) => ({
                    ...current,
                    beneficiaryId: value,
                    displayName:
                      current.displayName.trim().length > 0
                        ? current.displayName
                        : (participantPortalOptions.find(
                            (option) => option.id === value,
                          )?.label ?? current.displayName),
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={english ? "Select beneficiary" : "选择受益方"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {participantPortalOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={participantPortalDraft.inviteEmail}
                onChange={(event) =>
                  setParticipantPortalDraft((current) => ({
                    ...current,
                    inviteEmail: event.target.value,
                  }))
                }
                placeholder={english ? "Invite email" : "邀请邮箱"}
              />
              <Input
                value={participantPortalDraft.displayName}
                onChange={(event) =>
                  setParticipantPortalDraft((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder={
                  english ? "Display name (optional)" : "显示名称（可选）"
                }
              />
              <Input
                value={participantPortalDraft.notes}
                onChange={(event) =>
                  setParticipantPortalDraft((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                placeholder={english ? "Notes" : "备注"}
              />
              <Button
                onClick={issueParticipantPortalAccess}
                disabled={
                  pending ||
                  !canManageParticipantPortal ||
                  participantPortalDraft.beneficiaryId.trim().length === 0 ||
                  participantPortalDraft.inviteEmail.trim().length < 5
                }
              >
                {english ? "Issue invited access" : "发放邀请访问"}
              </Button>
              {latestParticipantPortalInviteUrl ? (
                <div className="rounded-2xl border border-[color:var(--border)] px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                  <p className="font-medium text-[color:var(--foreground)]">
                    {english ? "Latest invite link" : "最近生成的邀请链接"}
                  </p>
                  <Link
                    href={latestParticipantPortalInviteUrl}
                    className="mt-2 block break-all text-[var(--accent)] hover:underline"
                  >
                    {latestParticipantPortalInviteUrl}
                  </Link>
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {english
                      ? "This link goes to the narrow onboarding path only. It does not expose registry, settlement, or payout execution."
                      : "这个链接只会进入窄的入驻路径，不会暴露登记、结算或支付执行。"}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            {data.participantPortalAccesses.length ? (
              data.participantPortalAccesses.map((access) => (
                <div
                  key={access.id}
                  className="theme-surface-panel rounded-2xl px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {formatSettingsCommercialText(
                        access.displayName,
                        english,
                      )}
                    </p>
                    <Badge variant="approval">
                      {
                        revenueBeneficiaryLabels[access.beneficiaryType][
                          english ? "en" : "zh"
                        ]
                      }
                    </Badge>
                    <Badge
                      variant={
                        access.status === "ACTIVE"
                          ? "success"
                          : access.status === "INVITED"
                            ? "info"
                            : access.status === "SUSPENDED"
                              ? "danger"
                              : "neutral"
                      }
                    >
                      {
                        participantPortalStatusLabels[access.status][
                          english ? "en" : "zh"
                        ]
                      }
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <Info
                      label={english ? "Invite email" : "邀请邮箱"}
                      value={english ? access.inviteEmail : "已登记邮箱"}
                    />
                    <Info
                      label={english ? "Beneficiary registry" : "受益方登记"}
                      value={english ? "Registered" : "已登记"}
                    />
                    <Info
                      label={english ? "Linked user" : "已绑定用户"}
                      value={
                        access.user
                          ? english
                            ? `${access.user.name} · ${access.user.email}`
                            : access.user.name
                          : english
                            ? "Not linked yet"
                            : "尚未绑定"
                      }
                    />
                    <Info
                      label={english ? "Last invite issued" : "最近发放时间"}
                      value={formatParticipantPortalDateLabel(
                        access.lastInviteIssuedAt,
                        english,
                        formatDateLabel,
                      )}
                    />
                    <Info
                      label={english ? "Terms accepted" : "条款确认"}
                      value={formatParticipantPortalDateLabel(
                        access.termsAcceptedAt,
                        english,
                        formatDateLabel,
                      )}
                    />
                    <Info
                      label={english ? "Activated at" : "激活时间"}
                      value={formatParticipantPortalDateLabel(
                        access.activatedAt,
                        english,
                        formatDateLabel,
                      )}
                    />
                  </div>
                  {access.notes ? (
                    <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {formatSettingsCommercialText(access.notes, english)}
                    </p>
                  ) : null}
                  <div className="mt-3">
                    <Select
                      value={access.status}
                      disabled={!canManageParticipantPortal || pending}
                      onValueChange={(value) =>
                        updateParticipantPortalAccessStatus(
                          access.id,
                          value as ParticipantPortalAccessStatus,
                        )
                      }
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(participantPortalStatusLabels).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label[english ? "en" : "zh"]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title={
                  english
                    ? "No participant portal access yet"
                    : "当前还没有贡献方门户访问"
                }
                description={
                  english
                    ? "Issue the first invited access above. Participants will only see their own earnings / payout posture."
                    : "先在上方发放第一条邀请访问。参与方进入后只会看到自己的收益 / 结算姿态。"
                }
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
