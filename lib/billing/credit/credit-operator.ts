import "server-only";
import { createHash } from "node:crypto";
import { Prisma, type CreditFacility, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { fenFromDecimalString } from "../funds/money";
import { resolvePayerForWorkspaceInTransaction } from "../payer/payer-accounts";
import { changeCreditFacility, changeCreditFacilityInTransaction, CreditFacilityRefusal, proposeCreditFacility,
  type CreditFacilityAction } from "./credit-facilities";

/**
 * Operator CLI for credit facilities (授信) and their batch issuance; no HTTP route. Reads by default, writes only with --apply,
 * always through the S3-e service (maker -> different checker, CAS, audit in the same transaction). Raising a line is not a
 * lifecycle step: a new facility is proposed and approved, then `activate --supersedes-*` revokes the old one and activates the
 * new one in one transaction, refused while the old one carries usage. Nothing here creates a payer account.
 */
export const DEFAULT_MAX_LIMIT_FEN = BigInt(100_000_000); // 1,000,000 CNY per payer unless --max-limit-fen says otherwise
const ZERO = BigInt(0);
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
const BATCH_REF = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const STEPS = ["propose", "approve", "activate"] as const;
type Step = (typeof STEPS)[number];
const COMMANDS: Record<string, string[]> = {
  show: ["workspace-id", "payer-account-id"],
  propose: ["actor-user-id", "workspace-id", "payer-account-id", "limit-fen", "operation-key", "evidence-ref", "valid-until",
    "max-limit-fen"],
  approve: [], expire: [], revoke: [], reduce: ["limit-fen"], activate: ["supersedes-facility-id", "supersedes-version"],
  batch: ["list-file", "step", "actor-user-id", "expect-list-sha", "max-limit-fen", "maker-user-id", "checker-user-id"],
};
const CHANGE_FLAGS = ["actor-user-id", "facility-id", "expected-version", "evidence-ref"];

export class CreditOperatorError extends Error {
  constructor(readonly code: string, readonly exitCode = 1) { super(code); this.name = "CreditOperatorError"; }
}
const usage = (reason: string): never => { throw new CreditOperatorError(`usage:${reason}`, 2); };
const fail = (code: string): never => { throw new CreditOperatorError(code); };

type Args = { command: string; apply: boolean; flags: Map<string, string> };
export function parseCreditOperatorArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (!command || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) usage("command");
  const allowed = new Set([...COMMANDS[command], ...(command === "show" || command === "propose" || command === "batch" ? [] : CHANGE_FLAGS)]);
  const flags = new Map<string, string>();
  let apply = false;
  for (const arg of rest) {
    if (arg === "--apply") { apply = true; continue; }
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !allowed.has(match[1]) || flags.has(match[1])) usage(`flag:${arg.split("=")[0]}`);
    flags.set(match![1], match![2]);
  }
  return { command, apply, flags };
}
const flag = (args: Args, name: string) => args.flags.get(name) ?? usage(`missing:${name}`);
const refFlag = (args: Args, name: string) => { const value = flag(args, name); return REF.test(value) ? value : usage(name); };
function fenFlag(value: string, name: string) {
  try { return fenFromDecimalString(value); } catch { return usage(name); }
}
const intFlag = (args: Args, name: string) => /^[1-9][0-9]{0,8}$/.test(flag(args, name)) ? Number(flag(args, name)) : usage(name);
function maxLimit(args: Args) {
  const value = args.flags.get("max-limit-fen");
  return value === undefined ? DEFAULT_MAX_LIMIT_FEN : fenFlag(value, "max-limit-fen");
}
function instant(value: string | null | undefined, name: string) {
  if (value == null) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.toISOString() !== value ? usage(name) : date;
}

const summary = (row: CreditFacility | null) => row && { id: row.id, state: row.state, limitFen: row.limitFen, usedFen: row.usedFen,
  approvedLimitFen: row.approvedLimitFen, version: row.version, operationKey: row.operationKey,
  validUntil: row.validUntil, activatedAt: row.activatedAt, closedAt: row.closedAt };

function transaction<T>(client: PrismaClient, body: (tx: Prisma.TransactionClient) => Promise<T>) {
  return client.$transaction(body, { maxWait: 5000, timeout: 10000 }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      throw new CreditFacilityRefusal("credit_write_conflict");
    }
    throw error;
  });
}

type ActivateInput = { actorUserId: string; facilityId: string; expectedVersion: number; evidenceRef: string;
  supersedes: { facilityId: string; expectedVersion: number } | null };
/**
 * Activates an approved facility; with `supersedes`, first revokes the payer's current active/reduced facility in the same
 * transaction, so the payer is never left without a line and never has two. Refused (whole transaction) if the superseded
 * facility carries usedFen: that receivable stays on it and would add to the new line (owner decision, see the runbook).
 */
