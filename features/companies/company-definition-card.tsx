"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  acceptCompanyDefinitionSuggestionAction,
  generateCompanyDefinitionSuggestionAction,
} from "@/features/companies/actions";
import type { CompanyDefinitionSuggestion } from "@/lib/definitions/company-definition";
import { safeParseJson } from "@/lib/utils";

type CompanyDefinitionCardProps = {
  locale: "zh-CN" | "en-US";
  company: {
    id: string;
    name: string;
    website: string | null;
    definitionSuggestionJson: string | null;
    definitionAcceptedJson: string | null;
  };
};

type CompanyDefinitionEditor = {
  identity: string;
  offering: string;
  customerType: string;
  stageGuess: string;
  operatingConstraints: string;
  likelySuccessDefinition: string;
  likelyRiskDefinition: string;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidenceRefs: string;
  boundaryNote: string;
  websiteSourceUrl: string;
  websitePageTitle: string;
  websiteMetaDescription: string;
  websiteHeading: string;
  websiteFetched: boolean;
  websiteError: string;
};

function buildEditor(value: CompanyDefinitionSuggestion | null): CompanyDefinitionEditor {
  return {
    identity: value?.identity ?? "",
    offering: value?.offering ?? "",
    customerType: value?.customerType ?? "",
    stageGuess: value?.stageGuess ?? "",
    operatingConstraints: value?.operatingConstraints ?? "",
    likelySuccessDefinition: value?.likelySuccessDefinition ?? "",
    likelyRiskDefinition: value?.likelyRiskDefinition ?? "",
    confidence: value?.confidence ?? "LOW",
    evidenceRefs: value?.evidenceRefs.join("\n") ?? "",
    boundaryNote: value?.boundaryNote ?? "",
    websiteSourceUrl: value?.websiteScan.sourceUrl ?? "",
    websitePageTitle: value?.websiteScan.pageTitle ?? "",
    websiteMetaDescription: value?.websiteScan.metaDescription ?? "",
    websiteHeading: value?.websiteScan.heading ?? "",
    websiteFetched: value?.websiteScan.fetched ?? false,
    websiteError: value?.websiteScan.error ?? "",
  };
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function CompanyDefinitionCard({ locale, company }: CompanyDefinitionCardProps) {
  const acceptedDefinition = useMemo(
    () =>
      safeParseJson<CompanyDefinitionSuggestion | null>(
        company.definitionAcceptedJson,
        null,
      ),
    [company.definitionAcceptedJson],
  );
  const suggestion = useMemo(
    () =>
      safeParseJson<CompanyDefinitionSuggestion | null>(
        company.definitionSuggestionJson,
        null,
      ),
    [company.definitionSuggestionJson],
  );
  const resetKey = `${company.definitionAcceptedJson ?? "accepted:none"}::${company.definitionSuggestionJson ?? "suggestion:none"}`;

  return (
    <CompanyDefinitionCardBody
      key={resetKey}
      locale={locale}
      company={company}
      acceptedDefinition={acceptedDefinition}
      suggestion={suggestion}
    />
  );
}

type CompanyDefinitionCardBodyProps = CompanyDefinitionCardProps & {
  acceptedDefinition: CompanyDefinitionSuggestion | null;
  suggestion: CompanyDefinitionSuggestion | null;
};

function CompanyDefinitionCardBody({
  locale,
  company,
  acceptedDefinition,
  suggestion,
}: CompanyDefinitionCardBodyProps) {
  const router = useRouter();
  const english = locale === "en-US";
  const [, startTransition] = useTransition();
  const [editor, setEditor] = useState<CompanyDefinitionEditor>(
    buildEditor(acceptedDefinition ?? suggestion),
  );

  const generateSuggestion = () => {
    startTransition(async () => {
      const result = await generateCompanyDefinitionSuggestionAction(company.id);
      if (!result.ok || !result.suggestion) {
        toast.error(result.error ?? (english ? "Failed to generate company definition suggestion" : "生成公司定义建议失败"));
        return;
      }

      setEditor(buildEditor(result.suggestion));
      toast.success(english ? "Company definition suggestion refreshed" : "公司定义建议已刷新");
      router.refresh();
    });
  };

  const acceptSuggestion = () => {
    startTransition(async () => {
      const result = await acceptCompanyDefinitionSuggestionAction({
        companyId: company.id,
        identity: editor.identity.trim(),
        offering: editor.offering.trim(),
        customerType: editor.customerType.trim(),
        stageGuess: editor.stageGuess.trim(),
        operatingConstraints: editor.operatingConstraints.trim(),
        likelySuccessDefinition: editor.likelySuccessDefinition.trim(),
        likelyRiskDefinition: editor.likelyRiskDefinition.trim(),
        confidence: editor.confidence,
        evidenceRefs: splitLines(editor.evidenceRefs),
        boundaryNote: editor.boundaryNote.trim(),
        websiteScan: {
          sourceUrl: editor.websiteSourceUrl.trim() || null,
          pageTitle: editor.websitePageTitle.trim() || null,
          metaDescription: editor.websiteMetaDescription.trim() || null,
          heading: editor.websiteHeading.trim() || null,
          fetched: editor.websiteFetched,
          error: editor.websiteError.trim() || null,
        },
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Failed to accept company definition" : "接受公司定义失败"));
        return;
      }

      toast.success(english ? "Active company definition updated" : "当前公司定义已更新");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{english ? "Company definition assist" : "公司定义辅助"}</CardTitle>
          {acceptedDefinition ? (
            <Badge variant="info">{english ? "Active definition accepted" : "已接受为当前定义"}</Badge>
          ) : suggestion ? (
            <Badge variant="neutral">{english ? "Suggestion only" : "当前只有建议稿"}</Badge>
          ) : null}
        </div>
        <CardDescription>
          {english
            ? "Use official-site clues and internal operating signals to prefill a bounded company definition, then edit it before acceptance."
            : "用官网线索和内部经营信号预填一版有边界的公司定义，再修改后接受。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]/80 px-4 py-3 text-sm leading-6 text-[color:var(--muted)]">
          <p className="font-medium text-[color:var(--foreground)]">{english ? "Source posture" : "当前来源姿态"}</p>
          <p className="mt-2 break-words">
            {company.website
              ? english
                ? `Official website: ${company.website}`
                : `官网：${company.website}`
              : english
                ? "No website is stored yet, so suggestion confidence will stay conservative."
                : "当前还没有公司官网，因此建议置信度会保持保守。"}
          </p>
          {editor.websiteSourceUrl ? (
            <p className="mt-1 break-words">
              {english ? `Latest scan: ${editor.websiteSourceUrl}` : `最近扫描来源：${editor.websiteSourceUrl}`}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={generateSuggestion}>
            {suggestion ? (english ? "Regenerate suggestion" : "重新生成建议") : (english ? "Generate suggestion" : "生成建议")}
          </Button>
          <Button onClick={acceptSuggestion} disabled={!editor.identity.trim() || !editor.offering.trim()}>
            {english ? "Accept active definition" : "接受为当前定义"}
          </Button>
        </div>

        <DefinitionField
          label={english ? "Identity" : "公司身份"}
          value={editor.identity}
          onChange={(value) => setEditor((current) => ({ ...current, identity: value }))}
          rows={3}
        />
        <DefinitionField
          label={english ? "Offering" : "卖什么 / 做什么"}
          value={editor.offering}
          onChange={(value) => setEditor((current) => ({ ...current, offering: value }))}
          rows={3}
        />
        <DefinitionField
          label={english ? "Customer type" : "主要客户 / 受众"}
          value={editor.customerType}
          onChange={(value) => setEditor((current) => ({ ...current, customerType: value }))}
          rows={3}
        />
        <DefinitionField
          label={english ? "Stage guess" : "当前阶段判断"}
          value={editor.stageGuess}
          onChange={(value) => setEditor((current) => ({ ...current, stageGuess: value }))}
          rows={3}
        />
        <DefinitionField
          label={english ? "Operating constraints" : "经营约束 / 当前卡点"}
          value={editor.operatingConstraints}
          onChange={(value) => setEditor((current) => ({ ...current, operatingConstraints: value }))}
          rows={3}
        />
        <DefinitionField
          label={english ? "Likely success definition" : "推测的成功定义"}
          value={editor.likelySuccessDefinition}
          onChange={(value) => setEditor((current) => ({ ...current, likelySuccessDefinition: value }))}
          rows={3}
        />
        <DefinitionField
          label={english ? "Likely risk definition" : "推测的主要风险"}
          value={editor.likelyRiskDefinition}
          onChange={(value) => setEditor((current) => ({ ...current, likelyRiskDefinition: value }))}
          rows={3}
        />

        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-sm font-medium text-[color:var(--foreground)]">{english ? "Confidence" : "置信度"}</p>
            <select
              aria-label={english ? "Definition confidence" : "定义置信度"}
              className="h-10 w-full rounded-md border border-[color:var(--border)] bg-white px-3 text-sm"
              value={editor.confidence}
              onChange={(event) =>
                setEditor((current) => ({
                  ...current,
                  confidence: event.target.value as "LOW" | "MEDIUM" | "HIGH",
                }))
              }
            >
              <option value="LOW">{english ? "Low" : "低"}</option>
              <option value="MEDIUM">{english ? "Medium" : "中"}</option>
              <option value="HIGH">{english ? "High" : "高"}</option>
            </select>
          </div>
          <DefinitionField
            label={english ? "Evidence refs" : "证据来源"}
            value={editor.evidenceRefs}
            onChange={(value) => setEditor((current) => ({ ...current, evidenceRefs: value }))}
          />
        </div>

        <DefinitionField
          label={english ? "Boundary note" : "边界说明"}
          value={editor.boundaryNote}
          onChange={(value) => setEditor((current) => ({ ...current, boundaryNote: value }))}
          rows={3}
        />

        <div className="grid gap-3 md:grid-cols-2">
          <Input
            value={editor.websitePageTitle}
            onChange={(event) => setEditor((current) => ({ ...current, websitePageTitle: event.target.value }))}
            placeholder={english ? "Website title" : "官网标题"}
          />
          <Input
            value={editor.websiteHeading}
            onChange={(event) => setEditor((current) => ({ ...current, websiteHeading: event.target.value }))}
            placeholder={english ? "Website heading" : "官网主标题"}
          />
        </div>
        <DefinitionField
          label={english ? "Website meta description" : "官网 meta 描述"}
          value={editor.websiteMetaDescription}
          onChange={(value) => setEditor((current) => ({ ...current, websiteMetaDescription: value }))}
          rows={3}
        />

        <div className="rounded-2xl border border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/80 px-4 py-3 text-sm leading-6 text-[color:var(--status-warning-text)]">
          {english
            ? "This remains suggestion-backed operating context. It does not auto-write goal truth, KPI truth, or customer-facing commitment."
            : "这层仍然只是由建议支撑的经营上下文，不会自动写入目标事实、KPI 事实或客户承诺。"}
        </div>
      </CardContent>
    </Card>
  );
}

function DefinitionField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[color:var(--foreground)]">{label}</p>
      <Textarea
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
      />
      <p className="text-xs text-[color:var(--muted-foreground)]">每行一条证据时，也可以直接按行拆开填写。</p>
    </div>
  );
}
