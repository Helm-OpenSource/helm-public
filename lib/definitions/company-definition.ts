import type { OpportunityType } from "@prisma/client";
import type { UiLocale } from "@/lib/i18n/config";
import { normalizeDomain } from "@/lib/imports/crm-types";

export type DefinitionConfidence = "LOW" | "MEDIUM" | "HIGH";

export type CompanyDefinitionSuggestion = {
  version: 1;
  locale: UiLocale;
  generatedAt: string;
  posture: "SUGGESTION" | "ACCEPTED";
  companyName: string;
  identity: string;
  offering: string;
  customerType: string;
  stageGuess: string;
  operatingConstraints: string;
  likelySuccessDefinition: string;
  likelyRiskDefinition: string;
  evidenceRefs: string[];
  confidence: DefinitionConfidence;
  boundaryNote: string;
  websiteScan: {
    sourceUrl: string | null;
    pageTitle: string | null;
    metaDescription: string | null;
    heading: string | null;
    fetched: boolean;
    error: string | null;
  };
};

type CompanyDefinitionSource = {
  locale: UiLocale;
  company: {
    name: string;
    website: string | null;
    industry: string | null;
    description: string | null;
    cooperationMaturity: string | null;
    recommendedPath: string | null;
  };
  operatingSignals: {
    contactCount: number;
    opportunityCount: number;
    opportunityTypes: OpportunityType[];
    meetingCount: number;
    memoryFactTitles: string[];
    topCommitmentTitle: string | null;
    topBlockerTitle: string | null;
  };
  websiteScan?: CompanyDefinitionSuggestion["websiteScan"];
};

type WebsiteScanResult = CompanyDefinitionSuggestion["websiteScan"];

const META_DESCRIPTION_REGEX =
  /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i;
const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const H1_REGEX = /<h1[^>]*>([\s\S]*?)<\/h1>/i;

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function coerceWebsiteUrl(value?: string | null) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function fetchCompanyWebsiteScan(
  website?: string | null,
): Promise<WebsiteScanResult> {
  const sourceUrl = coerceWebsiteUrl(website);
  if (!sourceUrl) {
    return {
      sourceUrl: null,
      pageTitle: null,
      metaDescription: null,
      heading: null,
      fetched: false,
      error: "missing_website",
    };
  }

  try {
    const response = await fetch(sourceUrl, {
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": "Helm Definition Assist/1.0",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        sourceUrl,
        pageTitle: null,
        metaDescription: null,
        heading: null,
        fetched: false,
        error: `http_${response.status}`,
      };
    }

    const html = await response.text();
    const pageTitleMatch = html.match(TITLE_REGEX);
    const metaDescriptionMatch = html.match(META_DESCRIPTION_REGEX);
    const headingMatch = html.match(H1_REGEX);

    return {
      sourceUrl,
      pageTitle: pageTitleMatch ? stripHtml(pageTitleMatch[1] ?? "") || null : null,
      metaDescription: metaDescriptionMatch ? stripHtml(metaDescriptionMatch[1] ?? "") || null : null,
      heading: headingMatch ? stripHtml(headingMatch[1] ?? "") || null : null,
      fetched: true,
      error: null,
    };
  } catch (error) {
    return {
      sourceUrl,
      pageTitle: null,
      metaDescription: null,
      heading: null,
      fetched: false,
      error: error instanceof Error ? error.message : "fetch_failed",
    };
  }
}

function resolveEngagementMode(opportunityTypes: OpportunityType[]) {
  const clientCount = opportunityTypes.filter((type) => type === "CLIENT").length;
  const recruitingCount = opportunityTypes.filter((type) => type === "RECRUITING").length;
  const partnershipCount = opportunityTypes.filter((type) => type === "PARTNERSHIP").length;

  if (clientCount >= recruitingCount && clientCount >= partnershipCount && clientCount > 0) {
    return "CLIENT";
  }
  if (recruitingCount >= clientCount && recruitingCount >= partnershipCount && recruitingCount > 0) {
    return "RECRUITING";
  }
  if (partnershipCount > 0) {
    return "PARTNERSHIP";
  }

  return "UNKNOWN";
}