export function activateCreditFacility(client: PrismaClient, input: ActivateInput) {
  return transaction(client, async tx => {
    let superseded: CreditFacility | null = null;
    if (input.supersedes) {
      const read = (id: string) => tx.creditFacility.findUnique({ where: { id }, select: { payerAccountId: true, state: true } });
      const prior = await read(input.supersedes.facilityId), next = await read(input.facilityId);
      // Plain read; the version CAS in the revoke below refuses if this row moved since the operator read it.
      if (!prior || !next || prior.payerAccountId !== next.payerAccountId || (prior.state !== "active" && prior.state !== "reduced")) {
        fail("credit_supersede_invalid");
      }
      superseded = await changeCreditFacilityInTransaction(tx, { actorUserId: input.actorUserId, action: "revoke",
        facilityId: input.supersedes.facilityId, expectedVersion: input.supersedes.expectedVersion, evidenceRef: input.evidenceRef });
      // The revoke holds the PayerAccount lock, so no draw can add usage before this commits.
      if (superseded.usedFen > ZERO) fail("credit_supersede_in_use");
    }
    const activated = await changeCreditFacilityInTransaction(tx, { actorUserId: input.actorUserId, action: "activate",
      facilityId: input.facilityId, expectedVersion: input.expectedVersion, evidenceRef: input.evidenceRef });
    return { activated: summary(activated), superseded: summary(superseded) };
  });
}

