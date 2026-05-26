import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { UsageType } from "@prisma/client";
import {
  canManageWorkspaceImports,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { assertWorkspaceImportJobOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { rerunImportWarmup } from "@/lib/imports/crm-entry.service";

export async function POST(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canManageWorkspaceImports(session.membership.role)) {
    return NextResponse.json(
      { ok: false, error: getImportManagementDeniedMessage(english) },
      { status: 403 },
    );
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "IMPORT_WARMUP_RERUN",
  });
  const { jobId } = await context.params;

  try {
    await assertWorkspaceImportJobOwnership(workspace.id, jobId);

    const result = await rerunImportWarmup({
      jobId,
      workspaceId: workspace.id,
      userId: user.id,
    });

    revalidatePath(`/imports/jobs/${jobId}`);
    revalidatePath("/dashboard");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/search");
    revalidatePath("/meetings");
    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CRM_IMPORT,
      sourcePage: `/imports/jobs/${jobId}`,
      metadata: {
        jobId,
        operation: "warmup_rerun",
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "预热失败" },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
