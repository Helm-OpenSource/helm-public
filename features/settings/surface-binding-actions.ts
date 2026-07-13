"use server";

import { ActorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import {
  canManageWorkspaceSetup,
  getWorkspaceGovernanceDeniedMessage,
} from "@/lib/auth/settings-governance";
import {
  getCurrentMembership,
  getCurrentWorkspace,
  requireCurrentUser,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  isSingleWinnerSurfaceKey,
  listBindableProvidersForSurface,
  requiredContractVersionForSurface,
} from "@/lib/shell/surface-binding-store";

// 绑定授权写入面(蓝图 §4.3 绑定即授权)。把某单一生效 shell surface 绑定到一个
// 已注册且契约兼容的 provider,或清除绑定(回 Core default)。授权走 capability
// evaluator——复用 MANAGE_WORKSPACE_SETUP(与扩展启停同能力、同审计路径,§4.3.3);
// providerId 只是标识,授权由 capability 决定,非 provider 自声明接管。
//
// 校验(§4.3.2 候选可绑定前提中的静态部分):surfaceKey 必须是单一生效 surface;
// providerId(非清除时)必须在该 surface 已注册的 provider 里,且 contractVersion 精确匹配。
// access/enabled 的运行时合格性在读侧 resolve 时按 workspace 主体重新评估,失效即 fail-open 回 Core。

const inputSchema = z.object({
  surfaceKey: z.string().trim().min(1).max(120),
  // null / 省略 = 清除绑定(回 Core default)。
  providerId: z.string().trim().min(1).max(191).nullish(),
});

export type SetWorkspaceSurfaceBindingInput = z.infer<typeof inputSchema>;

export type SetWorkspaceSurfaceBindingResult =
  | { ok: true; surfaceKey: string; providerId: string | null }
  | { ok: false; error: string };

export async function setWorkspaceSurfaceBindingAction(
  input: SetWorkspaceSurfaceBindingInput,
): Promise<SetWorkspaceSurfaceBindingResult> {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const membership = await getCurrentMembership();
  const english = workspace.defaultLocale === "en-US";

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid surface binding input" : "绑定参数错误",
    };
  }

  const { surfaceKey } = parsed.data;
  const providerId = parsed.data.providerId ?? null;

  if (!isSingleWinnerSurfaceKey(surfaceKey)) {
    return {
      ok: false,
      error: english
        ? `Surface ${surfaceKey} is not a single-winner surface and cannot be bound`
        : `Surface ${surfaceKey} 不是单一生效 surface,不可绑定`,
    };
  }

  // 授权闸:与扩展启停同能力。放在参数/存在性校验之后、任何写之前。
  if (!canManageWorkspaceSetup(membership.role)) {
    return { ok: false, error: getWorkspaceGovernanceDeniedMessage(english) };
  }

  // 绑定(非清除)时校验候选合格:已注册 + 契约版本精确匹配(§4.3.2)。
  if (providerId !== null) {
    const candidates = listBindableProvidersForSurface(surfaceKey);
    const candidate = candidates.find((c) => c.providerId === providerId);
    if (!candidate) {
      return {
        ok: false,
        error: english
          ? `Provider ${providerId} is not registered for surface ${surfaceKey}`
          : `Provider ${providerId} 未注册到 surface ${surfaceKey}`,
      };
    }
    const requiredVersion = requiredContractVersionForSurface(surfaceKey);
    if (candidate.contractVersion !== requiredVersion) {
      return {
        ok: false,
        error: english
          ? `Provider ${providerId} contract ${candidate.contractVersion} is incompatible with ${requiredVersion}`
          : `Provider ${providerId} 契约 ${candidate.contractVersion} 与 ${requiredVersion} 不兼容`,
      };
    }
  }

  const before = await db.workspaceSurfaceBinding.findUnique({
    where: { workspaceId_surfaceKey: { workspaceId: workspace.id, surfaceKey } },
    select: { providerId: true },
  });

  if (providerId === null) {
    // 清除绑定 → 回 Core default。deleteMany 幂等(无绑定也不报错)。
    await db.workspaceSurfaceBinding.deleteMany({
      where: { workspaceId: workspace.id, surfaceKey },
    });
  } else {
    await db.workspaceSurfaceBinding.upsert({
      where: {
        workspaceId_surfaceKey: { workspaceId: workspace.id, surfaceKey },
      },
      update: { providerId },
      create: { workspaceId: workspace.id, surfaceKey, providerId },
    });
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "WORKSPACE_SURFACE_BINDING_SET",
    targetType: "WorkspaceSurfaceBinding",
    targetId: surfaceKey,
    summary: english
      ? `Set surface ${surfaceKey} binding to ${providerId ?? "Core default"}`
      : `已将 surface ${surfaceKey} 绑定设为 ${providerId ?? "Core 默认"}`,
    payload: {
      surfaceKey,
      before: before?.providerId ?? null,
      after: providerId,
    },
    sourcePage: "/settings/extensions",
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "workspace_surface_binding_set",
    eventCategory: "settings",
    targetType: "WorkspaceSurfaceBinding",
    targetId: surfaceKey,
    metadata: {
      surfaceKey,
      before: before?.providerId ?? null,
      after: providerId,
    },
    sourcePage: "/settings/extensions",
  });

  revalidatePath("/dashboard");
  revalidatePath("/diagnostics");

  return { ok: true, surfaceKey, providerId };
}
