import "server-only";
import { createPublicKey, type KeyObject } from "node:crypto";
import { parseArgs } from "node:util";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  BILLING_SERVICE_GRANT_ID_PATTERN, billingServiceGrantHash, billingServiceGrantPublicKey,
  billingServiceGrantScopes, billingServiceKeyFingerprint, type BillingServiceGrantRow,
} from "./service-auth";

/**
 * Billing V1 E1c: operator issuance and one-way revocation of BillingServiceGrant rows (docs/operations/
 * BILLING_INTERNAL_ROUTES.md "Issuance, rotation and revocation"). The row and its pin come from the same hash the request
 * verifier uses (`billingServiceGrantHash`), so a dry run prints exactly the pin the applied row will need. Only a public key
 * is ever read; a file naming a private key is refused before parsing, and one that is not exactly one canonical Ed25519
 * public PEM block (CRLF and surrounding whitespace aside) is refused after. No route or server action may
 * import this module.
 */
export type GrantOperatorRefusal = "usage" | "input_invalid" | "public_key_invalid" | "grant_conflict" | "grant_unknown" |
  "readback_mismatch";
export class GrantOperatorRefused extends Error {
  constructor(readonly code: GrantOperatorRefusal) { super(code); this.name = "GrantOperatorRefused"; }
}
function refuse(code: GrantOperatorRefusal): never { throw new GrantOperatorRefused(code); }

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,190}$/; // approvalRef / createdBy / revokedBy, VARCHAR(191)
const ISSUER = /^[a-z0-9][a-z0-9._-]{0,63}$/; // BillingServiceGrant_issuer CHECK
// Explicit UTC millisecond instants: DATETIME(3) round-trips them exactly, so the dry-run hash is the stored row's hash.
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const MAX_PUBLIC_KEY_FILE_BYTES = 4096;

export type GrantIssueInput = { grantId: string; issuerRef: string; scopes: readonly string[]; publicKeyText: string;
  approvalRef: string; createdBy: string; validFrom: string; validUntil: string };
export type IssuedGrantRow = Omit<BillingServiceGrantRow, "revokedAt">;

function instant(value: string): Date {
  const at = new Date(value);
  if (!INSTANT.test(value) || Number.isNaN(at.getTime()) || at.toISOString() !== value) refuse("input_invalid");
  return at;
}
function ed25519PublicKey(text: string): KeyObject {
  // createPublicKey would silently derive a public key from a private PEM: refuse anything else before parsing.
  if (text.includes("PRIVATE KEY") || !text.trimStart().startsWith("-----BEGIN PUBLIC KEY-----") ||
      text.split("-----BEGIN ").length !== 2) refuse("public_key_invalid");
  let key: KeyObject;
  try { key = createPublicKey(text.trim()); } catch { return refuse("public_key_invalid"); }
  if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") refuse("public_key_invalid");
  // The file must be exactly this one canonical block (CRLF and surrounding whitespace aside): nothing else rides along.
  if (text.replaceAll("\r\n", "\n").trim() !== key.export({ type: "spki", format: "pem" }).toString().trim()) {
    refuse("public_key_invalid");
  }
  return key;
}

/** Pure: validates the input and returns the exact row to insert plus its pin entry. */
export function buildBillingServiceGrant(input: GrantIssueInput): { row: IssuedGrantRow; pin: Record<string, string> } {
  if (!BILLING_SERVICE_GRANT_ID_PATTERN.test(input.grantId) || !ISSUER.test(input.issuerRef) ||
      !REF.test(input.approvalRef) || !REF.test(input.createdBy)) refuse("input_invalid");
  const scopes = [...new Set(input.scopes)].sort();
  const scopesJson = JSON.stringify(scopes);
  if (scopes.length !== input.scopes.length || billingServiceGrantScopes(scopesJson).length !== scopes.length ||
      scopes.length === 0 || (scopes.includes("resolve-unknown") && scopes.length > 1)) refuse("input_invalid");
  const validFrom = instant(input.validFrom), validUntil = instant(input.validUntil);
  if (validFrom >= validUntil) refuse("input_invalid");
  const key = ed25519PublicKey(input.publicKeyText);
  const content = { id: input.grantId, issuerRef: input.issuerRef, scopesJson,
    publicKeyPem: key.export({ type: "spki", format: "pem" }).toString(), keyFingerprint: billingServiceKeyFingerprint(key),
    approvalRef: input.approvalRef, createdBy: input.createdBy, validFrom, validUntil };
  try { billingServiceGrantPublicKey(content); } catch { refuse("public_key_invalid"); } // the verifier's check, stored form
  const row = { ...content, contentHash: billingServiceGrantHash(content) };
  return { row, pin: { [row.id]: row.contentHash } };
}

const isDuplicate = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010" &&
  String((error.meta as { code?: unknown } | undefined)?.code) === "1062";

