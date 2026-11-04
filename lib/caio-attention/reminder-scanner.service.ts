import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";

import type { CaioAttentionSeverity } from "./contracts";
import {
  caioAttentionWarningDigest,
  collectDueCaioAttentionReminders,
  isCaioAttentionRecurrenceSendable,
  type CaioAttentionPolicy,
  type CaioAttentionReminderFields,
  type CaioAttentionReminderRule,
} from "./schedule";
import type { CaioAttentionStatus } from "./state-machine";

/**
 * Reminder and escalation scanner for attention cases (design v6 §3). Runs on the web nodes every few minutes.
 *
 * Per case, one transaction: lock the Case row (FOR UPDATE), work out every rule that is due with the S1 pure
 * function, write the in-app notifications and one event per rule, then advance only the reminder columns.
 * It never changes status, commandVersion, people or committedDueAt; those belong to the lifecycle service.
 * Two nodes scanning together serialise on the row lock; the per-workspace notification dedupe key, which
 * carries the recipient, the stage and the command version, is the last guard.
 *
 * Notifications go to one user each, carry no case content (only the short number and the stage) and are in-app
 * only: no SMS, email or IM. `now` and the policy are injected; the scanner never reads the wall clock.
 */

export type CaioAttentionScanRule = CaioAttentionReminderRule | "R3" | "R0w";

export type CaioAttentionReminderScanResult = {
  casesScanned: number;
  sends: Partial<Record<CaioAttentionScanRule, number>>;
  notificationsCreated: number;
  notificationsDeduplicated: number;
  failedCaseIds: string[];
  /** Rules that fell due with nobody to notify (e.g. no active OWNER): left unconsumed and logged. */
  skippedNoRecipient: Partial<Record<CaioAttentionScanRule, number>>;
};

const MAX_CASES_PER_SCAN = 500;
const MAX_ATTEMPTS = 4;

/** MySQL deadlock (1213) / lock wait timeout (1205), as raw-query errors or Prisma's transaction write conflict. */
function isRetryable(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const code = String((error.meta as { code?: unknown } | undefined)?.code ?? "");
  return error.code === "P2034" || code === "1213" || code === "1205";
}
const WORKING = Prisma.sql`('DISPATCHED', 'DISPOSITION_SUBMITTED')`;
const PENDING = Prisma.sql`('SUGGESTED', 'DEFERRED')`;

const STAGE_LABEL: Record<CaioAttentionScanRule, string> = {
  R0a: "待确认", R0b: "待确认", R0w: "待确认汇总", R1: "无人响应升级", R2: "未处理完升级", R3: "复发", R4: "待处理",
};

type CaseRow = {
  id: string; workspaceId: string; shortNo: number; status: string; commandVersion: number;
  effectiveSeverity: string; primaryUserId: string | null; ccUserIdsJson: string; escalationUserId: string | null;
  reviewerUserIdsJson: string; committedDueAt: Date | null; dispatchedAt: Date | null; respondedAt: Date | null;
  r0aDueAt: Date | null; r0aSentAt: Date | null; r0bDueAt: Date | null; r0bSentAt: Date | null;
  noResponseDueAt: Date | null; r1FiredAt: Date | null; unresolvedEscalateAt: Date | null;
  r2FiredSeverity: string | null; nextPeriodicAt: Date | null;
};

type Tx = Prisma.TransactionClient;

function parseIds(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && id.length > 0) : [];
  } catch {
    return [];
  }
}

/** Active OWNERs of the workspace (same membership rule as the lifecycle service), oldest membership first. */
async function activeOwnerIds(client: Tx | PrismaClient, workspaceId: string): Promise<string[]> {
  const rows = await client.$queryRaw<Array<{ userId: string }>>`
    SELECT userId FROM Membership WHERE workspaceId = ${workspaceId} AND role = 'OWNER' AND status = 'ACTIVE'
      AND accessScope IS NULL
    ORDER BY joinedAt, userId`;
  return rows.map((row) => row.userId);
}

