import "server-only";

import { db } from "@/lib/db";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import { logPageViewEvent } from "@/lib/analytics";
import { getContactDetailData } from "@/features/contacts/queries";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";
import { isWorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import { isEnglishLocale } from "@/lib/i18n/config";
import { resolveWorkspaceUiLocaleForRequest } from "@/lib/i18n/request-locale.server";
import { getLocalizedStageLabels } from "@/lib/i18n/labels";

export async function loadContactDetailPageData(contactId: string) {
  const workspace = await getCurrentWorkspace();
  const user = await requireCurrentUser();
  const locale = await resolveWorkspaceUiLocaleForRequest({
    workspaceDefaultLocale: workspace.defaultLocale,
  });
  const english = isEnglishLocale(locale);
  const [stageLabels, contact, opportunities, contacts, recommendations] =
    await Promise.all([
      getLocalizedStageLabels(locale),
      getContactDetailData(workspace.id, contactId),
      db.opportunity.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { updatedAt: "desc" },
      }),
      db.contact.findMany({
        where: { workspaceId: workspace.id, id: { not: contactId }, archivedAt: null },
        orderBy: { name: "asc" },
      }),
      generateRecommendationsForObject({
        workspaceId: workspace.id,
        actorName: user.name,
        actorUserId: user.id,
        actorType: "USER",
        sourcePage: `/contacts/${contactId}`,
        objectType: "CONTACT",
        objectId: contactId,
        english,
        llmEnhancement: false,
      }).catch((error) => {
        if (isWorkspaceServiceGovernanceError(error)) {
          return [];
        }
        throw error;
      }),
    ]);

  if (!contact) {
    return null;
  }

  await logPageViewEvent({
    eventName: "contact_opened",
    sourcePage: `/contacts/${contact.id}`,
    targetType: "Contact",
    targetId: contact.id,
    metadata: {
      companyId: contact.companyId,
    },
  });

  return {
    contact,
    contacts,
    english,
    opportunities,
    recommendations,
    stageLabels,
  };
}
