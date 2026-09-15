import { WorkspaceRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  caioOperatorErrorMessage,
  mapCaioOperatorError,
  type CaioOperatorErrorCode,
} from "@/lib/caio-operator/operator-error-codes";

export type CaioOperatorContext = Readonly<{
  workspaceId: string;
  actorUserId: string;
  actorName: string;
  english: boolean;
}>;

export type CaioOperatorResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: CaioOperatorErrorCode; message: string };

export type CaioOperationSummary = Readonly<Record<string, string | number | boolean | null>>;

const SUMMARY_FIELDS = [
  "id", "mandateId", "stopId", "assetId", "programId", "sourceId", "receiptId", "assessmentId",
  "status", "state", "version", "outcome", "replayed",
] as const;
// Service results wrap their records one level deep; only these wrappers are expanded.
const SUMMARY_WRAPPERS = ["mandate", "stop", "receipt", "assessment", "entry", "program", "source"] as const;

type Scalar = string | number | boolean | null;

function pickScalars(record: Record<string, unknown>, prefix: string, into: Record<string, Scalar>): void {
  for (const field of SUMMARY_FIELDS) {
    const value = record[field];
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      into[`${prefix}${field}`] = value;
    }
  }
}

/** Only whitelisted scalar identity/state fields leave the server; full rows, reasons and payloads never do. */
export function summarizeOperationResult(result: unknown): CaioOperationSummary {
  if (result === null || typeof result !== "object") return {};
  const record = result as Record<string, unknown>;
  const summary: Record<string, Scalar> = {};
  pickScalars(record, "", summary);
  for (const wrapper of SUMMARY_WRAPPERS) {
    const nested = record[wrapper];
    if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
      pickScalars(nested as Record<string, unknown>, `${wrapper}.`, summary);
    }
  }
  return summary;
}

/**
 * owner: registration-style operations; the caller must be the workspace OWNER.
 * principal_bound: CEO/guardian acts (mandate transitions, guardian stop, CEO resume, G0 acceptance).
 * The CEO and a designated guardian need not hold WorkspaceRole.OWNER, so no role pre-check is done;
 * the service authorizes by policy-service access plus the registered principal binding.
 */
export type CaioOperatorAccess = "owner" | "principal_bound";

export async function runOwnerOperation<S extends z.ZodTypeAny>(args: {
  access: CaioOperatorAccess;
  schema: S;
  rawInput: unknown;
  invoke: (ctx: CaioOperatorContext, input: z.infer<S>) => Promise<unknown>;
  revalidate?: readonly string[];
}): Promise<CaioOperatorResult<CaioOperationSummary>> {
  const { user, membership, workspace } = await getCurrentWorkspaceSession();
  const english = workspace.defaultLocale === "en-US";
  const fail = (code: CaioOperatorErrorCode): CaioOperatorResult<CaioOperationSummary> => ({
    ok: false,
    code,
    message: caioOperatorErrorMessage(code, english),
  });
  // Pre-check only: services re-verify access inside their own transaction.
  if (args.access === "owner" && membership.role !== WorkspaceRole.OWNER) return fail("not_owner");
  const parsed = args.schema.safeParse(args.rawInput);
  if (!parsed.success) return fail("input_invalid");
  let result: unknown;
  try {
    result = await args.invoke(
      { workspaceId: workspace.id, actorUserId: user.id, actorName: user.name, english },
      parsed.data,
    );
  } catch (error) {
    return fail(mapCaioOperatorError(error));
  }
  for (const path of args.revalidate ?? ["/caio", "/caio/operator"]) revalidatePath(path);
  return { ok: true, value: summarizeOperationResult(result) };
}