/** Insert one in-app notification unless its dedupe key already exists. Returns whether a row was created. */
async function notifyOnce(client: Tx | PrismaClient, input: {
  workspaceId: string; userId: string; title: string; body: string; dedupeKey: string;
}): Promise<boolean> {
  try {
    const created = await client.$executeRaw`
      INSERT INTO Notification (id, workspaceId, userId, type, title, body, url, dedupeKey, createdAt)
      SELECT ${randomUUID()}, ${input.workspaceId}, ${input.userId}, 'REMINDER', ${input.title}, ${input.body}, NULL,
        ${input.dedupeKey}, NOW(3) FROM DUAL
      WHERE NOT EXISTS (SELECT 1 FROM Notification WHERE workspaceId = ${input.workspaceId} AND dedupeKey = ${input.dedupeKey})`;
    return created === 1;
  } catch (error) {
    // A concurrent writer of the same key: the unique (workspaceId, dedupeKey) index decided, nothing to do.
    if (error instanceof Prisma.PrismaClientKnownRequestError && String((error.meta as { code?: unknown })?.code) === "1062") return false;
    throw error;
  }
}

async function appendEvent(tx: Tx, input: {
  caseId: string; kind: "REMINDED" | "ESCALATED" | "R3_SENT"; commandVersion: number; candidateId?: string;
  dedupeKey?: string; payload: Record<string, unknown>;
}) {
  await tx.$executeRaw`
    INSERT INTO CaioAttentionCaseEvent (id, caseId, kind, commandVersion, candidateId, dedupeKey, actorUserId, payloadJson, createdAt)
    SELECT ${randomUUID()}, ${input.caseId}, ${input.kind}, ${input.commandVersion}, ${input.candidateId ?? null},
      ${input.dedupeKey ?? null}, NULL, ${JSON.stringify(input.payload)}, NOW(3) FROM DUAL
    WHERE NOT EXISTS (SELECT 1 FROM CaioAttentionCaseEvent WHERE caseId = ${input.caseId} AND kind = ${input.kind}
      AND ((${input.candidateId ?? null} IS NOT NULL AND candidateId = ${input.candidateId ?? null})
        OR (${input.dedupeKey ?? null} IS NOT NULL AND dedupeKey = ${input.dedupeKey ?? null})))`;
}

/**
 * Ids of cases with at least one rule due; each branch is a range scan on one (status, due column) index and mirrors
 * the pure function's own preconditions, so a case with nothing to do is not locked every tick. R0a also covers
 * DEFERRED (a case raised to critical while deferred notifies the OWNER once); R0b is SUGGESTED only.
 */
async function dueCaseIds(client: PrismaClient, now: Date, includeRecurrence: boolean, limit: number,
  skip: readonly string[]): Promise<string[]> {
  const recurrence = includeRecurrence
    ? Prisma.sql`UNION SELECT e.caseId AS id FROM CaioAttentionCaseEvent e JOIN CaioAttentionCase c ON c.id = e.caseId
        WHERE e.kind = 'RECURRED' AND c.status IN ${WORKING}
          AND NOT EXISTS (SELECT 1 FROM CaioAttentionCaseEvent s WHERE s.caseId = e.caseId AND s.kind = 'R3_SENT'
            AND s.candidateId = e.candidateId)`
    : Prisma.empty;
  const skipped = skip.length > 0 ? Prisma.sql`WHERE due.id NOT IN (${Prisma.join([...skip])})` : Prisma.empty;
  const rows = await client.$queryRaw<Array<{ id: string }>>`
    SELECT due.id FROM (
      SELECT id FROM CaioAttentionCase WHERE status IN ${PENDING} AND r0aDueAt <= ${now} AND r0aSentAt IS NULL
      UNION SELECT id FROM CaioAttentionCase WHERE status = 'SUGGESTED' AND r0bDueAt <= ${now} AND r0bSentAt IS NULL
      UNION SELECT id FROM CaioAttentionCase WHERE status = 'DISPATCHED' AND noResponseDueAt <= ${now} AND r1FiredAt IS NULL
        AND respondedAt IS NULL
      UNION SELECT id FROM CaioAttentionCase WHERE status IN ${WORKING} AND unresolvedEscalateAt <= ${now}
        AND (r2FiredSeverity IS NULL OR r2FiredSeverity <> effectiveSeverity)
      UNION SELECT id FROM CaioAttentionCase WHERE status IN ${WORKING} AND nextPeriodicAt <= ${now}
      ${recurrence}
    ) due ${skipped}
    ORDER BY due.id LIMIT ${limit}`;
  return rows.map((row) => row.id);
}

