import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { UsageType } from "@prisma/client";
import { z } from "zod";
import {
  canManageWorkspaceImports,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { assertWorkspaceImportSourceOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { runCrmImportSource } from "@/lib/imports/crm-entry.service";
import { serverErrorMessage } from "@/lib/http/server-error";

const schema = z.object({
  sourceId: z.string().min(1),
  incremental: z.boolean().optional(),
});

export async function POST(request: Request) {
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
    operation: "CRM_IMPORT_RUN",
  });
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: english ? "Invalid CRM import input" : "导入参数错误" }, { status: 400 });
  }

  try {
    await assertWorkspaceImportSourceOwnership(workspace.id, parsed.data.sourceId);

    const result = await runCrmImportSource({
      sourceId: parsed.data.sourceId,
      workspaceId: workspace.id,
      userId: user.id,
      incremental: parsed.data.incremental,
    });

    revalidatePath("/imports");
    revalidatePath("/imports/crm");
    revalidatePath("/imports/conflicts");
    revalidatePath(`/imports/jobs/${result.jobId}`);
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    revalidatePath("/search");
    revalidatePath("/opportunities");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.CRM_IMPORT,
      sourcePage: "/imports/crm",
      metadata: {
        sourceId: parsed.data.sourceId,
        operation: parsed.data.incremental ? "incremental_sync" : "initial_import",
        jobId: result.jobId,
      },
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, english ? "CRM import failed" : "客户关系系统导入失败") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
