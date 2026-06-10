import { ObjectType, UsageType } from "@prisma/client";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspace, requireCurrentUser } from "@/lib/auth/session";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiWorkspaceMessage,
} from "@/lib/i18n/api-message-locale";
import { generateRecommendationsForObject } from "@/lib/recommendations/recommendation.service";
import { errorResponse, successResponse } from "@/lib/memory/shared";

export async function GET(request: Request) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "RECOMMENDATION_GENERATION",
  });
  const { searchParams } = new URL(request.url);
  const objectType = searchParams.get("objectType") as ObjectType | null;
  const objectId = searchParams.get("objectId");
  const limit = searchParams.get("limit");
  const parsedLimit = limit ? Number(limit) : undefined;

  if (!objectType || !objectId) {
    return errorResponse(
      resolveApiWorkspaceMessage(workspace.defaultLocale, {
        zh: "objectType 和 objectId 不能为空",
        en: "objectType and objectId are required",
      }),
    );
  }

  const recommendations = await generateRecommendationsForObject({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: "USER",
    sourcePage: request.url,
    english,
    objectType,
    objectId,
    limit: parsedLimit && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
  });

  await recordUsageLedgerEntry({
    workspaceId: workspace.id,
    userId: user.id,
    usageType: UsageType.RECOMMENDATION_GENERATION,
    sourcePage: request.url,
    metadata: {
      objectType,
      objectId,
      limit: parsedLimit && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    },
  });

  return successResponse({ recommendations }, "ok");
}
