import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canManageWorkspaceImports,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { assertWorkspaceImportSourceOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { runCrmImportSource } from "@/lib/imports/crm-entry.service";
import { serverErrorMessage } from "@/lib/http/server-error";

const schema = z.object({
  sourceId: z.string().min(1),
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

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: english ? "Invalid CRM sync input" : "同步参数错误" }, { status: 400 });
  }

  try {
    await assertWorkspaceImportSourceOwnership(workspace.id, parsed.data.sourceId);

    const result = await runCrmImportSource({
      sourceId: parsed.data.sourceId,
      workspaceId: workspace.id,
      userId: user.id,
      incremental: true,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: isWorkspaceOwnershipError(error) ? error.message : serverErrorMessage(error, english ? "CRM incremental sync failed" : "客户关系系统增量同步失败") },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
