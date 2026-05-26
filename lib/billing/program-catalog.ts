import {
  ActorType,
  PartnerProgramStatus,
  PartnerProgramType,
  ProgramTermsVersionStatus,
  RevenueBeneficiaryType,
} from "@prisma/client";
import { assertWorkspaceReservedCommercialRegistryServiceAccess } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { resolveHelmReservedWorkspace } from "@/lib/workspace-reserved";

type LocalizedText = {
  zh: string;
  en: string;
};

type ProgramCatalogSeed = {
  programKey: string;
  slug: string;
  programType: PartnerProgramType;
  beneficiaryType: RevenueBeneficiaryType;
  title: LocalizedText;
  summary: LocalizedText;
  audienceSummary: LocalizedText;
  contributionSummary: LocalizedText;
  revenueSummary: LocalizedText;
  settlementSummary: LocalizedText;
  boundarySummary: LocalizedText;
  termsVersionKey: string;
  termsTitle: LocalizedText;
  termsSummary: LocalizedText;
  revenueDefinition: LocalizedText;
  splitLogicSummary: LocalizedText;
  reversalRuleSummary: LocalizedText;
  reviewBoundarySummary: LocalizedText;
  payoutBoundarySummary: LocalizedText;
  platformRightsSummary: LocalizedText;
};

type ProgramCatalogGovernanceInput = {
  userId?: string | null;
  actorType?: ActorType | null;
  english?: boolean;
};

