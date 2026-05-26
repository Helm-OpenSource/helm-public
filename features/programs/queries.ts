import { PartnerProgramStatus, ProgramTermsVersionStatus } from "@prisma/client";
import { getProgramCatalogCopy, resolveProgramCatalogWorkspace } from "@/lib/billing/program-catalog";
import { db } from "@/lib/db";

export type ProgramCatalogData = Awaited<ReturnType<typeof getProgramCatalogData>>;
export type ProgramCatalogDetail = Awaited<ReturnType<typeof getProgramCatalogDetail>>;

export async function getProgramCatalogData(locale: string) {
  const workspace = await resolveProgramCatalogWorkspace();

  if (!workspace) {
    return {
      workspace: null,
      programs: [],
    };
  }

  const programs = await db.partnerProgram.findMany({
    where: {
      workspaceId: workspace.id,
      status: {
        in: [PartnerProgramStatus.ACTIVE, PartnerProgramStatus.PAUSED],
      },
    },
    include: {
      termsVersions: {
        where: { status: ProgramTermsVersionStatus.ACTIVE },
        orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    workspace,
    programs: programs.map((program) => {
      const copy = getProgramCatalogCopy(program.programKey, locale);
      const activeTerms = program.termsVersions[0] ?? null;

      return {
        id: program.id,
        programKey: program.programKey,
        slug: program.slug,
        programType: program.programType,
        beneficiaryType: program.beneficiaryType,
        status: program.status,
        title: copy?.title ?? program.title,
        summary: copy?.summary ?? program.summary,
        audienceSummary: copy?.audienceSummary ?? program.audienceSummary,
        contributionSummary: copy?.contributionSummary ?? program.contributionSummary,
        revenueSummary: copy?.revenueSummary ?? program.revenueSummary,
        settlementSummary: copy?.settlementSummary ?? program.settlementSummary,
        boundarySummary: copy?.boundarySummary ?? program.boundarySummary,
        activeTerms: activeTerms
          ? {
              id: activeTerms.id,
              versionKey: activeTerms.versionKey,
              title: copy?.termsTitle ?? activeTerms.title,
              summary: copy?.termsSummary ?? activeTerms.summary,
              revenueDefinition: copy?.revenueDefinition ?? activeTerms.revenueDefinition,
              splitLogicSummary: copy?.splitLogicSummary ?? activeTerms.splitLogicSummary,
              reversalRuleSummary: copy?.reversalRuleSummary ?? activeTerms.reversalRuleSummary,
              reviewBoundarySummary:
                copy?.reviewBoundarySummary ?? activeTerms.reviewBoundarySummary,
              payoutBoundarySummary:
                copy?.payoutBoundarySummary ?? activeTerms.payoutBoundarySummary,
              platformRightsSummary:
                copy?.platformRightsSummary ?? activeTerms.platformRightsSummary,
              effectiveFrom: activeTerms.effectiveFrom,
              publishedAt: activeTerms.publishedAt,
            }
          : null,
      };
    }),
  };
}

export async function getProgramCatalogDetail(input: { slug: string; locale: string }) {
  const data = await getProgramCatalogData(input.locale);

  if (!data.workspace) {
    return null;
  }

  return data.programs.find((program) => program.slug === input.slug) ?? null;
}
