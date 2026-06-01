import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canResolveWorkspaceImportConflicts,
  getImportConflictResolutionDeniedMessage,
} from "@/lib/auth/import-governance";
import { assertWorkspaceImportConflictOwnership, isWorkspaceOwnershipError } from "@/lib/auth/tenant-ownership";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { isEnglishWorkspaceDefaultLocale } from "@/lib/i18n/api-message-locale";
import { resolveImportConflict } from "@/lib/imports/crm-orchestrator.service";

const schema = z.object({
  resolution: z.enum(["LINK", "CREATE_NEW", "IGNORE"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = isEnglishWorkspaceDefaultLocale(workspace.defaultLocale);

  if (!canResolveWorkspaceImportConflicts(session.membership.role)) {
    return NextResponse.json(
      { ok: false, error: getImportConflictResolutionDeniedMessage(english) },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: english ? "Invalid conflict resolution input" : "冲突处理参数错误" }, { status: 400 });
  }

  try {
    await assertWorkspaceImportConflictOwnership(workspace.id, id);

    const result = await resolveImportConflict({
      workspaceId: workspace.id,
      userId: user.id,
      actorName: user.name,
      identityMatchId: id,
      resolution: parsed.data.resolution,
      english,
    });

    revalidatePath("/imports/conflicts");
    revalidatePath("/imports");
    revalidatePath("/dashboard");
    revalidatePath("/search");
    revalidatePath("/opportunities");

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "冲突处理失败" },
      { status: isWorkspaceOwnershipError(error) ? 404 : 500 },
    );
  }
}