export const PROGRAM_CATALOG_SEEDS: ProgramCatalogSeed[] = [
  {
    programKey: "worker_publisher_program",
    slug: "worker-publisher-program",
    programType: PartnerProgramType.WORKER_PUBLISHER,
    beneficiaryType: RevenueBeneficiaryType.WORKER_PUBLISHER,
    title: {
      zh: "能力贡献者计划",
      en: "Worker Publisher Program",
    },
    summary: {
      zh: "面向能持续提供可复用工作流能力、知识封装或专业能力贡献的贡献方。",
      en: "For contributors who can provide reusable worker capability, knowledge packaging, or specialist contribution.",
    },
    audienceSummary: {
      zh: "适合有明确能力资产、可交付边界，并愿意接受平台审核的贡献方。",
      en: "Best for contributors with clear worker assets, delivery boundaries, and willingness to operate under platform review.",
    },
    contributionSummary: {
      zh: "可以提供能力方案、知识封装、专业复核能力，或后续可商品化的能力贡献。",
      en: "Contributors may provide worker designs, capability packaging, specialist review capacity, or later-commercializable worker contributions.",
    },
    revenueSummary: {
      zh: "收入来自扩展能力商业线的归因收入，而不是公开能力市场的即时成交。",
      en: "Revenue comes from attributed add-on worker lines, not from an open worker marketplace.",
    },
    settlementSummary: {
      zh: "当前仍按平台内部人工结算节奏处理，支持待结算状态可见，不承诺自动打款。",
      en: "Settlement remains on the internal manual-settlement cadence with payable-later visibility and no automatic payout.",
    },
    boundarySummary: {
      zh: "当前不是公开市场，也不是自动打款系统；平台保留审核、下架、暂停与邀请控制权。",
      en: "This is not a public marketplace or automatic payout system; the platform retains review, disable, pause, and invite control.",
    },
    termsVersionKey: "v1",
    termsTitle: {
      zh: "能力贡献者计划条款 v1",
      en: "Worker Publisher Program Terms v1",
    },
    termsSummary: {
      zh: "这版条款定义能力贡献的收益线、审核边界、冲回规则和人工结算现实。",
      en: "This version defines worker contribution revenue lines, review boundaries, reversal rules, and the manual-settlement reality.",
    },
    revenueDefinition: {
      zh: "当前收益线来自扩展能力的按月或按次归因收入，不等于公开市场销售。",
      en: "Revenue currently comes from attributed worker add-on monthly or per-use lines, not public marketplace sales.",
    },
    splitLogicSummary: {
      zh: "分成逻辑挂在内部 RevenueRule 上，可按固定比例、固定金额、一次性或持续型规则执行。",
      en: "Split logic is attached to internal RevenueRule objects and can run as fixed percent, fixed amount, one-time, or recurring rules.",
    },
    reversalRuleSummary: {
      zh: "当底层收入发生取消、退款或显式冲回时，平台可按规则冲回已归因条目。",
      en: "If underlying revenue is canceled, refunded, or explicitly reversed, the platform may reverse attributed lines according to the rule.",
    },
    reviewBoundarySummary: {
      zh: "能力贡献者计划的进入、启用、暂停和邀请都受内部审核控制，不自动开放。",
      en: "Program entry, activation, suspension, and invite issuance remain under internal review and are not automatic.",
    },
    payoutBoundarySummary: {
      zh: "当前打款仍保持线下人工处理；门户可见收益状态，但不执行打款。",
      en: "Payout remains manual and off-platform; the portal shows earnings posture but does not execute payouts.",
    },
    platformRightsSummary: {
      zh: "平台保留审核、停用、暂停、等待名单与不发 invite 的权利。",
      en: "The platform retains the right to review, disable, suspend, waitlist, or decline invite issuance.",
    },
  },
  {
    programKey: "custom_partner_program",
    slug: "custom-partner-program",
    programType: PartnerProgramType.CUSTOM_PARTNER,
    beneficiaryType: RevenueBeneficiaryType.CUSTOM_SERVICES,
    title: {
      zh: "Custom Partner Program",
      en: "Custom Partner Program",
    },
    summary: {
      zh: "面向能提供 custom integration、实施、维护或联合交付的服务伙伴。",
      en: "For service partners who can deliver custom integration, implementation, maintenance, or joint delivery.",
    },
    audienceSummary: {
      zh: "适合能承担实施、维护、交付协同或企业内系统接入的伙伴。",
      en: "Best for partners who can handle implementation, maintenance, delivery coordination, or enterprise system integration.",
    },
    contributionSummary: {
      zh: "可以参与 custom implementation、custom maintenance、联合交付和窄 connector/adapter 落地。",
      en: "Partners can contribute to custom implementation, custom maintenance, joint delivery, and narrow connector/adapter rollouts.",
    },
    revenueSummary: {
      zh: "收入来自定制实施 / 维护商业线的归因收入，而不是平台化服务商市场。",
      en: "Revenue comes from attributed custom implementation and maintenance lines, not from a platform SI marketplace.",
    },
    settlementSummary: {
      zh: "结算沿用平台内部月度人工结算；会显示待结算状态，但不做自动打款。",
      en: "Settlement follows the internal monthly manual-settlement cycle with payable-later visibility and no automatic payout.",
    },
    boundarySummary: {
      zh: "当前不是公开伙伴市场，不开放公开排名或发现页，也不承诺 finance-console 级对账。",
      en: "This is not a public partner marketplace, ranking surface, discovery page, or finance-console-grade reconciliation layer.",
    },
    termsVersionKey: "v1",
    termsTitle: {
      zh: "Custom Partner Program Terms v1",
      en: "Custom Partner Program Terms v1",
    },
    termsSummary: {
      zh: "这版条款冻结定制伙伴的收益来源、审核机制、冲回边界和人工结算现实。",
      en: "This version freezes the custom partner revenue source, review posture, reversal boundary, and manual-settlement reality.",
    },
    revenueDefinition: {
      zh: "当前收益线来自 custom implementation 和 custom maintenance 的归因收入，不等于完整服务市场。",
      en: "Revenue currently comes from attributed custom implementation and maintenance lines, not a full service marketplace.",
    },
    splitLogicSummary: {
      zh: "分成逻辑沿用内部 RevenueRule，可按一次性或持续型规则、比例或固定金额表达。",
      en: "Split logic follows internal RevenueRule objects with one-time or recurring, percentage or fixed-amount rules.",
    },
    reversalRuleSummary: {
      zh: "若项目收入被取消、退款或转为冲回，相关归因条目可按规则回冲。",
      en: "If project revenue is canceled, refunded, or moved into reversal, related attributed lines can be reversed by rule.",
    },
    reviewBoundarySummary: {
      zh: "伙伴申请、通过、候补、邀请和后续启用，都保持内部审核。",
      en: "Partner applications, acceptance, waitlisting, invitation, and later activation all remain under internal review.",
    },
    payoutBoundarySummary: {
      zh: "当前打款继续停在线下人工处理；CSV 导出支持线下打款，不接银行或钱包通道。",
      en: "Payout remains manual and off-platform; CSV export supports offline payment without bank or wallet rails.",
    },
    platformRightsSummary: {
      zh: "平台保留审核、停用、暂停、补资料要求和不继续合作的权利。",
      en: "The platform retains the right to review, suspend, request more information, or decline continued participation.",
    },
  },
  {
    programKey: "sales_referral_program",
    slug: "sales-referral-program",
    programType: PartnerProgramType.SALES_REFERRAL,
    beneficiaryType: RevenueBeneficiaryType.SALES_REFERRAL,
    title: {
      zh: "Sales Referral Program",
      en: "Sales Referral Program",
    },
    summary: {
      zh: "面向能带来明确商机、试点线索或商业介绍的销售转介绍方。",
      en: "For referrers who can bring qualified opportunities, pilot leads, or commercial introductions.",
    },
    audienceSummary: {
      zh: "适合有稳定介绍能力、能帮助 Helm 进入有效经营场景的个人或伙伴。",
      en: "Best for individuals or partners with repeatable referral capacity and access to real operating scenarios for Helm.",
    },
    contributionSummary: {
      zh: "可以提供试点介绍、目标客户引荐、商业机会撮合或行业渠道转介绍。",
      en: "Contributors may provide pilot intros, target customer referrals, commercial matchmaking, or channel introductions.",
    },
    revenueSummary: {
      zh: "收入来自销售转介绍收益线的归因，不是公开联盟计划或返佣平台。",
      en: "Revenue comes from sales-referral attribution, not a public affiliate or commission marketplace.",
    },
    settlementSummary: {
      zh: "结算保持内部人工结算节奏；收益和待结算状态可见，但仍不自动打款。",
      en: "Settlement stays on the internal manual-settlement cadence; earnings and payable-later posture are visible, but payouts are not automated.",
    },
    boundarySummary: {
      zh: "当前不是公开转介绍市场，也不做自动返佣结算或公开发现页。",
      en: "This is not a public referral marketplace and does not provide automatic commission settlement or public discovery.",
    },
    termsVersionKey: "v1",
    termsTitle: {
      zh: "Sales Referral Program Terms v1",
      en: "Sales Referral Program Terms v1",
    },
    termsSummary: {
      zh: "这版条款定义转介绍收益线、分成逻辑、冲回规则和平台审核 / 邀请边界。",
      en: "This version defines referral revenue lines, split logic, reversal rules, and platform review/invite boundaries.",
    },
    revenueDefinition: {
      zh: "当前收益线只来自有效销售转介绍商业线的归因收入，不等于公开拉新平台。",
      en: "Revenue currently comes only from attributed sales-referral commercial lines, not a public acquisition platform.",
    },
    splitLogicSummary: {
      zh: "分成逻辑沿用内部收益规则，可表达一次性或持续型分成，但不会自动对外执行。",
      en: "Split logic uses internal RevenueRule objects and can express one-time or recurring splits without automatic external execution.",
    },
    reversalRuleSummary: {
      zh: "当底层商机不成立、收入取消或发生退款时，平台可按规则冲回。",
      en: "If the underlying opportunity fails, revenue is canceled, or refunds occur, the platform may reverse the line by rule.",
    },
    reviewBoundarySummary: {
      zh: "转介绍的有效性、归因、通过 / 邀请决策都由内部审核控制。",
      en: "Referral validity, attribution, and accepted/invited decisions all remain under internal review.",
    },
    payoutBoundarySummary: {
      zh: "当前打款仍保持线下人工处理；门户只显示状态，不提供打款执行。",
      en: "Payout remains manual and off-platform; the portal shows status only and does not execute disbursement.",
    },
    platformRightsSummary: {
      zh: "平台保留审核、暂停、拒绝 invite、等待名单和后续停用权。",
      en: "The platform retains the right to review, suspend, reject invites, waitlist, and disable later participation.",
    },
  },
];

