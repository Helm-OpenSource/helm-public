import { z } from "zod";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import {
  isEnglishWorkspaceDefaultLocale,
  resolveApiValidationIssueMessage,
} from "@/lib/i18n/api-message-locale";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import {
  assertWorkspaceMeetingOwnership,
  assertWorkspaceRuntimeSessionOwnership,
  isWorkspaceOwnershipError,
} from "@/lib/auth/tenant-ownership";
import {
  getWorkspaceAssignableOwnerDeniedMessage,
  resolveWorkspaceAssignableOwnerId,
} from "@/lib/auth/workspace-data-governance";
import { createRuntimeProblemSpace, listProblemSpacesForWorkspace } from "@/lib/helm-v2/runtime-upgrade";

const createProblemSpaceSchema = z
  .object({
    sessionId: z.string().optional(),
    meetingId: z.string().optional(),
    title: z.string().min(1),
    summary: z.string().min(1),
    nextStep: z.string().min(1),
    ownerHint: z.string().optional(),
    assignedUserId: z.string().optional(),
    assignedUserName: z.string().optional(),
    evidenceRefs: z.array(z.string().min(1)).optional(),
    status: z.enum(["DETECTED", "SCOPED", "WATCHING", "WAITING_ON_SIGNAL", "WAITING_ON_AUTHORITY"]).optional(),
  })
  .refine((value) => Boolean(value.sessionId || value.meetingId), {
    message: "missingSessionOrMeeting",
    path: ["sessionId"],
  });

export async function GET(request: Request) {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const url = new URL(request.url);
  const meetingId = url.searchParams.get("meetingId") ?? undefined;
  const data = await listProblemSpacesForWorkspace({
    workspaceId: workspace.id,
    meetingId,
  });

  return Response.json({ success: true, data });
}

export async function POST(request: Request) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = createProblemSpaceSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json(
      {
        success: false,
        message: resolveApiValidationIssueMessage(workspace.defaultLocale, payload.error.issues[0]?.message),
      },
      { status: 400 },
    );
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    if (payload.data.sessionId) {
      await assertWorkspaceRuntimeSessionOwnership(workspace.id, payload.data.sessionId);
    }
    if (payload.data.meetingId) {
      await assertWorkspaceMeetingOwnership(workspace.id, payload.data.meetingId);
    }
    const assignedUserId = payload.data.assignedUserId
      ? await resolveWorkspaceAssignableOwnerId({
          workspaceId: workspace.id,
          requestedOwnerId: payload.data.assignedUserId,
          fallbackUserId: user.id,
        })
      : undefined;
    if (payload.data.assignedUserId && !assignedUserId) {
      return Response.json({ success: false, message: getWorkspaceAssignableOwnerDeniedMessage(english) }, { status: 400 });
    }

    const result = await createRuntimeProblemSpace({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      meetingId: payload.data.meetingId,
      title: payload.data.title,
      summary: payload.data.summary,
      nextStep: payload.data.nextStep,
      ownerHint: payload.data.ownerHint,
      assignedUserId,
      assignedUserName: payload.data.assignedUserName,
      assignedByUserId: user.id,
      assignedByName: user.name,
      evidenceRefs: payload.data.evidenceRefs,
      status: payload.data.status,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: error instanceof Error ? error.message : "Problem-space creation failed" },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
