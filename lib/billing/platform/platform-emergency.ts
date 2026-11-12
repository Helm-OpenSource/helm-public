import "server-only";
import { ActorType, Prisma, type PlatformEmergencyRollback, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { findPlatformFinanceActorInTransaction, type PlatformFinanceRoleName } from "../bank-receipts/bank-receipts";

/**
 * Owner 11-12 emergency rollback: one platform finance person (maker or checker) switches a workspace payer enforce -> shadow at once,
 * leaving a `pending_review` record that a different platform finance checker must confirm within 24 hours. Only this direction: going
 * to off or to enforce stays maker + checker (platform-operations). Overdue records are reported (list, exit code), never auto-reverted.
 * Lock order: finance grant + reserved Membership (share) -> PayerAccount FOR UPDATE -> PayerScopeBinding (share) -> record.
 */
export type EmergencyRollbackRefusalCode = "emergency_input_invalid" | "emergency_forbidden" | "emergency_self_confirm_forbidden" |
  "emergency_unavailable" | "emergency_not_pending" | "emergency_conflict" | "emergency_write_conflict" | "billing_mode_conflict" |
  "payer_unresolved";
export class EmergencyRollbackRefusal extends Error {
  constructor(readonly code: EmergencyRollbackRefusalCode) { super(code); this.name = "EmergencyRollbackRefusal"; }
}

const SOURCE_PAGE = "/billing/platform-operations";
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
const REVIEW_WINDOW_MS = 24 * 3600 * 1000;
function refuse(code: EmergencyRollbackRefusalCode): never { throw new EmergencyRollbackRefusal(code); }
function reference(value: unknown, code: EmergencyRollbackRefusalCode = "emergency_input_invalid"): asserts value is string {
  if (typeof value !== "string" || !REF.test(value)) refuse(code);
}
function run<T>(client: PrismaClient, body: (tx: Prisma.TransactionClient) => Promise<T>) {
  return client.$transaction(body, { maxWait: 5000, timeout: 10000 }).catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) {
      refuse("emergency_write_conflict");
    }
    throw error;
  });
}
async function financeActor(tx: Prisma.TransactionClient, userId: string, roles: PlatformFinanceRoleName[]) {
  const workspaceId = await findPlatformFinanceActorInTransaction(tx, userId, roles);
  if (!workspaceId) refuse("emergency_forbidden");
  return workspaceId;
}
/** Plain read to learn the payer, then (after the payer lock) a share-locked re-read, as the money paths do. */
const binding = async (tx: Prisma.TransactionClient, workspaceId: string, lock: Prisma.Sql) => (await tx.$queryRaw<Array<{
  payerAccountId: string; billingMode: string }>>`SELECT b.payerAccountId, a.billingMode FROM PayerScopeBinding b
  JOIN PayerAccount a ON a.id = b.payerAccountId
  WHERE b.scopeKind = 'workspace' AND b.state = 'active' AND b.activeScopeRef = ${workspaceId} ${lock}`)[0] ?? null;
async function audit(tx: Prisma.TransactionClient, workspaceIds: string[], actorUserId: string, actionType: string, targetId: string,
  payload: Record<string, unknown>) {
  for (const workspaceId of new Set(workspaceIds)) {
    await writeAuditLog({ workspaceId, userId: actorUserId, actor: actorUserId, actorType: ActorType.USER, actionType,
      targetType: "PlatformEmergencyRollback", targetId, summary: actionType.toLowerCase().replaceAll("_", " "), sourcePage: SOURCE_PAGE,
      payload }, { client: tx });
  }
}

export type EmergencyRollbackInput = { actorUserId: string; workspaceId: string; evidenceRef: string };