function selectLocalizedText(text: LocalizedText, locale: string) {
  return locale === "en-US" ? text.en : text.zh;
}

const PROGRAM_CATALOG_ZH_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Worker Publisher Program Terms v1/g, "能力贡献者计划条款 v1"],
  [/Worker Publisher Program/g, "能力贡献者计划"],
  [/Custom Partner Program Terms v1/g, "定制交付伙伴计划条款 v1"],
  [/Custom Partner Program/g, "定制交付伙伴计划"],
  [/Sales Referral Program Terms v1/g, "销售转介绍计划条款 v1"],
  [/Sales Referral Program/g, "销售转介绍计划"],
  [/worker contributions/gi, "能力贡献"],
  [/worker contribution/gi, "能力贡献"],
  [/worker add-on/gi, "扩展能力"],
  [/add-on worker/gi, "扩展能力"],
  [/specialist contribution/gi, "专业能力贡献"],
  [/specialist review/gi, "专业复核"],
  [/\bworker\b/gi, "能力贡献"],
  [/custom integration/gi, "定制集成"],
  [/custom implementation/gi, "定制实施"],
  [/custom maintenance/gi, "定制维护"],
  [/custom partner/gi, "定制交付伙伴"],
  [/connector\/adapter/gi, "连接器/适配器"],
  [/sales referral/gi, "销售转介绍"],
  [/referral marketplace/gi, "转介绍市场"],
  [/marketplace/gi, "市场"],
  [/finance-console/gi, "财务控制台"],
  [/finance console/gi, "财务控制台"],
  [/manual settlement/gi, "人工结算"],
  [/manual \/ off-platform/gi, "线下人工"],
  [/off-platform/gi, "线下"],
  [/payable-later/gi, "待结算"],
  [/payout/gi, "打款"],
  [/RevenueRule/g, "收益规则"],
  [/reversal/gi, "冲回"],
  [/review/gi, "审核"],
  [/accepted/gi, "通过"],
  [/rejected/gi, "拒绝"],
  [/waitlisted/gi, "候补"],
  [/invited/gi, "已邀请"],
  [/invite/gi, "邀请"],
  [/split/gi, "分成"],
  [/program/gi, "计划"],
  [/active/gi, "生效"],
  [/scope/gi, "范围"],
];

