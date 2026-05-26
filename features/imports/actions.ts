"use server";

import { ActorType, UsageType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  canManageWorkspaceImports,
  getImportManagementDeniedMessage,
} from "@/lib/auth/import-governance";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { resolveUiLocale, supportedUiLocales } from "@/lib/i18n/config";
import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import { previewCsvImport, runCsvImport, type ImportType } from "@/lib/imports";

const previewSchema = z.object({
  type: z.enum(["contacts", "opportunities", "meetings"]),
  csvText: z.string().min(1),
  mapping: z.record(z.string(), z.string()).optional(),
  locale: z.enum(supportedUiLocales).optional(),
});

const importSchema = z.object({
  type: z.enum(["contacts", "opportunities", "meetings"]),
  csvText: z.string().min(1),
  mapping: z.record(z.string(), z.string()),
});

export async function previewCsvImportAction(input: z.infer<typeof previewSchema>) {
  const english = resolveUiLocale(input.locale) === "en-US";
  const parsed = previewSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please upload a CSV file before previewing" : "请先上传 CSV 文件",
    };
  }

  const preview = previewCsvImport({
    type: parsed.data.type as ImportType,
    csvText: parsed.data.csvText,
    mapping: parsed.data.mapping,
  });

  return {
    ok: true,
    preview,
  };
}

export async function runCsvImportAction(input: z.infer<typeof importSchema>) {
  const session = await getCurrentWorkspaceSession();
  const user = session.user;
  const workspace = session.workspace;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceImports(session.membership.role)) {
    return {
      ok: false,
      error: getImportManagementDeniedMessage(english),
    };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "CSV_IMPORT_RUN",
  });
  const parsed = importSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: english ? "Please upload a CSV file before importing" : "请先上传 CSV 文件",
    };
  }

  const result = await runCsvImport({
    type: parsed.data.type as ImportType,
    csvText: parsed.data.csvText,
    mapping: parsed.data.mapping,
    workspaceId: workspace.id,
    userId: user.id,
    actorName: user.name,
    actorType: ActorType.USER,
    english,
  });

  revalidatePath("/imports");
  revalidatePath("/opportunities");
  revalidatePath("/memory");
  revalidatePath("/dashboard");
  revalidatePath("/search");
  await recordUsageLedgerEntry({
    workspaceId: workspace.id,
    userId: user.id,
    usageType: UsageType.CRM_IMPORT,
    sourcePage: "/imports",
    metadata: {
      importType: parsed.data.type,
      channel: "csv",
    },
  });

  return {
    ok: true,
    result,
  };
}
