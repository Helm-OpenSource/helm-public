import { WorkspaceRole } from "@prisma/client";
import type { z } from "zod";

import {
  caioOperatorErrorMessage,
  mapCaioOperatorError,
  type CaioOperatorErrorCode,
} from "./operator-error-codes";

/**
 * Shared core for the CAIO operator entry points: access pre-check → schema → service → closed code →
 * whitelisted summary. The web server actions and the controlled governance CLI both run through it,
 * so this module must never import lib/caio-governance (authority firewall); governance callers pass
 * their own error mapper.
 */

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

/**
 * owner: registration-style operations; the caller must be the workspace OWNER.
 * principal_bound: CEO/guardian acts (mandate transitions, guardian stop, CEO resume, G0 acceptance).
 * The CEO and a designated guardian need not hold WorkspaceRole.OWNER, so no role pre-check is done;
 * the service authorizes by policy-service access plus the registered principal binding.
 */
export type CaioOperatorAccess = "owner" | "principal_bound";

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

export async function executeCaioOperation<S extends z.ZodTypeAny>(args: {
  access: CaioOperatorAccess;
  /** null when the actor has no membership in the workspace. */
  membershipRole: WorkspaceRole | null;
  context: CaioOperatorContext;
  schema: S;
  rawInput: unknown;
  invoke: (ctx: CaioOperatorContext, input: z.infer<S>) => Promise<unknown>;
  mapError?: (error: unknown) => CaioOperatorErrorCode;
  /** Validate access and input only; the service is not called and nothing is written. */
  validateOnly?: boolean;
}): Promise<CaioOperatorResult<CaioOperationSummary>> {
  const fail = (code: CaioOperatorErrorCode): CaioOperatorResult<CaioOperationSummary> => ({
    ok: false,
    code,
    message: caioOperatorErrorMessage(code, args.context.english),
  });
  // Pre-check only: services re-verify access inside their own transaction.
  if (args.access === "owner" && args.membershipRole !== WorkspaceRole.OWNER) return fail("not_owner");
  const parsed = args.schema.safeParse(args.rawInput);
  if (!parsed.success) return fail("input_invalid");
  if (args.validateOnly) return { ok: true, value: { validated: true } };
  try {
    return { ok: true, value: summarizeOperationResult(await args.invoke(args.context, parsed.data)) };
  } catch (error) {
    return fail((args.mapError ?? mapCaioOperatorError)(error));
  }
}
