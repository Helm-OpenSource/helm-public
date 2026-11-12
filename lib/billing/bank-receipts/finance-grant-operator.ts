import "server-only";
import type { PrismaClient } from "@prisma/client";
import { HELM_RESERVED_WORKSPACE_SYSTEM_KEY } from "@/lib/workspace-identity";
import { BankReceiptRefusal, grantPlatformFinanceRole, revokePlatformFinanceRole, type PlatformFinanceRoleName } from "./bank-receipts";

/**
 * Operator CLI for platform finance roles (PlatformFinanceGrant maker / checker); no HTTP route. Reads by default, writes only with
 * --apply, always through the S2-c service: only the reserved workspace's OWNER grants or revokes, never to themselves, only to its
 * ACTIVE unscoped members; AuditLog in the same transaction. `--actor-user-id` is declared, not authenticated: the OWNER runs it.
 */
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
const COMMANDS: Record<string, string[]> = {
  list: ["user-id", "include-revoked"],
  grant: ["actor-user-id", "user-id", "role", "evidence-ref"],
  revoke: ["actor-user-id", "grant-id", "expected-version", "evidence-ref"],
};

export class FinanceGrantOperatorError extends Error {
  constructor(readonly code: string, readonly exitCode = 1) { super(code); this.name = "FinanceGrantOperatorError"; }
}
const usage = (reason: string): never => { throw new FinanceGrantOperatorError(`usage:${reason}`, 2); };

type Args = { command: string; apply: boolean; flags: Map<string, string> };
export function parseFinanceGrantArgs(argv: string[]): Args {
  const [command, ...rest] = argv;
  if (!command || !Object.prototype.hasOwnProperty.call(COMMANDS, command)) usage("command");
  const flags = new Map<string, string>();
  let apply = false;
  for (const arg of rest) {
    if (arg === "--apply" && command !== "list") { apply = true; continue; }
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !COMMANDS[command].includes(match[1]) || flags.has(match[1])) usage(`flag:${arg.split("=")[0]}`);
    flags.set(match![1], match![2]);
  }
  return { command, apply, flags };
}
const refFlag = (args: Args, name: string) => {
  const value = args.flags.get(name) ?? usage(`missing:${name}`);
  return REF.test(value) ? value : usage(name);
};

const grantView = (row: { id: string; userId: string; role: string; state: string; version: number; grantedByUserId: string;
  evidenceRef: string; createdAt: Date; revokedAt: Date | null; revokedByUserId: string | null }) => ({ id: row.id, userId: row.userId,
  role: row.role, state: row.state, version: row.version, grantedByUserId: row.grantedByUserId, evidenceRef: row.evidenceRef,
  createdAt: row.createdAt, revokedAt: row.revokedAt, revokedByUserId: row.revokedByUserId });

/** Read-only: the user's membership of the reserved workspace, as the service will require it (ACTIVE, unscoped). */
async function reservedMembership(client: PrismaClient, userId: string) {
  const member = await client.membership.findFirst({ where: { userId,
    workspace: { systemKey: HELM_RESERVED_WORKSPACE_SYSTEM_KEY, workspaceClass: "HELM_RESERVED", status: "ACTIVE" } },
  select: { role: true, status: true, accessScope: true } });
  const eligible = member !== null && member.status === "ACTIVE" && (member.accessScope === null || member.accessScope === "");
  return { member: eligible, owner: eligible && member.role === "OWNER" };
}

async function run(client: PrismaClient, args: Args) {
  if (args.command === "list") {
    const userId = args.flags.get("user-id");
    if (userId !== undefined && !REF.test(userId)) usage("user-id");
    const revoked = args.flags.get("include-revoked");
    if (revoked !== undefined && revoked !== "true") usage("include-revoked");
    const grants = await client.platformFinanceGrant.findMany({ where: { ...(userId ? { userId } : {}),
      ...(revoked ? {} : { state: "active" as const }) }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    return { ok: true, command: "list", grants: grants.map(grantView) };
  }
  const actorUserId = refFlag(args, "actor-user-id"), evidenceRef = refFlag(args, "evidence-ref");
  const actor = await reservedMembership(client, actorUserId);
  if (args.command === "grant") {
    const userId = refFlag(args, "user-id");
    const role = args.flags.get("role");
    if (role !== "maker" && role !== "checker") return usage("role");
    const input = { actorUserId, userId, role: role as PlatformFinanceRoleName, evidenceRef };
    if (!args.apply) {
      const existing = await client.platformFinanceGrant.findFirst({ where: { activeUserId: userId, role, state: "active" } });
      return { ok: true, command: "grant", applied: false, plan: input, preflight: { actorIsReservedOwner: actor.owner,
        userIsReservedMember: (await reservedMembership(client, userId)).member, selfGrant: userId === actorUserId,
        activeGrant: existing && grantView(existing) } };
    }
    return { ok: true, command: "grant", applied: true, grant: grantView(await grantPlatformFinanceRole(client, input)) };
  }
  const grantId = refFlag(args, "grant-id");
  const version = args.flags.get("expected-version") ?? usage("missing:expected-version");
  if (!/^[1-9][0-9]{0,8}$/.test(version)) usage("expected-version");
  const input = { actorUserId, grantId, expectedVersion: Number(version), evidenceRef };
  if (!args.apply) {
    const grant = await client.platformFinanceGrant.findUnique({ where: { id: grantId } });
    return { ok: true, command: "revoke", applied: false, plan: input, preflight: { actorIsReservedOwner: actor.owner,
      grant: grant && grantView(grant) } };
  }
  return { ok: true, command: "revoke", applied: true, grant: grantView(await revokePlatformFinanceRole(client, input)) };
}

/** Runs one CLI invocation: { exitCode 0 ok | 1 refusal | 2 usage, output }. Unexpected errors are rethrown to the shell. */
export async function runFinanceGrantOperator(client: PrismaClient, argv: string[]) {
  try {
    return { exitCode: 0, output: await run(client, parseFinanceGrantArgs(argv)) as Record<string, unknown> };
  } catch (error) {
    if (error instanceof BankReceiptRefusal || error instanceof FinanceGrantOperatorError) {
      return { exitCode: error instanceof FinanceGrantOperatorError ? error.exitCode : 1, output: { ok: false, code: error.code } };
    }
    throw error;
  }
}
