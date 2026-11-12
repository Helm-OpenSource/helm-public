#!/usr/bin/env tsx

/**
 * Operator CLI for top-up payment exceptions (未处理的充值对账异常). Reads by default; pass --apply to write or to query the provider.
 * Runbook: docs/operations/BILLING_TOPUP_ORDERS.md ("Payment exceptions: who handles them").
 *
 *   npm run billing:topup-exceptions -- list [--all] [--limit=<n>]
 *   npm run billing:topup-exceptions -- ack --key=<key> --actor-user-id=<id> --note=<text> [--apply]
 *   npm run billing:topup-exceptions -- reverify --order-id=<id> [--apply]
 *
 * Output is one JSON document; exit 0 ok, 1 refusal, 2 usage.
 */

import { runTopupExceptionsOperator, toJson } from "@/lib/billing/topup/topup-exceptions-operator";
import { db } from "@/lib/db";

runTopupExceptionsOperator(db, process.argv.slice(2))
  .then(({ exitCode, output }) => {
    (exitCode === 0 ? console.log : console.error)(toJson(output));
    process.exitCode = exitCode;
  })
  .catch(() => {
    console.error(JSON.stringify({ ok: false, code: "unavailable" }));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