function guessConfidence(input: CompanyDefinitionSource) {
  let score = 0;
  if (input.company.website) score += 1;
  if (input.websiteScan?.fetched && (input.websiteScan.metaDescription || input.websiteScan.pageTitle)) score += 1;
  if (input.company.industry) score += 1;
  if (input.company.description) score += 1;
  if (input.operatingSignals.opportunityCount > 0) score += 1;
  if (input.operatingSignals.meetingCount > 0) score += 1;
  if (input.operatingSignals.topBlockerTitle || input.operatingSignals.topCommitmentTitle) score += 1;

  if (score >= 6) return "HIGH";
  if (score >= 3) return "MEDIUM";
  return "LOW";
}

export function buildCompanyDefinitionSuggestion(
  input: CompanyDefinitionSource,
): CompanyDefinitionSuggestion {
  const english = input.locale === "en-US";
  const confidence = guessConfidence(input);
  const engagementMode = resolveEngagementMode(input.operatingSignals.opportunityTypes);
  const domain = normalizeDomain(input.company.website);
  const websiteScan = input.websiteScan ?? {
    sourceUrl: coerceWebsiteUrl(input.company.website),
    pageTitle: null,
    metaDescription: null,
    heading: null,
    fetched: false,
    error: "not_run",
  };
  const internalSignalLine = english
    ? `${input.operatingSignals.contactCount} contacts, ${input.operatingSignals.opportunityCount} opportunities, and ${input.operatingSignals.meetingCount} meetings are already linked in the workspace.`
    : `当前工作区已关联 ${input.operatingSignals.contactCount} 位联系人、${input.operatingSignals.opportunityCount} 条机会和 ${input.operatingSignals.meetingCount} 场会议。`;
  const websiteSummary =
    input.company.description?.trim() ||
    websiteScan.metaDescription ||
    websiteScan.heading ||
    websiteScan.pageTitle ||
    (english
      ? "The official website does not yet provide enough structured positioning text, so this suggestion stays conservative."
      : "官网当前没有给出足够清楚的定位描述，所以这版建议会保持保守。");

  const identity = english
    ? `${input.company.name} currently reads like ${input.company.industry ? `a ${input.company.industry.toLowerCase()} company` : "an operating company"} that Helm is tracking as a live account rather than a static directory row.`
    : `${input.company.name} 当前更像一家具备持续经营上下文的${input.company.industry ? `${input.company.industry}公司` : "公司"}，在 Helm 里应被读成正在推进的账户，而不是静态名录行。`;
  const offering = english
    ? websiteSummary
    : websiteSummary;
  const customerType =
    engagementMode === "CLIENT"
      ? english
        ? "Current signals suggest a customer or prospect buying path, likely involving commercial and delivery stakeholders."
        : "当前信号更像客户或潜在客户的采购/推进链，通常会同时涉及商业和交付相关角色。"
      : engagementMode === "RECRUITING"
        ? english
          ? "Current signals suggest a hiring or recruiting path, likely involving hiring managers and candidate coordination."
          : "当前信号更像招聘或候选人推进链，通常会涉及 hiring 主管 与候选人协调。"
        : engagementMode === "PARTNERSHIP"
          ? english
            ? "Current signals suggest a partnership path, likely requiring mutual fit and scoped commercial validation."
            : "当前信号更像合作伙伴推进链，通常需要双向适配和窄商业验证。"
          : english
            ? "The current audience is still ambiguous, so this should stay a reviewable draft until the team confirms the real buying or collaboration path."
            : "当前受众仍不够明确，因此这版定义应继续保持为可复核草稿，直到团队确认真实采购或协作路径。";
  const stageGuess =
    input.company.cooperationMaturity?.trim() ||
    (input.operatingSignals.opportunityCount >= 2 && input.operatingSignals.meetingCount >= 2
      ? english
        ? "Warming with real operating context, but still not a fully confirmed commercial truth."
        : "已进入带真实经营上下文的升温阶段，但仍不是完全确认的商业 truth。"
      : input.operatingSignals.meetingCount > 0
        ? english
          ? "Early validation stage with enough signal to define the next move."
          : "处于早期验证阶段，但已经有足够信号定义下一步。"
        : english
          ? "Still in observation mode; more context is needed before this becomes a stable definition."
          : "仍偏观察态，需更多上下文后才能形成稳定定义。");
  const operatingConstraints =
    input.operatingSignals.topBlockerTitle
      ? english
        ? `The main operating drag currently appears to be "${input.operatingSignals.topBlockerTitle}". Recommended path: ${input.company.recommendedPath ?? "clarify the real blocker owner before expanding the push"}.`
        : `当前主要经营阻力看起来是“${input.operatingSignals.topBlockerTitle}”。推荐路径：${input.company.recommendedPath ?? "先找清楚阻塞负责人，再扩大推进动作"}。`
      : english
        ? `${internalSignalLine} The main constraint is probably missing owner clarity or insufficient evidence, so the next move should stay narrow and reviewable.`
        : `${internalSignalLine} 当前主要约束更可能是负责人不清或证据不足，因此下一步应继续保持窄、可复核。`;
  const likelySuccessDefinition =
    input.operatingSignals.topCommitmentTitle
      ? english
        ? `Success currently looks like closing "${input.operatingSignals.topCommitmentTitle}" and turning the account into a more reliable next-step chain.`
        : `当前的成功更像是先兑现“${input.operatingSignals.topCommitmentTitle}”，把账户变成更可靠的下一步 chain。`
      : english
        ? "Success likely means converting current interactions into one explicit next move, one clearer owner, and stronger continuity across meetings, memory, and opportunity state."
        : "成功更可能意味着把当前互动收成一个明确下一动作、一个更清楚的负责人，以及更稳定的会议/记忆/机会连续性。";
  const likelyRiskDefinition =
    input.operatingSignals.topBlockerTitle
      ? english
        ? `Main risk: over-reading momentum while "${input.operatingSignals.topBlockerTitle}" is still unresolved.`
        : `当前最大风险：在“${input.operatingSignals.topBlockerTitle}”还没解决时，过度高估推进势能。`
      : confidence === "LOW"
        ? english
          ? "Main risk: public information and internal evidence are still too thin, so this definition could easily overfit one sparse signal."
          : "当前最大风险：公开信息和内部证据都还偏薄，这版定义很容易被单一稀疏信号带偏。"
        : english
          ? "Main risk: internal context could drift faster than the public company profile, so the definition still needs operator review."
          : "当前最大风险：内部推进上下文变化速度可能快于公开资料，因此这版定义仍需要操作员复核。";

  const evidenceRefs = [
    input.company.website ? (english ? `Company website: ${input.company.website}` : `公司官网：${input.company.website}`) : null,
    domain ? (english ? `Normalized domain: ${domain}` : `标准化域名：${domain}`) : null,
    input.company.industry ? (english ? `Industry field: ${input.company.industry}` : `行业字段：${input.company.industry}`) : null,
    input.company.description ? (english ? "Stored company description" : "已有公司描述") : null,
    websiteScan.pageTitle ? (english ? `Official title: ${websiteScan.pageTitle}` : `官网标题：${websiteScan.pageTitle}`) : null,
    websiteScan.metaDescription ? (english ? "Official meta description" : "官网 meta 描述") : null,
    internalSignalLine,
    input.operatingSignals.topCommitmentTitle
      ? english
        ? `Top commitment: ${input.operatingSignals.topCommitmentTitle}`
        : `当前主承诺：${input.operatingSignals.topCommitmentTitle}`
      : null,
    input.operatingSignals.topBlockerTitle
      ? english
        ? `Top blocker: ${input.operatingSignals.topBlockerTitle}`
        : `当前主阻塞：${input.operatingSignals.topBlockerTitle}`
      : null,
    input.operatingSignals.memoryFactTitles[0]
      ? english
        ? `Leading memory fact: ${input.operatingSignals.memoryFactTitles[0]}`
        : `首条记忆事实：${input.operatingSignals.memoryFactTitles[0]}`
      : null,
  ].filter((item): item is string => Boolean(item));

  return {
    version: 1,
    locale: input.locale,
    generatedAt: new Date().toISOString(),
    posture: "SUGGESTION",
    companyName: input.company.name,
    identity,
    offering,
    customerType,
    stageGuess,
    operatingConstraints,
    likelySuccessDefinition,
    likelyRiskDefinition,
    evidenceRefs,
    confidence,
    boundaryNote: english
      ? "This stays a suggestion only. Public website clues and internal signals can seed a draft, but they do not auto-become canonical truth, goal, KPI, or external commitment."
      : "这仍然只是 suggestion。公开网页线索和内部信号只能生成草稿，不会自动升格成 权威事实、goal、KPI 或外部承诺。",
    websiteScan,
  };
}
