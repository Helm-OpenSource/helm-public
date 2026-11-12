#!/usr/bin/env tsx

/**
 * Operator CLI for platform finance roles (maker / checker). Reads by default; pass --apply to write. Runbook:
 * docs/operations/BILLING_BANK_RECEIPTS.md ("Granting finance roles").
 *
 *   npm run billing:finance-grant -- list [--user-id=<id>] [--include-revoked=true]
 *   npm run billing:finance-grant -- grant --actor-user-id=<owner> --user-id=<id> --role=maker|checker --evidence-ref=<ref> [--apply]
 *   npm run billing:finance-grant -- revoke --actor-user-id=<owner> --grant-id=<id> --expected-version=<n> --evidence-ref=<ref> [--apply]
 *
 * Output is one JSON document; exit 0 ok, 1 refusal, 2 usage.
 */

import { runFinanceGrantOperator } from "@/lib/billing/bank-receipts/finance-grant-operator";
import { db } from "@/lib/db";

runFinanceGrantOperator(db, process.argv.slice(2))
  .then(({ exitCode, output }) => {
    (exitCode === 0 ? console.log : console.error)(JSON.stringify(output, null, 2));
    process.exitCode = exitCode;
  })
  .catch(() => {
    console.error(JSON.stringify({ ok: false, code: "unavailable" }));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