export function formatProgramCatalogDisplayText(value: string, locale: string) {
  if (locale === "en-US") return value;

  return PROGRAM_CATALOG_ZH_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  ).trim();
}

export function getProgramCatalogCopy(programKey: string, locale: string) {
  const match = PROGRAM_CATALOG_SEEDS.find((seed) => seed.programKey === programKey);
  if (!match) {
    return null;
  }

  const select = (text: LocalizedText) =>
    formatProgramCatalogDisplayText(selectLocalizedText(text, locale), locale);

  return {
    title: select(match.title),
    summary: select(match.summary),
    audienceSummary: select(match.audienceSummary),
    contributionSummary: select(match.contributionSummary),
    revenueSummary: select(match.revenueSummary),
    settlementSummary: select(match.settlementSummary),
    boundarySummary: select(match.boundarySummary),
    termsTitle: select(match.termsTitle),
    termsSummary: select(match.termsSummary),
    revenueDefinition: select(match.revenueDefinition),
    splitLogicSummary: select(match.splitLogicSummary),
    reversalRuleSummary: select(match.reversalRuleSummary),
    reviewBoundarySummary: select(match.reviewBoundarySummary),
    payoutBoundarySummary: select(match.payoutBoundarySummary),
    platformRightsSummary: select(match.platformRightsSummary),
  };
}

async function assertWorkspaceProgramCatalogFoundationAccess(
  workspaceId: string,
  governance?: ProgramCatalogGovernanceInput,
) {
  await assertWorkspaceReservedCommercialRegistryServiceAccess({
    workspaceId,
    userId: governance?.userId,
    actorType: governance?.actorType,
    english: governance?.english ?? false,
  });
}

export async function ensureWorkspaceProgramCatalogFoundation(
  workspaceId: string,
  now = new Date(),
  governance?: ProgramCatalogGovernanceInput,
) {
  await assertWorkspaceProgramCatalogFoundationAccess(workspaceId, governance);
  for (const seed of PROGRAM_CATALOG_SEEDS) {
    const program = await db.partnerProgram.upsert({
      where: {
        workspaceId_programKey: {
          workspaceId,
          programKey: seed.programKey,
        },
      },
      update: {},
      create: {
        workspaceId,
        programKey: seed.programKey,
        slug: seed.slug,
        title: seed.title.zh,
        summary: seed.summary.zh,
        programType: seed.programType,
        beneficiaryType: seed.beneficiaryType,
        status: PartnerProgramStatus.ACTIVE,
        audienceSummary: seed.audienceSummary.zh,
        contributionSummary: seed.contributionSummary.zh,
        revenueSummary: seed.revenueSummary.zh,
        settlementSummary: seed.settlementSummary.zh,
        boundarySummary: seed.boundarySummary.zh,
      },
    });

    await db.programTermsVersion.upsert({
      where: {
        partnerProgramId_versionKey: {
          partnerProgramId: program.id,
          versionKey: seed.termsVersionKey,
        },
      },
      update: {},
      create: {
        workspaceId,
        partnerProgramId: program.id,
        versionKey: seed.termsVersionKey,
        title: seed.termsTitle.zh,
        summary: seed.termsSummary.zh,
        revenueDefinition: seed.revenueDefinition.zh,
        splitLogicSummary: seed.splitLogicSummary.zh,
        reversalRuleSummary: seed.reversalRuleSummary.zh,
        reviewBoundarySummary: seed.reviewBoundarySummary.zh,
        payoutBoundarySummary: seed.payoutBoundarySummary.zh,
        platformRightsSummary: seed.platformRightsSummary.zh,
        status: ProgramTermsVersionStatus.ACTIVE,
        effectiveFrom: now,
        publishedAt: now,
      },
    });
  }
}

export async function resolveProgramCatalogWorkspace() {
  const workspace = await resolveHelmReservedWorkspace();

  if (!workspace) {
    return null;
  }

  await ensureWorkspaceProgramCatalogFoundation(workspace.id);
  return workspace;
}
