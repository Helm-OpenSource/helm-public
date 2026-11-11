import "server-only";
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { SpendGrantRefusal } from "../grants/price-grants";
import { draftPlatformOperation, normalizePlatformOperation, PlatformOperationRefusal, PRICE_LABEL_TEXT, reviewPlatformOperation,
  type PlatformOperationRequest } from "./platform-operations";

/**
 * Billing V1 E1a batch runner behind `npm run billing:platform-ops`. The list file is supplied by operations (no workspace is
 * hard-coded): `{ "evidenceRef": "<owner ruling ref>", "entries": [PlatformOperationRequest, ...] }`. Dry run (default) only reads;
 * `--apply` requires the list sha256 printed by the dry run, then runs one transaction per entry in file order and stops at the first
 * refusal. Re-running the same list resumes: committed entries replay.
 */
export type PlatformOperationList = { sha256: string; evidenceRef: string; entries: PlatformOperationRequest[] };
export type PlatformBatchArgs = { command: "draft" | "review"; listFile: string; actorUserId: string; apply: boolean;
  listSha: string | null; decision: "approve" | "reject" | null; reviewEvidenceRef: string | null; confirmEnforce: boolean };

const FIELDS: Record<string, string[]> = { payer_onboard: ["contractSubjectRef", "kind", "workspaceId"],
  billing_mode: ["fromMode", "kind", "toMode", "workspaceId"],
  price_publish: ["acceptanceRef", "approvalRef", "billingEventRef", "effectiveFrom", "effectiveUntil", "kind", "meterUnit", "priceLabel",
    "productCode", "unitPriceDenominator", "unitPriceFenNumerator", "version"],
  spend_grant: ["dailyLimitFen", "kind", "monthlyLimitFen", "perChargeLimitFen", "priceVersion", "productCode", "validFrom", "validUntil",
    "workspaceId"] };
/** What an entry shows in output: its workspace, or for a price its product version and the price label text. */
const subject = (request: PlatformOperationRequest) => request.kind === "price_publish"
  ? { productCode: request.productCode, version: request.version, priceNotice: PRICE_LABEL_TEXT[request.priceLabel] }
  : { workspaceId: request.workspaceId };
const MAX_ENTRIES = 500;
const invalid = (): never => { throw new PlatformOperationRefusal("platform_operation_input_invalid"); };
const sameKeys = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === keys.join(",");

/** Strict parse: closed fields only, each entry normalized, no operation key twice. */
export function parseOperationList(bytes: Buffer): PlatformOperationList {
  let raw: unknown;
  try { raw = JSON.parse(bytes.toString("utf8")); } catch { invalid(); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !sameKeys(raw, ["entries", "evidenceRef"])) invalid();
  const { evidenceRef, entries } = raw as { evidenceRef: unknown; entries: unknown };
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > MAX_ENTRIES) invalid();
  const keys = new Set<string>();
  const normalized = (entries as unknown[]).map(entry => {
    const kind = (entry as { kind?: unknown } | null)?.kind;
    if (!entry || typeof entry !== "object" || typeof kind !== "string" || !Object.hasOwn(FIELDS, kind) ||
        !sameKeys(entry, FIELDS[kind])) invalid();
    const op = normalizePlatformOperation(evidenceRef, entry as PlatformOperationRequest);
    if (keys.has(op.operationKey)) invalid();
    keys.add(op.operationKey);
    return op.request;
  });
  return { sha256: createHash("sha256").update(bytes).digest("hex"), evidenceRef: evidenceRef as string, entries: normalized };
}

