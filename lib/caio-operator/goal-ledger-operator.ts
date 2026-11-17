import "server-only";

import { readFileSync, statSync } from "node:fs";

import { MembershipStatus } from "@prisma/client";
import { z } from "zod";

import {
  CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY,
  CAIO_GOAL_LEDGER_DOCUMENT_SCHEMA_VERSION,
  CAIO_GOAL_LEDGER_GENESIS_PREV_HASH,
  CAIO_GOAL_LEDGER_SHA256_PATTERN,
} from "@/lib/caio-goal-ledger/contracts";
import { createPrismaCaioGoalLedgerStore } from "@/lib/caio-goal-ledger/prisma-store";
import { readCaioGoalLedger } from "@/lib/caio-goal-ledger/read.service";
import type { CaioGoalLedgerStore } from "@/lib/caio-goal-ledger/store-port";
import {
  appendCaioGoalLedgerEntry,
  CaioGoalLedgerWriteRefusal,
  type CaioGoalLedgerWriteRefusalReason,
  importCaioGoalLedgerChain,
} from "@/lib/caio-goal-ledger/write.service";
import { db } from "@/lib/db";

import { executeCaioOperation, type CaioOperationSummary, type CaioOperatorContext } from "./operation-core";
import { mapCaioOperatorError, type CaioOperatorErrorCode } from "./operator-error-codes";

/**
 * Controlled CLI entry for the CAIO goal ledger: append one entry, or import a chain that extends the stored one.
 * Without apply only access and input are validated and nothing is written. The actor is named by whoever runs
 * the command (--actor-user-id): it is declared, not authenticated. The pre-check reads Membership only and the
 * write service re-checks ACTIVE OWNER inside its transaction, so the command needs no User or Workspace access;
 * the copy language is the --english switch. A refusal carries one closed reason and the entry it points at, never
 * the owner's words or the document.
 *
 * Nothing but scripts/caio-goal-ledger.ts and its test may import this file (check:caio-goal-ledger).
 */

export const CAIO_GOAL_LEDGER_IMPORT_FORMAT = "caio-goal-ledger-import/v1";
export const CAIO_GOAL_LEDGER_IMPORT_MAX_ENTRIES = 10_000;
// The file is read and parsed whole. 64 MiB (MySQL's default max_allowed_packet) is far above a realistic bundle and
// well below the sizes at which reading would fail for a less precise reason; a larger file is refused unread.
export const CAIO_GOAL_LEDGER_INPUT_FILE_MAX_BYTES = 64 * 1024 * 1024;

const hash = z.string().regex(CAIO_GOAL_LEDGER_SHA256_PATTERN);

// Structure only: the write service checks the entry fields, the document and the chain, and names what it refused.
export const appendEntrySchema = z.object({
  ownerQuote: z.string(),
  change: z.string(),
  effectiveAt: z.string(),
  expectedHeadHash: hash,
  document: z.record(z.string(), z.unknown()),
}).strict();

export const importChainSchema = z.object({
  format: z.literal(CAIO_GOAL_LEDGER_IMPORT_FORMAT),
  documentFileKey: z.string(),
  entries: z.array(z.unknown()).min(1).max(CAIO_GOAL_LEDGER_IMPORT_MAX_ENTRIES),
  documents: z.record(z.string(), z.string()),
}).strict();

type GoalLedgerOperation = Readonly<{
  schema: z.ZodTypeAny;
  invoke: (store: CaioGoalLedgerStore, ctx: CaioOperatorContext, input: never) => Promise<unknown>;
  /** Schema-valid example; replace the placeholders before --apply. */
  template: Readonly<Record<string, unknown>>;
}>;

function operation<S extends z.ZodTypeAny>(definition: {
  schema: S;
  invoke: (store: CaioGoalLedgerStore, ctx: CaioOperatorContext, input: z.infer<S>) => Promise<unknown>;
  template: Readonly<Record<string, unknown>>;
}): GoalLedgerOperation {
  return definition as GoalLedgerOperation;
}

const identity = (ctx: CaioOperatorContext) => ({ workspaceId: ctx.workspaceId, actorUserId: ctx.actorUserId });

