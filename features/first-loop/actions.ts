"use server";

import { ActorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  FIRST_LOOP_ANCHOR_RESUMED_ACTION,
  FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
  FIRST_LOOP_RETURN_ANCHOR_ACTION,
  FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
} from "@/lib/operating-system/first-loop";

const firstLoopReturnAnchorSchema = z.object({
  href: z.string().min(1).max(400).startsWith("/"),
  label: z.string().min(1).max(180),
  summary: z.string().min(1).max(600),
  sourcePage: z.string().min(1).max(400).startsWith("/"),
});

const firstLoopAdoptionEventSchema = z.object({
  kind: z.enum([
    "setup-handoff-entered",
    "primary-action-opened",
    "anchor-resumed",
  ]),
  href: z.string().min(1).max(400).startsWith("/"),
  label: z.string().min(1).max(180),
  summary: z.string().min(1).max(600),
  sourcePage: z.string().min(1).max(400).startsWith("/"),
  sourceArea: z.enum([
    "dashboard-handoff",
    "first-loop-summary",
    "dashboard-work-entry",
  ]),
  stepId: z
    .enum([
      "role-goal",
      "signal",
      "suggestion",
      "review",
      "follow-through",
      "write-back",
      "anchor",
    ])
    .optional(),
});

function buildFirstLoopAdoptionAudit(input: {
  kind: z.infer<typeof firstLoopAdoptionEventSchema>["kind"];
  label: string;
  english: boolean;
}) {
  switch (input.kind) {
    case "setup-handoff-entered":
      return {
        actionType: FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
        summary: input.english
          ? `Entered setup handoff for first-loop action: ${input.label}`
          : `进入初始化交接，准备执行首轮闭环动作：${input.label}`,
      };
    case "primary-action-opened":
      return {
        actionType: FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
        summary: input.english
          ? `Opened first-loop primary action: ${input.label}`
          : `打开首轮闭环唯一下一步：${input.label}`,
      };
    case "anchor-resumed":
      return {
        actionType: FIRST_LOOP_ANCHOR_RESUMED_ACTION,
        summary: input.english
          ? `Resumed first-loop return anchor: ${input.label}`
          : `继续首轮闭环回访锚点：${input.label}`,
      };
  }
}

export async function recordFirstLoopAdoptionEventAction(
  input: z.infer<typeof firstLoopAdoptionEventSchema>,
) {
  const session = await getCurrentWorkspaceSession();
  const { membership, user, workspace } = session;
  const english = workspace.defaultLocale === "en-US";
  const parsed = firstLoopAdoptionEventSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "First-loop event input is invalid" : "首轮闭环事件参数无效",
    };
  }

  if (membership.status !== "ACTIVE") {
    return {
      ok: false,
      error: english ? "Current membership is not active" : "当前成员状态不是 active",
    };
  }

  const audit = buildFirstLoopAdoptionAudit({
    kind: parsed.data.kind,
    label: parsed.data.label,
    english,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: audit.actionType,
    targetType: "Workspace",
    targetId: workspace.id,
    summary: audit.summary,
    payload: parsed.data,
    sourcePage: parsed.data.sourcePage,
    relatedObjectType: "Page",
    relatedObjectId: parsed.data.href,
  });

  revalidatePath("/diagnostics");

  return { ok: true };
}

export async function saveFirstLoopReturnAnchorAction(
  input: z.infer<typeof firstLoopReturnAnchorSchema>,
) {
  const session = await getCurrentWorkspaceSession();
  const { membership, user, workspace } = session;
  const english = workspace.defaultLocale === "en-US";
  const parsed = firstLoopReturnAnchorSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Return anchor input is invalid" : "回访锚点参数无效",
    };
  }

  if (membership.status !== "ACTIVE") {
    return {
      ok: false,
      error: english ? "Current membership is not active" : "当前成员状态不是 active",
    };
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: FIRST_LOOP_RETURN_ANCHOR_ACTION,
    targetType: "Workspace",
    targetId: workspace.id,
    summary: english
      ? `Saved first-loop return anchor: ${parsed.data.label}`
      : `保存首轮闭环回访锚点：${parsed.data.label}`,
    payload: parsed.data,
    sourcePage: parsed.data.sourcePage,
    relatedObjectType: "Page",
    relatedObjectId: parsed.data.href,
  });

  revalidatePath(parsed.data.sourcePage);
  revalidatePath("/dashboard");
  revalidatePath("/diagnostics");

  return { ok: true };
}