async function payerOf(client: PrismaClient, args: Args) {
  const payer = args.flags.get("payer-account-id"), workspace = args.flags.get("workspace-id");
  if ((payer === undefined) === (workspace === undefined)) usage("payer-account-id|workspace-id");
  if (payer !== undefined) return REF.test(payer) ? payer : usage("payer-account-id");
  if (!REF.test(workspace!)) usage("workspace-id");
  return (await transaction(client, tx => resolvePayerForWorkspaceInTransaction(tx, workspace!))).payerAccountId;
}
async function show(client: PrismaClient, payerAccountId: string) {
  const facilities = await client.creditFacility.findMany({ where: { payerAccountId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return { payerAccountId, facilities: facilities.map(summary) };
}

// ---- batch ----
const listSchema = z.object({
  v: z.literal(1), batchRef: z.string().regex(BATCH_REF), evidenceRef: z.string().regex(REF),
  validUntil: z.string().nullable(),
  entries: z.array(z.object({ workspaceId: z.string().regex(REF), limitFen: z.string() }).strict()).min(1).max(500),
}).strict();
export type CreditBatchList = { listSha: string; batchRef: string; operationKey: string; evidenceRef: string; validUntil: Date | null;
  entries: Array<{ workspaceId: string; limitFen: bigint }> };

/** Parses the operator-supplied list; the sha256 of its exact bytes binds an --apply run to the dry run the owner confirmed. */
export function parseCreditBatchList(bytes: Buffer): CreditBatchList {
  let raw: unknown;
  try { raw = JSON.parse(bytes.toString("utf8")); } catch { return usage("list_not_json"); }
  const parsed = listSchema.safeParse(raw);
  if (!parsed.success) usage("list_invalid");
  const list = parsed.data!;
  const entries = list.entries.map(entry => {
    const limitFen = fenFlag(entry.limitFen, "list_limit_fen");
    return { workspaceId: entry.workspaceId, limitFen: limitFen > ZERO ? limitFen : usage("list_limit_fen") };
  });
  if (new Set(entries.map(entry => entry.workspaceId)).size !== entries.length) usage("list_duplicate_workspace");
  return { listSha: createHash("sha256").update(bytes).digest("hex"), batchRef: list.batchRef,
    operationKey: `credit-batch:${list.batchRef}`, evidenceRef: list.evidenceRef,
    validUntil: instant(list.validUntil, "list_valid_until"), entries };
}

type PlanAction = "done" | "propose" | "approve" | "activate" | "reduce" | "blocked";
type PlanRow = { workspaceId: string; payerAccountId: string | null; targetLimitFen: bigint; action: PlanAction; blocker?: string;
  current: CreditFacility | null; batchFacility: CreditFacility | null };
const STEP_OF: Partial<Record<PlanAction, Step>> = { propose: "propose", approve: "approve", activate: "activate", reduce: "activate" };

/** Current state -> target for one entry, read-only. "Done" means the payer's drawable line already equals the target. */
async function planEntry(client: PrismaClient, list: CreditBatchList, entry: CreditBatchList["entries"][number], cap: bigint,
  seenPayers: Set<string>): Promise<PlanRow> {
  const row: PlanRow = { workspaceId: entry.workspaceId, payerAccountId: null, targetLimitFen: entry.limitFen, action: "blocked",
    current: null, batchFacility: null };
  const blocked = (blocker: string) => Object.assign(row, { action: "blocked" as const, blocker });
  if (entry.limitFen > cap) return blocked("limit_over_cap");
  try {
    row.payerAccountId = (await transaction(client, tx => resolvePayerForWorkspaceInTransaction(tx, entry.workspaceId))).payerAccountId;
  } catch (error) {
    // Payer accounts are created by their own operator command; this tool never creates one.
    return blocked(error instanceof Error && error.message === "payer_account_unavailable" ? "payer_unavailable" : "payer_missing");
  }
  const payerAccountId = row.payerAccountId;
  if (seenPayers.has(payerAccountId)) return blocked("payer_listed_twice");
  seenPayers.add(payerAccountId);
  const [current, mine] = await Promise.all([client.creditFacility.findUnique({ where: { activePayerAccountId: payerAccountId } }),
    client.creditFacility.findUnique({ where: { payerAccountId_operationKey: { payerAccountId, operationKey: list.operationKey } } })]);
  Object.assign(row, { current, batchFacility: mine });
  const target = entry.limitFen;
  if (current && current.limitFen === target) return Object.assign(row, { action: "done" as const });
  if (current && target < current.limitFen) return target < current.usedFen ? blocked("target_below_used") : Object.assign(row, { action: "reduce" as const });
  // A higher line needs a new facility; usage on the old one would stay owed on top of the new line.
  if (current && current.usedFen > ZERO) return blocked("current_in_use");
  if (!mine) return Object.assign(row, { action: "propose" as const });
  if (mine.limitFen !== target || mine.evidenceRef !== list.evidenceRef ||
      (mine.validUntil?.getTime() ?? null) !== (list.validUntil?.getTime() ?? null)) return blocked("batch_key_conflict");
  if (mine.state === "draft") return Object.assign(row, { action: "approve" as const });
  if (mine.state === "approved") return Object.assign(row, { action: "activate" as const });
  return blocked("batch_facility_closed");
}

async function executeEntry(client: PrismaClient, list: CreditBatchList, row: PlanRow, actorUserId: string) {
  const payerAccountId = row.payerAccountId!, evidenceRef = list.evidenceRef;
  if (row.action === "propose") {
    const { facility, replayed } = await proposeCreditFacility(client, { actorUserId, payerAccountId, limitFen: row.targetLimitFen,
      validUntil: list.validUntil, operationKey: list.operationKey, evidenceRef });
    return { facility: summary(facility), replayed };
  }
  if (row.action === "approve") {
    return { facility: summary(await changeCreditFacility(client, { actorUserId, action: "approve", facilityId: row.batchFacility!.id,
      expectedVersion: row.batchFacility!.version, evidenceRef })) };
  }
  if (row.action === "reduce") {
    return { facility: summary(await changeCreditFacility(client, { actorUserId, action: "reduce", facilityId: row.current!.id,
      expectedVersion: row.current!.version, evidenceRef, limitFen: row.targetLimitFen })) };
  }
  return activateCreditFacility(client, { actorUserId, facilityId: row.batchFacility!.id, expectedVersion: row.batchFacility!.version,
    evidenceRef, supersedes: row.current ? { facilityId: row.current.id, expectedVersion: row.current.version } : null });
}

const refusalCode = (error: unknown) => error instanceof CreditFacilityRefusal || error instanceof CreditOperatorError ? error.code
  : error instanceof Error && /^payer_/.test(error.message) ? error.message : "unexpected_error";

async function grantHeld(client: PrismaClient, userId: string | undefined, role: "maker" | "checker") {
  if (userId === undefined) return null;
  return (await client.platformFinanceGrant.count({ where: { activeUserId: userId, role, state: "active" } })) === 1;
}

async function batch(client: PrismaClient, args: Args, readFile: (path: string) => Buffer) {
  let bytes: Buffer;
  try { bytes = readFile(flag(args, "list-file")); } catch (error) { if (error instanceof CreditOperatorError) throw error; return usage("list_unreadable"); }
  const list = parseCreditBatchList(bytes);
  const cap = maxLimit(args);
  let step: Step | null = null, actorUserId = "";
  if (args.apply) {
    step = STEPS.find(value => value === args.flags.get("step")) ?? usage("step");
    actorUserId = refFlag(args, "actor-user-id");
    if (flag(args, "expect-list-sha") !== list.listSha) fail("list_sha_mismatch"); // nothing written
  }
  const maker = args.flags.get("maker-user-id"), checker = args.flags.get("checker-user-id");
  const preflight = { maker: await grantHeld(client, maker, "maker"), checker: await grantHeld(client, checker, "checker"),
    distinct: maker === undefined || checker === undefined ? null : maker !== checker };
  const seenPayers = new Set<string>();
  const rows: Array<Record<string, unknown> & { action: PlanAction; status: string }> = [];
  // One entry at a time, each write in its own transaction: a refusal is recorded and the next entry still runs.
  for (const entry of list.entries) {
    const row = await planEntry(client, list, entry, cap, seenPayers);
    let result: { status: "planned" | "skipped" | "applied" | "failed"; code?: string; detail?: unknown } = { status: "planned" };
    if (step && row.action !== "blocked" && row.action !== "done") {
      if (STEP_OF[row.action] !== step) result = { status: "skipped" };
      else {
        try { result = { status: "applied", detail: await executeEntry(client, list, row, actorUserId) }; }
        catch (error) { result = { status: "failed", code: refusalCode(error) }; }
      }
    }
    rows.push({ workspaceId: row.workspaceId, payerAccountId: row.payerAccountId, action: row.action, blocker: row.blocker,
      targetLimitFen: row.targetLimitFen, current: summary(row.current), batchFacility: summary(row.batchFacility), ...result });
  }
  const count = (key: "action" | "status") => rows.reduce<Record<string, number>>((acc, row) =>
    ({ ...acc, [row[key]]: (acc[row[key]] ?? 0) + 1 }), {});
  const problems = rows.filter(row => row.status === "failed" || row.action === "blocked").length;
  return { exitCode: args.apply && problems > 0 ? 1 : 0, output: { ok: !args.apply || problems === 0, command: "batch", applied: args.apply,
    step, listSha: list.listSha, batchRef: list.batchRef, operationKey: list.operationKey, maxLimitFen: cap, preflight,
    actions: count("action"), results: count("status"), rows } };
}

/** Runs one CLI invocation; never prints evidence beyond references and amounts (integer fen as strings). */
export async function runCreditOperator(client: PrismaClient, argv: string[], readFile: (path: string) => Buffer) {
  try {
    const args = parseCreditOperatorArgs(argv);
    if (args.command === "batch") return await batch(client, args, readFile);
    if (args.command === "show") return { exitCode: 0, output: { ok: true, command: "show", ...(await show(client, await payerOf(client, args))) } };
    const actorUserId = refFlag(args, "actor-user-id"), evidenceRef = refFlag(args, "evidence-ref");
    let plan: Record<string, unknown>;
    let write: () => Promise<unknown>;
    if (args.command === "propose") {
      const payerAccountId = await payerOf(client, args);
      const limitFen = fenFlag(flag(args, "limit-fen"), "limit-fen");
      if (limitFen > maxLimit(args)) fail("limit_over_cap");
      const input = { actorUserId, payerAccountId, limitFen, evidenceRef, operationKey: refFlag(args, "operation-key"),
        validUntil: instant(args.flags.get("valid-until"), "valid-until") };
      plan = input;
      write = async () => { const { facility, replayed } = await proposeCreditFacility(client, input); return { facility: summary(facility), replayed }; };
    } else {
      const base = { actorUserId, evidenceRef, facilityId: refFlag(args, "facility-id"), expectedVersion: intFlag(args, "expected-version") };
      if (args.command === "activate") {
        const id = args.flags.get("supersedes-facility-id");
        if ((id === undefined) !== (args.flags.get("supersedes-version") === undefined)) usage("supersedes-facility-id|supersedes-version");
        const input = { ...base, supersedes: id === undefined ? null
          : { facilityId: refFlag(args, "supersedes-facility-id"), expectedVersion: intFlag(args, "supersedes-version") } };
        plan = input;
        write = () => activateCreditFacility(client, input);
      } else {
        const input = { ...base, action: args.command as CreditFacilityAction,
          ...(args.command === "reduce" ? { limitFen: fenFlag(flag(args, "limit-fen"), "limit-fen") } : {}) };
        plan = input;
        write = async () => summary(await changeCreditFacility(client, input));
      }
    }
    if (!args.apply) {
      const facility = typeof plan.facilityId === "string" ? await client.creditFacility.findUnique({ where: { id: plan.facilityId } }) : null;
      return { exitCode: 0, output: { ok: true, command: args.command, applied: false, plan, facility: summary(facility) } };
    }
    return { exitCode: 0, output: { ok: true, command: args.command, applied: true, result: await write() } };
  } catch (error) {
    const code = refusalCode(error);
    if (code === "unexpected_error") throw error;
    return { exitCode: error instanceof CreditOperatorError ? error.exitCode : 1, output: { ok: false, code } };
  }
}

/** JSON with bigint fen as integer strings. */
export const toJson = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2);