export const CAIO_GOAL_LEDGER_OPERATIONS = {
  appendEntry: operation({
    schema: appendEntrySchema,
    invoke: (store, ctx, input) => appendCaioGoalLedgerEntry(store, { ...input, ...identity(ctx) }),
    template: {
      ownerQuote: "Replace with the owner's words, verbatim.",
      change: "Replace with what this entry changes.",
      effectiveAt: "2026-01-01T00:00:00+08:00",
      expectedHeadHash: CAIO_GOAL_LEDGER_GENESIS_PREV_HASH,
      document: {
        schema: CAIO_GOAL_LEDGER_DOCUMENT_SCHEMA_VERSION,
        goals: [{ key: "goal.replace-me", kind: "northstar", title: "Replace with the goal", standard: "Replace with the standard, in words",
          metrics: [], threshold: null, componentKeys: [] }],
        components: [],
        gates: [],
        roleBindingPin: null,
      },
    },
  }),
  importChain: operation({
    schema: importChainSchema,
    invoke: (store, ctx, { format: _format, ...bundle }) => importCaioGoalLedgerChain(store, { ...bundle, ...identity(ctx) }),
    template: {
      format: CAIO_GOAL_LEDGER_IMPORT_FORMAT,
      documentFileKey: CAIO_GOAL_LEDGER_DOCUMENT_FILE_KEY,
      entries: [{ replace: "with each line of the chain file, parsed, in order" }],
      documents: { "sha256-of-a-document": "the document text, byte for byte" },
    },
  }),
} as const satisfies Record<string, GoalLedgerOperation>;

export type CaioGoalLedgerOperationKey = keyof typeof CAIO_GOAL_LEDGER_OPERATIONS;

export function isCaioGoalLedgerOperationKey(value: string): value is CaioGoalLedgerOperationKey {
  return Object.prototype.hasOwnProperty.call(CAIO_GOAL_LEDGER_OPERATIONS, value);
}

export function mapCaioGoalLedgerOperatorError(error: unknown): CaioOperatorErrorCode {
  if (!(error instanceof CaioGoalLedgerWriteRefusal)) return mapCaioOperatorError(error);
  if (error.reason === "not_owner") return "not_owner";
  return error.reason === "head_conflict" ? "goal_ledger_conflict" : "goal_ledger_rejected";
}

export type CaioGoalLedgerOperatorResult =
  | { ok: true; value: CaioOperationSummary }
  | { ok: false; code: CaioOperatorErrorCode; message: string; reason?: CaioGoalLedgerWriteRefusalReason; atSeq?: number };

/** Runs one ledger operation for the named actor; `store` is the Prisma store over the command's connection. */
export async function runCaioGoalLedgerOperation(
  args: {
    operation: CaioGoalLedgerOperationKey;
    workspaceId: string;
    actorUserId: string;
    rawInput: unknown;
    apply: boolean;
    english: boolean;
  },
  store: CaioGoalLedgerStore = createPrismaCaioGoalLedgerStore(db),
): Promise<CaioGoalLedgerOperatorResult> {
  const definition: GoalLedgerOperation = CAIO_GOAL_LEDGER_OPERATIONS[args.operation];
  const membership = await db.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: args.workspaceId, userId: args.actorUserId } },
    select: { role: true, status: true },
  });
  const refusals: CaioGoalLedgerWriteRefusal[] = [];
  const result = await executeCaioOperation({
    access: "owner",
    membershipRole: membership?.status === MembershipStatus.ACTIVE ? membership.role : null,
    context: { workspaceId: args.workspaceId, actorUserId: args.actorUserId, actorName: "", english: args.english },
    schema: definition.schema,
    rawInput: args.rawInput,
    invoke: (ctx, input) => definition.invoke(store, ctx, input as never),
    mapError: (error) => {
      if (error instanceof CaioGoalLedgerWriteRefusal) refusals.push(error);
      return mapCaioGoalLedgerOperatorError(error);
    },
    validateOnly: !args.apply,
  });
  const [refusal] = refusals;
  if (result.ok || refusal === undefined) return result;
  return { ...result, reason: refusal.reason, ...(refusal.atSeq === null ? {} : { atSeq: refusal.atSeq }) };
}

/**
 * The ledger as readCaioGoalLedger sees it, with the schema readiness: the head's seq and digests when ok, the
 * alarm when rejected, never the document. Exit code 3 when the ledger is rejected or unavailable.
 */
