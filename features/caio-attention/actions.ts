"use server";

import { revalidatePath } from "next/cache";

import { parseCaioAttentionCommandForm, type CaioAttentionActionState } from "./command-form";
import { getCaioAttentionPageContext } from "./page-context";
import { getCaioAttentionPageService } from "./service";

/**
 * Single entry for every attention form. The form only proves its shape here; the service re-checks the
 * actor, the intake gate and the CAS in its transaction, and repeats of the same clientRequestId are idempotent.
 */
export async function runCaioAttentionCommandAction(_previous: CaioAttentionActionState, formData: FormData): Promise<CaioAttentionActionState> {
  const fields: Record<string, string[]> = {};
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") (fields[name] ??= []).push(value);
  }
  const parsed = parseCaioAttentionCommandForm(fields);
  if (!parsed.ok) return { status: "error", reason: "validation_failed" };
  const { viewer } = await getCaioAttentionPageContext();
  const result = await getCaioAttentionPageService().runCommand({ ...parsed.input, viewer });
  if (!result.ok) return { status: "error", reason: result.reason };
  revalidatePath("/caio/attention");
  revalidatePath("/caio/attention/mine");
  revalidatePath(`/caio/attention/${encodeURIComponent(parsed.input.caseId)}`);
  return { status: "ok" };
}
