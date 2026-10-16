import { db } from "@/lib/db";

export function buildEmptySearchWorkspaceEntitiesResult() {
  return {
    contacts: [],
    companies: [],
    opportunities: [],
    meetings: [],
  };
}

export async function searchWorkspaceEntities(workspaceId: string, query: string) {
  const normalized = query.trim();

  if (!normalized) {
    return buildEmptySearchWorkspaceEntitiesResult();
  }

  const [contacts, companies, opportunities, meetings] = await Promise.all([
    db.contact.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        OR: [{ name: { contains: normalized } }, { email: { contains: normalized } }, { title: { contains: normalized } }],
      },
      include: {
        company: true,
        opportunities: {
          take: 2,
          orderBy: { updatedAt: "desc" },
        },
      },
      take: 8,
      orderBy: { updatedAt: "desc" },
    }),
    db.company.findMany({
      where: {
        workspaceId,
        OR: [{ name: { contains: normalized } }, { industry: { contains: normalized } }, { description: { contains: normalized } }],
      },
      include: {
        opportunities: {
          where: {
            stage: {
              notIn: ["DONE", "LOST"],
            },
          },
          take: 2,
          orderBy: { updatedAt: "desc" },
        },
      },
      take: 8,
      orderBy: { updatedAt: "desc" },
    }),
    db.opportunity.findMany({
      where: {
        workspaceId,
        OR: [{ title: { contains: normalized } }, { nextAction: { contains: normalized } }, { description: { contains: normalized } }],
      },
      include: {
        company: true,
        contacts: true,
        owner: true,
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
    db.meeting.findMany({
      where: {
        workspaceId,
        OR: [{ title: { contains: normalized } }, { agenda: { contains: normalized } }, { location: { contains: normalized } }],
      },
      include: {
        company: true,
        contacts: true,
        opportunity: true,
      },
      take: 8,
      orderBy: { startsAt: "desc" },
    }),
  ]);

  return {
    contacts,
    companies,
    opportunities,
    meetings,
  };
}

export type SearchWorkspaceEntitiesResult = Awaited<
  ReturnType<typeof searchWorkspaceEntities>
>;

// Object-first (2026-10-15 wave 4): an empty query shows the workspace's most
// recently touched objects instead of an empty page. Same shapes as a search
// result so the page renders both through one list; scoped to the workspace,
// archived contacts excluded, and bounded per type.
// 空查询时显示最近改动的对象：与搜索结果同形，限定工作区，每类有上限。
export const RECENT_SEARCH_OBJECTS_PER_TYPE = 5;

export async function loadRecentSearchObjects(workspaceId: string) {
  const take = RECENT_SEARCH_OBJECTS_PER_TYPE;
  const [contacts, companies, opportunities, meetings] = await Promise.all([
    db.contact.findMany({
      where: { workspaceId, archivedAt: null },
      include: {
        company: true,
        opportunities: {
          take: 2,
          orderBy: { updatedAt: "desc" },
        },
      },
      take,
      orderBy: { updatedAt: "desc" },
    }),
    db.company.findMany({
      where: { workspaceId },
      include: {
        opportunities: {
          where: {
            stage: {
              notIn: ["DONE", "LOST"],
            },
          },
          take: 2,
          orderBy: { updatedAt: "desc" },
        },
      },
      take,
      orderBy: { updatedAt: "desc" },
    }),
    db.opportunity.findMany({
      where: { workspaceId },
      include: {
        company: true,
        contacts: true,
        owner: true,
      },
      take,
      orderBy: { updatedAt: "desc" },
    }),
    db.meeting.findMany({
      where: { workspaceId },
      include: {
        company: true,
        contacts: true,
        opportunity: true,
      },
      take,
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    contacts,
    companies,
    opportunities,
    meetings,
  } satisfies SearchWorkspaceEntitiesResult;
}
