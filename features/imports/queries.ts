import { ImportSourceType, IdentityMatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

export async function getCrmImportData(workspaceId: string) {
  const [sources, jobs, openConflicts, recentItems] = await Promise.all([
    db.importSource.findMany({
      where: {
        workspaceId,
        sourceType: {
          in: [ImportSourceType.HUBSPOT, ImportSourceType.SALESFORCE],
        },
      },
      orderBy: [{ sourceType: "asc" }, { createdAt: "desc" }],
    }),
    db.importJob.findMany({
      where: { workspaceId },
      include: {
        source: true,
      },
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
    db.identityMatch.count({
      where: {
        workspaceId,
        status: IdentityMatchStatus.NEEDS_REVIEW,
      },
    }),
    db.importItem.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const summary = jobs.reduce(
    (acc, job) => {
      acc.totalJobs += 1;
      acc.successRecords += job.successRecords;
      acc.failedRecords += job.failedRecords;
      acc.warningRecords += job.warningRecords;
      return acc;
    },
    {
      totalJobs: 0,
      successRecords: 0,
      failedRecords: 0,
      warningRecords: 0,
    },
  );

  const latestWarmup = jobs.find((job) => Boolean(job.summaryJson));

  return {
    sources,
    jobs,
    openConflicts,
    recentItems,
    summary,
    latestWarmup: latestWarmup
      ? safeParseJson<Record<string, unknown>>(latestWarmup.summaryJson, {})
      : null,
  };
}

export async function getImportJobDetail(workspaceId: string, jobId: string) {
  return db.importJob.findFirst({
    where: {
      id: jobId,
      workspaceId,
    },
    include: {
      source: true,
      items: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export async function getImportConflicts(workspaceId: string) {
  return db.identityMatch.findMany({
    where: {
      workspaceId,
      status: IdentityMatchStatus.NEEDS_REVIEW,
    },
    orderBy: { createdAt: "desc" },
  });
}