/** Single person, effective immediately: CAS enforce -> shadow plus a pending_review record. The same person re-running replays. */
export async function executeEmergencyRollback(client: PrismaClient, input: EmergencyRollbackInput) {
  reference(input?.actorUserId, "emergency_forbidden"); reference(input.workspaceId); reference(input.evidenceRef);
  return run(client, async tx => {
    const reservedWorkspaceId = await financeActor(tx, input.actorUserId, ["maker", "checker"]);
    const head = await binding(tx, input.workspaceId, Prisma.empty);
    if (!head) refuse("payer_unresolved");
    await tx.$queryRaw`SELECT id FROM PayerAccount WHERE id = ${head.payerAccountId} FOR UPDATE`;
    const bound = await binding(tx, input.workspaceId, Prisma.sql`FOR SHARE OF b`);
    if (!bound || bound.payerAccountId !== head.payerAccountId) refuse("payer_unresolved");
    const [existing] = await tx.$queryRaw<PlatformEmergencyRollback[]>`SELECT * FROM PlatformEmergencyRollback
      WHERE evidenceRef = ${input.evidenceRef} AND workspaceId = ${input.workspaceId} FOR UPDATE`;
    if (existing) {
      if (existing.executedByUserId !== input.actorUserId || bound.billingMode !== "shadow") refuse("emergency_conflict");
      return { rollback: existing, replayed: true };
    }
    // CAS on the expected old mode in the UPDATE's own WHERE; a suspended payer may still be rolled back.
    const changed = await tx.$executeRaw`UPDATE PayerAccount SET billingMode = 'shadow', version = version + 1,
      updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ${bound.payerAccountId} AND billingMode = 'enforce'`;
    if (changed !== 1) refuse("billing_mode_conflict");
    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT UTC_TIMESTAMP(3) AS now`;
    const rollback = await tx.platformEmergencyRollback.create({ data: { workspaceId: input.workspaceId,
      payerAccountId: bound.payerAccountId, fromMode: "enforce", toMode: "shadow", executedByUserId: input.actorUserId,
      evidenceRef: input.evidenceRef, executedAt: now, reviewDueAt: new Date(now.getTime() + REVIEW_WINDOW_MS) } });
    const payload = { from: "enforce", to: "shadow", emergency: true, rollbackId: rollback.id, reviewDueAt: rollback.reviewDueAt,
      evidenceRef: input.evidenceRef };
    await audit(tx, [input.workspaceId], input.actorUserId, "BILLING_PAYER_MODE_CHANGED", rollback.id, payload);
    await audit(tx, [reservedWorkspaceId, input.workspaceId], input.actorUserId, "BILLING_PLATFORM_EMERGENCY_ROLLBACK_EXECUTED",
      rollback.id, payload);
    return { rollback, replayed: false };
  });
}

export type ConfirmEmergencyRollbackInput = { actorUserId: string; rollbackId: string; evidenceRef: string };

/** Second person: a platform finance checker other than the executor confirms (also after the due time; overdue is only reported). */
export async function confirmEmergencyRollback(client: PrismaClient, input: ConfirmEmergencyRollbackInput) {
  reference(input?.actorUserId, "emergency_forbidden"); reference(input.rollbackId, "emergency_unavailable"); reference(input.evidenceRef);
  return run(client, async tx => {
    const reservedWorkspaceId = await financeActor(tx, input.actorUserId, ["checker"]);
    const [row] = await tx.$queryRaw<PlatformEmergencyRollback[]>`SELECT * FROM PlatformEmergencyRollback
      WHERE id = ${input.rollbackId} FOR UPDATE`;
    if (!row) refuse("emergency_unavailable");
    if (row.state === "confirmed" && row.confirmedByUserId === input.actorUserId) return { rollback: row, replayed: true };
    if (row.state !== "pending_review") refuse("emergency_not_pending");
    if (row.executedByUserId === input.actorUserId) refuse("emergency_self_confirm_forbidden");
    const changed = await tx.$executeRaw`UPDATE PlatformEmergencyRollback SET state = 'confirmed', confirmedByUserId = ${input.actorUserId},
      confirmEvidenceRef = ${input.evidenceRef}, confirmedAt = UTC_TIMESTAMP(3), version = version + 1, updatedAt = UTC_TIMESTAMP(3)
      WHERE id = ${row.id} AND state = 'pending_review' AND CAST(executedByUserId AS BINARY) <> CAST(${input.actorUserId} AS BINARY)`;
    if (changed !== 1) refuse("emergency_write_conflict");
    const rollback = await tx.platformEmergencyRollback.findUniqueOrThrow({ where: { id: row.id } });
    await audit(tx, [reservedWorkspaceId, row.workspaceId], input.actorUserId, "BILLING_PLATFORM_EMERGENCY_ROLLBACK_CONFIRMED", row.id,
      { overdue: rollback.confirmedAt! > row.reviewDueAt, evidenceRef: input.evidenceRef });
    return { rollback, replayed: false };
  });
}

/** Pending records, oldest due first, with `overdue` on database time. Read-only. */
export async function listPendingEmergencyRollbacks(client: PrismaClient) {
  const rows = await client.$queryRaw<Array<{ id: string; workspaceId: string; executedByUserId: string; executedAt: Date;
    reviewDueAt: Date; overdue: bigint | number }>>`SELECT id, workspaceId, executedByUserId, executedAt, reviewDueAt,
    reviewDueAt <= UTC_TIMESTAMP(3) AS overdue FROM PlatformEmergencyRollback WHERE state = 'pending_review' ORDER BY reviewDueAt`;
  return rows.map(row => ({ ...row, overdue: Number(row.overdue) === 1 }));
}

export type EmergencyCliArgs =
  | { command: "emergency-rollback"; actorUserId: string; workspaceId: string; evidenceRef: string; apply: boolean }
  | { command: "confirm-rollback"; actorUserId: string; rollbackId: string; evidenceRef: string; apply: boolean }
  | { command: "pending-rollbacks" };
export const EMERGENCY_COMMANDS = ["emergency-rollback", "confirm-rollback", "pending-rollbacks"] as const;

export function parseEmergencyArgs(argv: readonly string[]): EmergencyCliArgs | { invalid: string } {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const match = arg === "--apply" ? ["", "apply", ""] : /^--(command|actor-user-id|workspace-id|rollback-id|evidence-ref)=([^\n]*)$/u.exec(arg);
    if (!match) return { invalid: "unknown_argument" };
    if (values.has(match[1])) return { invalid: "duplicate_argument" };
    values.set(match[1], match[2]);
  }
  const command = values.get("command"), apply = values.has("apply");
  const actorUserId = values.get("actor-user-id"), evidenceRef = values.get("evidence-ref");
  const allowed: Record<string, string[]> = { "emergency-rollback": ["actor-user-id", "workspace-id", "evidence-ref"],
    "confirm-rollback": ["actor-user-id", "rollback-id", "evidence-ref"], "pending-rollbacks": [] };
  if (!command || !Object.hasOwn(allowed, command)) return { invalid: "unknown_command" };
  const expected = ["command", ...allowed[command], ...(apply && command !== "pending-rollbacks" ? ["apply"] : [])].sort();
  if ([...values.keys()].sort().join(",") !== expected.join(",")) return { invalid: "arguments_invalid" };
  if (command === "pending-rollbacks") return { command };
  if (command === "emergency-rollback") return { command, actorUserId: actorUserId!, workspaceId: values.get("workspace-id")!, evidenceRef: evidenceRef!, apply };
  return { command: "confirm-rollback", actorUserId: actorUserId!, rollbackId: values.get("rollback-id")!, evidenceRef: evidenceRef!, apply };
}

/** CLI body: dry run (default) only reads; `pending-rollbacks` sets `alert` when any record is overdue (exit code 3 in the script). */
export async function runEmergencyCommand(client: PrismaClient, args: EmergencyCliArgs) {
  if (args.command === "pending-rollbacks") {
    const pending = await listPendingEmergencyRollbacks(client);
    return { ok: true, pending, alert: pending.some(row => row.overdue) ? "emergency_rollback_review_overdue" : null };
  }
  try {
    if (args.command === "emergency-rollback") {
      if (!args.apply) {
        const bound = await client.payerScopeBinding.findFirst({ where: { scopeKind: "workspace", activeScopeRef: args.workspaceId },
          select: { payerAccountId: true } });
        const payer = bound && await client.payerAccount.findUnique({ where: { id: bound.payerAccountId }, select: { billingMode: true } });
        return { ok: true, applied: false, workspaceId: args.workspaceId, currentMode: payer?.billingMode ?? null, wouldSwitch: payer?.billingMode === "enforce" };
      }
      const { rollback, replayed } = await executeEmergencyRollback(client, args);
      return { ok: true, applied: true, rollbackId: rollback.id, state: rollback.state, reviewDueAt: rollback.reviewDueAt, replayed };
    }
    if (!args.apply) {
      const row = await client.platformEmergencyRollback.findUnique({ where: { id: args.rollbackId },
        select: { state: true, executedByUserId: true, reviewDueAt: true } });
      return { ok: true, applied: false, rollback: row };
    }
    const { rollback, replayed } = await confirmEmergencyRollback(client, args);
    return { ok: true, applied: true, rollbackId: rollback.id, state: rollback.state, replayed };
  } catch (error) {
    if (error instanceof EmergencyRollbackRefusal) return { ok: false, code: error.code };
    throw error;
  }
}