export async function verifyCaioGoalLedger(workspaceId: string, store: CaioGoalLedgerStore = createPrismaCaioGoalLedgerStore(db)) {
  const [read, readiness] = await Promise.all([readCaioGoalLedger(store, { workspaceId }), store.probeSchemaReadiness()]);
  const view = read.state === "ok" ? { state: read.state, head: read.head } : read;
  return { exitCode: read.state === "ok" || read.state === "empty" ? 0 : 3, output: { ...view, readiness } };
}

export const CAIO_GOAL_LEDGER_INPUT_FILE_REFUSALS = [
  "input_file_unreadable", "input_file_too_large", "input_file_not_utf8", "input_file_not_json",
] as const;

/** The input file as JSON, read as strict UTF-8 (a byte order mark is dropped); its size is checked first. */
export function readCaioGoalLedgerInputFile(file: string):
  | { ok: true; rawInput: unknown }
  | { ok: false; reason: (typeof CAIO_GOAL_LEDGER_INPUT_FILE_REFUSALS)[number] } {
  let bytes: Buffer;
  try {
    if (statSync(file).size > CAIO_GOAL_LEDGER_INPUT_FILE_MAX_BYTES) return { ok: false, reason: "input_file_too_large" };
    bytes = readFileSync(file);
  } catch {
    return { ok: false, reason: "input_file_unreadable" };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: "input_file_not_utf8" };
  }
  try {
    return { ok: true, rawInput: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "input_file_not_json" };
  }
}

export type CaioGoalLedgerCliArgs =
  | { mode: "template"; operation: CaioGoalLedgerOperationKey }
  | {
    mode: "run";
    operation: CaioGoalLedgerOperationKey;
    workspaceId: string;
    actorUserId: string;
    inputFile: string;
    apply: boolean;
    english: boolean;
  }
  | { mode: "verify"; workspaceId: string }
  | { mode: "invalid"; reason: string };

const FLAGS = ["--apply", "--english", "--verify"] as const;

export function parseCaioGoalLedgerCliArgs(argv: readonly string[]): CaioGoalLedgerCliArgs {
  const get = (name: string) => {
    const hits = argv.filter((arg) => arg.startsWith(`--${name}=`));
    return hits.length === 1 ? hits[0].slice(name.length + 3).trim() : hits.length === 0 ? undefined : null;
  };
  const known = new Set(["operation", "template", "workspace-id", "actor-user-id", "input-file"]);
  for (const arg of argv) {
    if ((FLAGS as readonly string[]).includes(arg)) continue;
    const name = /^--([a-z-]+)=/u.exec(arg)?.[1];
    if (!name || !known.has(name)) return { mode: "invalid", reason: "unknown_argument" };
  }
  if (FLAGS.some((flag) => argv.filter((arg) => arg === flag).length > 1)) return { mode: "invalid", reason: "duplicate_argument" };

  const template = get("template");
  if (template !== undefined) {
    if (template === null || argv.length !== 1) return { mode: "invalid", reason: "template_takes_no_other_arguments" };
    if (!isCaioGoalLedgerOperationKey(template)) return { mode: "invalid", reason: "unknown_operation" };
    return { mode: "template", operation: template };
  }

  const workspaceId = get("workspace-id");
  if (argv.includes("--verify")) {
    if (!workspaceId || argv.length !== 2) return { mode: "invalid", reason: "verify_takes_only_workspace_id" };
    return { mode: "verify", workspaceId };
  }

  const operationKey = get("operation");
  const actorUserId = get("actor-user-id");
  const inputFile = get("input-file");
  if ([operationKey, workspaceId, actorUserId, inputFile].some((value) => value === null)) {
    return { mode: "invalid", reason: "duplicate_argument" };
  }
  if (!operationKey || !workspaceId || !actorUserId || !inputFile) return { mode: "invalid", reason: "missing_argument" };
  if (!isCaioGoalLedgerOperationKey(operationKey)) return { mode: "invalid", reason: "unknown_operation" };
  return {
    mode: "run", operation: operationKey, workspaceId, actorUserId, inputFile,
    apply: argv.includes("--apply"), english: argv.includes("--english"),
  };
}
