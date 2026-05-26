import { TrialApplicationStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type TrialApplicationListItem = Awaited<
  ReturnType<typeof listTrialApplications>
>[number];

export async function listTrialApplications(filter?: {
  status?: TrialApplicationStatus;
  limit?: number;
}) {
  const limit = Math.min(Math.max(filter?.limit ?? 100, 1), 500);
  return db.trialApplication.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function getTrialApplicationById(id: string) {
  return db.trialApplication.findUnique({ where: { id } });
}

export async function getTrialApplicationStatusCounts() {
  const grouped = await db.trialApplication.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const counts: Record<TrialApplicationStatus, number> = {
    PENDING: 0,
    CONTACTED: 0,
    APPROVED: 0,
    REJECTED: 0,
  };

  for (const row of grouped) {
    counts[row.status as TrialApplicationStatus] = row._count._all;
  }

  return counts;
}
