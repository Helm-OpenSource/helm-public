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
