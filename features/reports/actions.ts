"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";
import { generateWeeklyReport } from "@/lib/reports";

const schema = z.object({
  offset: z.number().min(0).max(12).default(0),
});

export async function generateWeeklyReportAction(input?: z.infer<typeof schema>) {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";
  const parsed = schema.safeParse(input ?? { offset: 0 });

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Invalid weekly report input" : "周报参数错误",
    };
  }

  if (!canManageWorkspaceInsights(membership.role)) {
    return {
      ok: false,
      error: getInsightGovernanceDeniedMessage(english),
    };
  }

  const report = await generateWeeklyReport({
    workspaceId: workspace.id,
    userId: user.id,
    actorName: user.name,
    offset: parsed.data.offset,
    english,
  });

  revalidatePath("/reports");
  revalidatePath("/analytics");

  return {
    ok: true,
    reportId: report.id,
  };
}