export function parsePlatformBatchArgs(argv: readonly string[]): PlatformBatchArgs | { invalid: string } {
  const flags = new Set(["--apply", "--confirm-enforce"]);
  const known = new Set(["command", "list-file", "actor-user-id", "list-sha", "decision", "review-evidence-ref"]);
  const values = new Map<string, string>();
  for (const arg of argv) {
    if (flags.has(arg)) { if (values.has(arg)) return { invalid: "duplicate_argument" }; values.set(arg, ""); continue; }
    const match = /^--([a-z-]+)=([^\n]*)$/u.exec(arg);
    if (!match || !known.has(match[1])) return { invalid: "unknown_argument" };
    if (values.has(match[1])) return { invalid: "duplicate_argument" };
    values.set(match[1], match[2]);
  }
  const command = values.get("command"), listFile = values.get("list-file"), actorUserId = values.get("actor-user-id");
  if ((command !== "draft" && command !== "review") || !listFile || !actorUserId) return { invalid: "missing_argument" };
  const decision = values.get("decision") ?? null, reviewEvidenceRef = values.get("review-evidence-ref") ?? null;
  if (command === "review" ? (decision !== "approve" && decision !== "reject") || !reviewEvidenceRef
    : decision !== null || reviewEvidenceRef !== null) return { invalid: "review_arguments_invalid" };
  const apply = values.has("--apply"), listSha = values.get("list-sha") ?? null;
  if (apply !== (listSha !== null)) return { invalid: "apply_requires_list_sha" };
  return { command, listFile, actorUserId, apply, listSha, decision: decision as PlatformBatchArgs["decision"], reviewEvidenceRef,
    confirmEnforce: values.has("--confirm-enforce") };
}

/** Dry-run basis for grant limits: how many meter units each limit covers at the referenced price (null until it is published). */
async function limitUnits(client: PrismaClient, request: Extract<PlatformOperationRequest, { kind: "spend_grant" }>) {
  const product = await client.billingProduct.findUnique({ where: { code: request.productCode }, select: { id: true } });
  const price = product && await client.billingPriceVersion.findFirst({ where: { productId: product.id, version: request.priceVersion },
    select: { meterUnit: true, unitPriceFenNumerator: true, unitPriceDenominator: true } });
  if (!price) return { limitUnits: null };
  const units = (fen: string) => (BigInt(fen) * price.unitPriceDenominator / price.unitPriceFenNumerator).toString();
  return { limitUnits: { meterUnit: price.meterUnit, perCharge: units(request.perChargeLimitFen), daily: units(request.dailyLimitFen),
    monthly: units(request.monthlyLimitFen) } };
}

export async function runPlatformBatch(client: PrismaClient, args: PlatformBatchArgs, list: PlatformOperationList) {
  const enforce = list.entries.some(entry => entry.kind === "billing_mode" && entry.toMode === "enforce");
  const base = { command: args.command, listSha: list.sha256, evidenceRef: list.evidenceRef, entries: list.entries.length,
    // Switching to enforce is not enablement: real charging has separate prerequisites (BILLING_PLATFORM_OPERATIONS.md).
    enforceNotEnablement: enforce };
  if (!args.apply) {
    const plan = [];
    for (const [index, request] of list.entries.entries()) {
      const { operationKey } = normalizePlatformOperation(list.evidenceRef, request);
      const operation = await client.platformBillingOperation.findUnique({ where: { operationKey }, select: { state: true } });
      const binding = request.kind === "price_publish" ? null : await client.payerScopeBinding.findFirst({
        where: { scopeKind: "workspace", activeScopeRef: request.workspaceId }, select: { payerAccountId: true } });
      const payer = binding && await client.payerAccount.findUnique({ where: { id: binding.payerAccountId }, select: { billingMode: true } });
      plan.push({ index, ...request, ...subject(request), ...(request.kind === "spend_grant" ? await limitUnits(client, request) : {}), operationKey, operationState: operation?.state ?? null, currentMode: payer?.billingMode ?? null });
    }
    return { ok: true, applied: false, ...base, plan };
  }
  if (args.listSha !== list.sha256) return { ok: false, applied: false, ...base, code: "list_sha_mismatch" };
  const results = [];
  for (const [index, request] of list.entries.entries()) {
    const common = { actorUserId: args.actorUserId, evidenceRef: list.evidenceRef, request, confirmEnforce: args.confirmEnforce,
      batchRef: `list-sha256:${list.sha256}` };
    try {
      const { operation, replayed } = args.command === "draft" ? await draftPlatformOperation(client, common)
        : await reviewPlatformOperation(client, { ...common, decision: args.decision!, reviewEvidenceRef: args.reviewEvidenceRef! });
      results.push({ index, ...subject(request), operationId: operation.id, state: operation.state, replayed });
    } catch (error) {
      const code = error instanceof PlatformOperationRefusal || error instanceof SpendGrantRefusal ? error.code : "unavailable";
      return { ok: false, applied: true, ...base, results, stoppedAt: { index, ...subject(request), code } };
    }
  }
  return { ok: true, applied: true, ...base, results };
}
