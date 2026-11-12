#!/usr/bin/env tsx

/**
 * Operator CLI for BillingServiceGrant rows (docs/operations/BILLING_INTERNAL_ROUTES.md). Dry run by default; pass --apply to
 * write. Only the caller's Ed25519 public key file is read; the private key never enters this command.
 *
 *   npm run billing:service-grant -- issue --grant-id=<id> --issuer=<issuerRef> --scopes=quote,release,reserve,settle \
 *     --public-key-file=<public.pem> --approval-ref=<ref> --created-by=<ref> \
 *     --valid-from=2026-01-01T00:00:00.000Z --valid-until=2027-01-01T00:00:00.000Z [--apply]
 *   npm run billing:service-grant -- revoke --grant-id=<id> --revoked-by=<ref> [--apply]
 *
 * Output is one JSON line; refusals print a fixed code only (never file contents) and exit 1 (2 for usage).
 */

import { closeSync, fstatSync, openSync, readFileSync } from "node:fs";

import {
  buildBillingServiceGrant, GrantOperatorRefused, issueBillingServiceGrant, MAX_PUBLIC_KEY_FILE_BYTES,
  parseBillingServiceGrantArgs, revokeBillingServiceGrant,
} from "@/lib/billing/internal/service-grant-issuance";

function readPublicKeyFile(path: string): string {
  let fd: number;
  try { fd = openSync(path, "r"); } catch { throw new GrantOperatorRefused("public_key_invalid"); }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > MAX_PUBLIC_KEY_FILE_BYTES) throw new GrantOperatorRefused("public_key_invalid");
    return readFileSync(fd, "utf8");
  } finally { closeSync(fd); }
}

async function main(): Promise<number> {
  const args = parseBillingServiceGrantArgs(process.argv.slice(2));
  if (args.operation === "issue") {
    const { row, pin } = buildBillingServiceGrant({ ...args.input, publicKeyText: readPublicKeyFile(args.publicKeyFile) });
    const printable = { ...row, validFrom: row.validFrom.toISOString(), validUntil: row.validUntil.toISOString() };
    if (!args.apply) {
      console.log(JSON.stringify({ operation: "issue", applied: false, row: printable, contentHash: row.contentHash, pin }));
      return 0;
    }
    const { db } = await import("@/lib/db"); // dry runs never open a database connection
    try {
      const result = await issueBillingServiceGrant(db, row);
      console.log(JSON.stringify({ operation: "issue", applied: !result.alreadyIssued, ...result, row: printable,
        contentHash: row.contentHash, pin }));
    } finally { await db.$disconnect(); }
    return 0;
  }
  const { db } = await import("@/lib/db");
  try {
    const result = await revokeBillingServiceGrant(db, args);
    console.log(JSON.stringify({ operation: "revoke", grantId: args.grantId, ...result }));
  } finally { await db.$disconnect(); }
  return 0;
}

main().then(code => { process.exitCode = code; }).catch((error: unknown) => {
  const code = error instanceof GrantOperatorRefused ? error.code : "unavailable";
  console.error(JSON.stringify({ ok: false, code }));
  process.exitCode = code === "usage" ? 2 : 1;
});