/** Inserts the row and re-reads it inside one transaction; a readback whose hash differs rolls back. Re-running the same
 * issuance replays; a different row under the same id or key fingerprint is `grant_conflict`. */
export async function issueBillingServiceGrant(client: PrismaClient, row: IssuedGrantRow) {
  // Looked up first so a replay or conflict needs no failing INSERT; the unique keys still decide a concurrent race.
  const existing = () => client.$queryRaw<Array<{ id: string; contentHash: string; revokedAt: Date | null }>>`SELECT id,
    contentHash, revokedAt FROM BillingServiceGrant WHERE id = ${row.id} OR keyFingerprint = ${row.keyFingerprint}`;
  const replay = (rows: Array<{ id: string; contentHash: string; revokedAt: Date | null }>) => {
    if (rows.length !== 1 || rows[0].id !== row.id || rows[0].contentHash !== row.contentHash) refuse("grant_conflict");
    return { alreadyIssued: true, revoked: rows[0].revokedAt !== null };
  };
  const prior = await existing();
  if (prior.length) return replay(prior);
  try {
    await client.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO BillingServiceGrant (id, issuerRef, scopesJson, publicKeyPem, keyFingerprint, approvalRef,
        createdBy, contentHash, validFrom, validUntil) VALUES (${row.id}, ${row.issuerRef}, ${row.scopesJson}, ${row.publicKeyPem},
        ${row.keyFingerprint}, ${row.approvalRef}, ${row.createdBy}, ${row.contentHash}, ${row.validFrom}, ${row.validUntil})`;
      const [stored] = await tx.$queryRaw<BillingServiceGrantRow[]>`SELECT id, issuerRef, scopesJson, publicKeyPem, keyFingerprint,
        approvalRef, createdBy, contentHash, validFrom, validUntil, revokedAt FROM BillingServiceGrant WHERE id = ${row.id}`;
      if (!stored || stored.contentHash !== row.contentHash || billingServiceGrantHash(stored) !== row.contentHash) refuse("readback_mismatch");
    }, { maxWait: 5000, timeout: 10000 });
    return { alreadyIssued: false, revoked: false };
  } catch (error) {
    if (!isDuplicate(error)) throw error;
  }
  return replay(await existing());
}

/** One-way revocation with database time; dry run only reads. Revoking a revoked grant changes nothing. */
export async function revokeBillingServiceGrant(client: PrismaClient, input: { grantId: string; revokedBy: string; apply: boolean }) {
  if (!BILLING_SERVICE_GRANT_ID_PATTERN.test(input.grantId) || !REF.test(input.revokedBy)) refuse("input_invalid");
  const read = async () => (await client.$queryRaw<Array<{ revokedAt: Date | null; revokedBy: string | null }>>`SELECT revokedAt,
    revokedBy FROM BillingServiceGrant WHERE id = ${input.grantId}`)[0] ?? refuse("grant_unknown");
  const before = await read();
  if (before.revokedAt !== null || !input.apply) return { applied: false, alreadyRevoked: before.revokedAt !== null, ...before };
  const changed = await client.$executeRaw`UPDATE BillingServiceGrant SET revokedAt = UTC_TIMESTAMP(3), revokedBy = ${input.revokedBy}
    WHERE id = ${input.grantId} AND revokedAt IS NULL`;
  return { applied: changed === 1, alreadyRevoked: changed === 0, ...(await read()) };
}

export type GrantCliArgs =
  | { operation: "issue"; apply: boolean; publicKeyFile: string; input: Omit<GrantIssueInput, "publicKeyText"> }
  | { operation: "revoke"; apply: boolean; grantId: string; revokedBy: string };
export function parseBillingServiceGrantArgs(argv: readonly string[]): GrantCliArgs {
  const string = { type: "string" } as const;
  const options = { "grant-id": string, issuer: string, scopes: string, "public-key-file": string, "approval-ref": string,
    "created-by": string, "valid-from": string, "valid-until": string, "revoked-by": string, apply: { type: "boolean" } } as const;
  let parsed;
  try { parsed = parseArgs({ args: [...argv], allowPositionals: true, strict: true, options }); } catch { return refuse("usage"); }
  const { positionals: [operation, ...rest], values: v } = parsed;
  const text = (name: Exclude<keyof typeof options, "apply">) => {
    const value = v[name]; return typeof value === "string" ? value : refuse("usage");
  };
  const apply = v.apply === true;
  if (rest.length) refuse("usage");
  if (operation === "revoke") return { operation, apply, grantId: text("grant-id"), revokedBy: text("revoked-by") };
  if (operation !== "issue" || v["revoked-by"] !== undefined) refuse("usage");
  return { operation, apply, publicKeyFile: text("public-key-file"), input: { grantId: text("grant-id"), issuerRef: text("issuer"),
    scopes: text("scopes").split(","), approvalRef: text("approval-ref"), createdBy: text("created-by"),
    validFrom: text("valid-from"), validUntil: text("valid-until") } };
}