/** The reminder columns each rule consumes; left untouched when the rule had nobody to notify. */
const RULE_FIELDS: Record<CaioAttentionReminderRule, readonly (keyof CaioAttentionReminderFields)[]> = {
  R1: ["r1FiredAt"], R2: ["r2FiredSeverity"], R0a: ["r0aSentAt", "r0bDueAt"], R0b: ["r0bSentAt"], R4: ["nextPeriodicAt"],
};

const FIELD_COLUMNS: Record<keyof CaioAttentionReminderFields, string> = {
  r0aDueAt: "r0aDueAt", r0aSentAt: "r0aSentAt", r0bDueAt: "r0bDueAt", r0bSentAt: "r0bSentAt",
  noResponseDueAt: "noResponseDueAt", r1FiredAt: "r1FiredAt", unresolvedEscalateAt: "unresolvedEscalateAt",
  r2FiredSeverity: "r2FiredSeverity", nextPeriodicAt: "nextPeriodicAt",
};

function emptyResult(): CaioAttentionReminderScanResult {
  return { casesScanned: 0, sends: {}, notificationsCreated: 0, notificationsDeduplicated: 0, failedCaseIds: [], skippedNoRecipient: {} };
}

/** Counts are merged only after the case transaction commits, so a retried attempt is never counted twice. */
async function scanOneCase(client: PrismaClient, caseId: string, now: Date, policy: CaioAttentionPolicy,
  total: CaioAttentionReminderScanResult): Promise<void> {
  const result = emptyResult();
  await client.$transaction(async (tx) => {
    const [row] = await tx.$queryRaw<CaseRow[]>`
      SELECT id, workspaceId, shortNo, status, commandVersion, effectiveSeverity, primaryUserId, ccUserIdsJson,
        escalationUserId, reviewerUserIdsJson, committedDueAt, dispatchedAt, respondedAt, r0aDueAt, r0aSentAt, r0bDueAt,
        r0bSentAt, noResponseDueAt, r1FiredAt, unresolvedEscalateAt, r2FiredSeverity, nextPeriodicAt
      FROM CaioAttentionCase WHERE id = ${caseId} FOR UPDATE`;
    if (!row) return;
    const status = row.status as CaioAttentionStatus;
    const owners = await activeOwnerIds(tx, row.workspaceId);
    // Owner ruling §6.10: when the escalation holder is also the primary, the escalation goes to the OWNER.
    // Confirm already rejects that combination; this keeps a stale or hand-edited row from escalating to itself.
    const escalationUserId = row.escalationUserId && row.escalationUserId === row.primaryUserId
      ? owners[0] ?? null : row.escalationUserId;
    const fields: CaioAttentionReminderFields = {
      r0aDueAt: row.r0aDueAt, r0aSentAt: row.r0aSentAt, r0bDueAt: row.r0bDueAt, r0bSentAt: row.r0bSentAt,
      noResponseDueAt: row.noResponseDueAt, r1FiredAt: row.r1FiredAt, unresolvedEscalateAt: row.unresolvedEscalateAt,
      r2FiredSeverity: row.r2FiredSeverity as CaioAttentionSeverity | null, nextPeriodicAt: row.nextPeriodicAt,
    };
    const { sends, updates } = collectDueCaioAttentionReminders({
      caseId: row.id, status, effectiveSeverity: row.effectiveSeverity as CaioAttentionSeverity,
      commandVersion: row.commandVersion, respondedAt: row.respondedAt, ownerUserIds: owners,
      primaryUserId: row.primaryUserId, escalationUserId, reviewerUserIds: parseIds(row.reviewerUserIdsJson),
    }, fields, now, policy);

    const overdue = row.committedDueAt !== null && row.committedDueAt.getTime() < now.getTime();
    const title = (rule: CaioAttentionScanRule) => `CAIO 关注事项 #${row.shortNo} · ${STAGE_LABEL[rule]}${overdue ? " · 已逾期" : ""}`;
    const deliver = async (rule: CaioAttentionScanRule, notifications: { userId: string; dedupeKey: string }[]) => {
      for (const notification of notifications) {
        const created = await notifyOnce(tx, { workspaceId: row.workspaceId, title: title(rule), body: "待你处理", ...notification });
        if (created) result.notificationsCreated += 1;
        else result.notificationsDeduplicated += 1;
      }
      result.sends[rule] = (result.sends[rule] ?? 0) + 1;
    };

    // The rule-level event key comes from the due value being consumed, so a replay of the same due time is a no-op.
    const ruleKey: Record<CaioAttentionReminderRule, () => string> = {
      R1: () => `R1:v${row.commandVersion}`,
      R2: () => `R2:v${row.commandVersion}:${row.effectiveSeverity}`,
      R0a: () => `R0a:${fields.r0aDueAt?.toISOString()}`,
      R0b: () => `R0b:${fields.r0bDueAt?.toISOString()}`,
      R4: () => `R4:v${row.commandVersion}:${status}:${fields.nextPeriodicAt?.toISOString()}`,
    };
    for (const send of sends) {
      if (send.notifications.length === 0) {
        // Nobody to tell (e.g. no active OWNER): keep the rule due so it fires once someone exists, and say so.
        for (const key of RULE_FIELDS[send.rule]) delete updates[key];
        result.skippedNoRecipient[send.rule] = (result.skippedNoRecipient[send.rule] ?? 0) + 1;
        console.warn(`[caio-attention-reminders] case ${row.id} ${send.rule} due but has no recipient; left due`);
        continue;
      }
      await deliver(send.rule, send.notifications);
      await appendEvent(tx, {
        caseId: row.id, kind: send.rule === "R1" || send.rule === "R2" ? "ESCALATED" : "REMINDED",
        commandVersion: row.commandVersion, dedupeKey: ruleKey[send.rule](),
        payload: { rule: send.rule, recipients: send.notifications.length, scannedAt: now.toISOString() },
      });
    }

    // R3: each RECURRED event not yet followed by an R3_SENT notifies the primary and cc once; never the escalation
    // holder. Not cut at dispatchedAt, so a recurrence recorded at night survives a reissue before 08:00.
    if (isCaioAttentionRecurrenceSendable(status, now, policy)) {
      const recurrences = await tx.$queryRaw<Array<{ candidateId: string }>>`
        SELECT e.candidateId FROM CaioAttentionCaseEvent e
        WHERE e.caseId = ${row.id} AND e.kind = 'RECURRED' AND e.candidateId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM CaioAttentionCaseEvent s WHERE s.caseId = e.caseId AND s.kind = 'R3_SENT'
            AND s.candidateId = e.candidateId)
        ORDER BY e.createdAt`;
      const recipients = [...new Set([row.primaryUserId, ...parseIds(row.ccUserIdsJson)].filter((id): id is string => Boolean(id)))];
      if (recurrences.length > 0 && recipients.length === 0) {
        result.skippedNoRecipient.R3 = (result.skippedNoRecipient.R3 ?? 0) + recurrences.length;
        console.warn(`[caio-attention-reminders] case ${row.id} R3 due but has no recipient; left due`);
      }
      for (const { candidateId } of recipients.length > 0 ? recurrences : []) {
        await deliver("R3", recipients.map((userId) => ({ userId, dedupeKey: `ca:${row.id}:R3:${candidateId}:${userId}` })));
        await appendEvent(tx, {
          caseId: row.id, kind: "R3_SENT", commandVersion: row.commandVersion, candidateId,
          payload: { rule: "R3", recipients: recipients.length, scannedAt: now.toISOString() },
        });
      }
    }

    const entries = Object.entries(updates) as Array<[keyof CaioAttentionReminderFields, Date | string | null]>;
    if (entries.length === 0) return;
    const assignments = entries.map(([key, value]) => Prisma.sql`${Prisma.raw(`\`${FIELD_COLUMNS[key]}\``)} = ${value}`);
    // The row is locked; the status / commandVersion predicate still proves the fields belong to what was read.
    const written = await tx.$executeRaw`
      UPDATE CaioAttentionCase SET ${Prisma.join(assignments, ", ")}, updatedAt = ${now}
      WHERE id = ${row.id} AND status = ${row.status} AND commandVersion = ${row.commandVersion}`;
    if (written !== 1) throw new Error("caio_attention_reminder_cas_lost");
    // READ COMMITTED, as the lifecycle service: the NOT EXISTS probes then take no gap locks on Notification, so two
    // nodes scanning different cases do not deadlock on neighbouring dedupe keys. The Case row lock still serialises.
  }, { timeout: 20_000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  for (const [rule, count] of Object.entries(result.skippedNoRecipient) as Array<[CaioAttentionScanRule, number]>) {
    total.skippedNoRecipient[rule] = (total.skippedNoRecipient[rule] ?? 0) + count;
  }
  total.casesScanned += 1;
  total.notificationsCreated += result.notificationsCreated;
  total.notificationsDeduplicated += result.notificationsDeduplicated;
  for (const [rule, count] of Object.entries(result.sends) as Array<[CaioAttentionScanRule, number]>) {
    total.sends[rule] = (total.sends[rule] ?? 0) + count;
  }
}

/** R0w: one digest per OWNER per local date while the workspace has warning suggestions awaiting confirmation. */
async function sendWarningDigests(client: PrismaClient, now: Date, policy: CaioAttentionPolicy,
  result: CaioAttentionReminderScanResult): Promise<void> {
  const workspaces = await client.$queryRaw<Array<{ workspaceId: string; n: bigint }>>`
    SELECT workspaceId, COUNT(*) AS n FROM CaioAttentionCase WHERE status = 'SUGGESTED' AND effectiveSeverity = 'warning'
    GROUP BY workspaceId ORDER BY workspaceId`;
  for (const { workspaceId, n } of workspaces) {
    for (const ownerUserId of await activeOwnerIds(client, workspaceId)) {
      const digest = caioAttentionWarningDigest(workspaceId, ownerUserId, now, policy);
      if (!digest.due) continue;
      const created = await notifyOnce(client, {
        workspaceId, userId: ownerUserId, dedupeKey: digest.dedupeKey,
        title: `CAIO 关注事项 · ${STAGE_LABEL.R0w}`, body: `${Number(n)} 项警告待确认`,
      });
      if (created) {
        result.notificationsCreated += 1;
        result.sends.R0w = (result.sends.R0w ?? 0) + 1;
      } else {
        result.notificationsDeduplicated += 1;
      }
    }
  }
}

export async function runCaioAttentionReminderScan(input: {
  client: PrismaClient;
  now: Date;
  policy: CaioAttentionPolicy;
  maxCases?: number;
  /** Cases that failed in the previous round; skipped for one round so they cannot hold the head of the batch. */
  skipCaseIds?: readonly string[];
}): Promise<CaioAttentionReminderScanResult> {
  const result = emptyResult();
  // Recurrence notices are daytime-only; outside the window those cases are not even locked.
  const includeRecurrence = isCaioAttentionRecurrenceSendable("DISPATCHED", input.now, input.policy);
  const ids = await dueCaseIds(input.client, input.now, includeRecurrence, input.maxCases ?? MAX_CASES_PER_SCAN,
    input.skipCaseIds ?? []);
  for (const caseId of ids) {
    // Failure isolation: one case's error must not starve the others of their escalations. Deadlocks and lock
    // waits (another node scanning, a lifecycle write) are retried a bounded number of times; the transaction
    // rolled back as a whole, so a retry starts from the committed row.
    for (let attempt = 1; ; attempt += 1) {
      try {
        await scanOneCase(input.client, caseId, input.now, input.policy, result);
        break;
      } catch (error) {
        if (attempt < MAX_ATTEMPTS && isRetryable(error)) continue;
        result.failedCaseIds.push(caseId);
        console.error(`[caio-attention-reminders] case ${caseId} failed: ${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }
  }
  await sendWarningDigests(input.client, input.now, input.policy, result);
  return result;
}
