import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import {
  canManageWorkspaceRuntime,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { assertWorkspaceSignalObjectOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { ingestRuntimeSignals } from "@/lib/helm-v2/runtime-upgrade";
import { serverErrorMessage } from "@/lib/http/server-error";

const signalSchema = z.object({
  meetingId: z.string().optional(),
  opportunityId: z.string().optional(),
  companyId: z.string().optional(),
  signals: z.array(
    z.object({
      signalType: z.string().min(1),
      sourceType: z.string().min(1),
      sourceId: z.string().min(1),
      signalSummary: z.string().min(1),
      normalizedPayload: z.record(z.string(), z.unknown()).optional(),
      truthWeight: z.number().int().min(0).max(100).optional(),
    }),
  ),
});

export async function POST(request: Request) {
  const { membership, workspace } = await getCurrentWorkspaceSession();
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);
  const payload = signalSchema.safeParse(await request.json().catch(() => ({})));

  if (!payload.success) {
    return Response.json({ success: false, message: payload.error.issues[0]?.message ?? "参数不完整" }, { status: 400 });
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return Response.json({ success: false, message: getRuntimeManagementDeniedMessage(english) }, { status: 403 });
  }

  try {
    await assertWorkspaceSignalObjectOwnership({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      opportunityId: payload.data.opportunityId,
      companyId: payload.data.companyId,
    });

    const result = await ingestRuntimeSignals({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      opportunityId: payload.data.opportunityId,
      companyId: payload.data.companyId,
      signals: payload.data.signals,
    });

    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, message: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, "Signal ingest failed") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
