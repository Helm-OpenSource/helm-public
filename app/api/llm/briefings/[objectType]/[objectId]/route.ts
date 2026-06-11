import { ActorType, ObjectType } from "@prisma/client";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import { assertWorkspaceObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import {
  generateCompanyBriefingSnapshot,
  generateContactBriefingSnapshot,
  generateMeetingBriefingSnapshot,
  generateOpportunityBriefingSnapshot,
} from "@/lib/memory/briefing.service";
import { serverErrorMessage } from "@/lib/http/server-error";

function parseObjectType(value: string, english: boolean) {
  const normalized = value.toUpperCase();
  if (normalized === ObjectType.CONTACT) return ObjectType.CONTACT;
  if (normalized === ObjectType.COMPANY) return ObjectType.COMPANY;
  if (normalized === ObjectType.OPPORTUNITY) return ObjectType.OPPORTUNITY;
  if (normalized === ObjectType.MEETING) return ObjectType.MEETING;
  throw new Error(english ? "Unsupported briefing object type" : "不支持的简报对象类型");
}

export async function POST(_: Request, { params }: { params: Promise<{ objectType: string; objectId: string }> }) {
  let english = false;

  try {
    const { user, membership, workspace } = await getCurrentWorkspaceSession();
    const { objectType: rawObjectType, objectId } = await params;
    english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
    const objectType = parseObjectType(rawObjectType, english);

    if (!canManageWorkspaceInsights(membership.role)) {
      return Response.json(
        {
          success: false,
          message: getInsightGovernanceDeniedMessage(english),
        },
        { status: 403 },
      );
    }

    await assertWorkspaceObjectOwnership({
      workspaceId: workspace.id,
      objectType,
      objectId,
    });

    const baseInput = {
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      force: true,
    };

    const result =
      objectType === ObjectType.CONTACT
        ? await generateContactBriefingSnapshot({
            ...baseInput,
            sourcePage: `/contacts/${objectId}`,
            contactId: objectId,
          })
        : objectType === ObjectType.COMPANY
          ? await generateCompanyBriefingSnapshot({
              ...baseInput,
              sourcePage: `/companies/${objectId}`,
              companyId: objectId,
            })
          : objectType === ObjectType.OPPORTUNITY
            ? await generateOpportunityBriefingSnapshot({
                ...baseInput,
                sourcePage: `/opportunities?opportunityId=${objectId}`,
                opportunityId: objectId,
              })
            : await generateMeetingBriefingSnapshot({
                ...baseInput,
                sourcePage: `/meetings/${objectId}`,
                meetingId: objectId,
              });

    return Response.json({
      success: true,
      data: {
        snapshotId: result.snapshot.id,
        objectType,
        objectId,
        payload: result.payload,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "生成简报失败"),
      },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
