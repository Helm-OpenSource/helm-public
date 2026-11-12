import "server-only";
import { ActorType, type PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { createAlipayTopupAdapter, resolveAlipayTopup } from "./alipay-topup";
import { TopupRefusal, verifyTopupByQuery, type PaymentException, type TopupProviderAdapter } from "./topup-orders";

/**
 * Operator CLI that consumes top-up payment exceptions (contract S2D §11 items 7 and 9); no HTTP route. Reads by default, writes
 * only with --apply. "Unhandled" = a `PaymentException` outbox row whose `deliveredAt` is NULL: no dispatcher reads these rows, so
 * `ack` sets `deliveredAt` once a person has reconciled the record (with an audit row naming them). `reverify` re-queries the
 * provider for one order through the single verification entry, without the 72-hour limit of the session route.
 *
 *   npm run billing:topup-exceptions -- list [--all] [--limit=<1-500>]
 *   npm run billing:topup-exceptions -- ack --key=<exception key> --actor-user-id=<id> --note=<text> [--apply]
 *   npm run billing:topup-exceptions -- reverify --order-id=<id> [--apply]
 */
const COMMANDS: Record<string, string[]> = { list: ["all", "limit"], ack: ["key", "actor-user-id", "note"], reverify: ["order-id"] };
const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/;
const SOURCE_PAGE = "/billing/topup";

export class TopupExceptionsOperatorError extends Error {
  constructor(readonly code: string, readonly exitCode = 1) { super(code); this.name = "TopupExceptionsOperatorError"; }
}
const usage = (reason: string): never => { throw new TopupExceptionsOperatorError(`usage:${reason}`, 2); };
const fail = (code: string): never => { throw new TopupExceptionsOperatorError(code); };

export function parseTopupExceptionsArgs(argv: string[]) {
  const [command, ...rest] = argv;
  if (!command || !Object.hasOwn(COMMANDS, command)) usage("command");
  const flags = new Map<string, string>();
  let apply = false;
  for (const arg of rest) {
    if (arg === "--apply" && command !== "list") { apply = true; continue; }
    if (arg === "--all" && command === "list") { flags.set("all", "true"); continue; }
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match || !COMMANDS[command].includes(match[1]) || flags.has(match[1])) usage(`flag:${arg.split("=")[0]}`);
    flags.set(match![1], match![2]);
  }
  return { command, apply, flags };
}
type Args = ReturnType<typeof parseTopupExceptionsArgs>;
const ref = (args: Args, name: string) => { const value = args.flags.get(name) ?? usage(`missing:${name}`); return REF.test(value) ? value : usage(name); };

type Row = { aggregateId: string; payload: string; createdAt: Date; deliveredAt: Date | null };
const view = (row: Row) => ({ ...(JSON.parse(row.payload) as PaymentException), key: row.aggregateId,
  createdAt: row.createdAt.toISOString(), handledAt: row.deliveredAt?.toISOString() ?? null });

async function list(client: PrismaClient, args: Args) {
  const limit = args.flags.get("limit") ?? "100";
  if (!/^[1-9][0-9]{0,2}$/.test(limit) || Number(limit) > 500) usage("limit");
  const rows = await client.billingOutbox.findMany({ where: { aggregateType: "PaymentException", eventType: "payment_exception",
    ...(args.flags.has("all") ? {} : { deliveredAt: null }) }, orderBy: { createdAt: "asc" }, take: Number(limit),
    select: { aggregateId: true, payload: true, createdAt: true, deliveredAt: true } });
  return { ok: true, command: "list", unhandledOnly: !args.flags.has("all"), exceptions: rows.map(view) };
}

async function ack(client: PrismaClient, args: Args) {
  const key = ref(args, "key"), actorUserId = ref(args, "actor-user-id");
  const note = args.flags.get("note") ?? usage("missing:note");
  if (note.length > 500) usage("note");
  const row = await client.billingOutbox.findFirst({ where: { aggregateType: "PaymentException", eventType: "payment_exception",
    aggregateId: key }, select: { aggregateId: true, payload: true, createdAt: true, deliveredAt: true } });
  if (!row) fail("exception_unknown");
  if (row!.deliveredAt) fail("exception_already_handled");
  if (!args.apply) return { ok: true, command: "ack", applied: false, exception: view(row!) };
  const exception = view(row!);
  await client.$transaction(async tx => {
    const changed = await tx.$executeRaw`UPDATE BillingOutbox SET deliveredAt = ${new Date()} WHERE aggregateType = 'PaymentException'
      AND eventType = 'payment_exception' AND aggregateId = ${key} AND deliveredAt IS NULL`;
    if (changed !== 1) fail("exception_already_handled");
    await writeAuditLog({ workspaceId: exception.workspaceId, userId: actorUserId, actor: actorUserId, actorType: ActorType.USER,
      actionType: "BILLING_TOPUP_PAYMENT_EXCEPTION_HANDLED", targetType: "PaymentOrder", targetId: exception.paymentOrderId,
      summary: `Top-up payment exception handled: ${exception.reason}`, sourcePage: SOURCE_PAGE, relatedObjectType: "PayerAccount",
      relatedObjectId: exception.payerAccountId, payload: { key, note } }, { client: tx });
  });
  return { ok: true, command: "ack", applied: true, key };
}

async function reverify(client: PrismaClient, args: Args, adapterFor: (provider: string) => TopupProviderAdapter) {
  const order = await client.paymentOrder.findUnique({ where: { id: ref(args, "order-id") }, select: { id: true, provider: true,
    providerOrderNo: true, state: true, amountFen: true, workspaceId: true, createdAt: true } });
  if (!order) fail("order_unknown");
  if (!args.apply) return { ok: true, command: "reverify", applied: false, order };
  try {
    return { ok: true, command: "reverify", applied: true, result: await verifyTopupByQuery(client, adapterFor(order!.provider), order!.id) };
  } catch (error) {
    if (error instanceof TopupRefusal) fail(error.code);
    return fail("provider_query_failed"); // fixed code: never provider text
  }
}

/** Alipay only for now; the WeChat Pay adapter plugs in here when it lands. */
function liveAdapter(provider: string): TopupProviderAdapter {
  const config = provider === "alipay" ? resolveAlipayTopup("query") : "off";
  if (typeof config === "string") return fail(`provider_unavailable:${provider}`);
  return createAlipayTopupAdapter(config);
}

export async function runTopupExceptionsOperator(client: PrismaClient, argv: string[], adapterFor = liveAdapter) {
  try {
    const args = parseTopupExceptionsArgs(argv);
    const output = args.command === "list" ? await list(client, args) : args.command === "ack" ? await ack(client, args)
      : await reverify(client, args, adapterFor);
    return { exitCode: 0, output };
  } catch (error) {
    if (!(error instanceof TopupExceptionsOperatorError)) throw error;
    return { exitCode: error.exitCode, output: { ok: false, code: error.code } };
  }
}

export const toJson = (value: unknown) => JSON.stringify(value, (_key, item) => typeof item === "bigint" ? item.toString() : item, 2);
