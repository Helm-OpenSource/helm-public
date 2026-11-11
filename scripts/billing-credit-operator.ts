#!/usr/bin/env tsx

/**
 * Operator CLI for billing credit facilities (授信). Reads by default; pass --apply to write. Runbook and flags:
 * docs/operations/BILLING_CREDIT_FACILITIES.md ("Operations").
 *
 *   npm run billing:credit-operator -- show --workspace-id=<id>
 *   npm run billing:credit-operator -- batch --list-file=<list.json> [--maker-user-id=<id> --checker-user-id=<id>]
 *   npm run billing:credit-operator -- batch --list-file=<list.json> --step=propose|approve|activate \
 *     --actor-user-id=<id> --expect-list-sha=<sha256> --apply
 *
 * Output is one JSON document; exit 0 ok, 1 refusal or any failed/blocked entry in an --apply run, 2 usage.
 */

import { readFileSync } from "node:fs";

import { runCreditOperator, toJson } from "@/lib/billing/credit/credit-operator";
import { db } from "@/lib/db";

runCreditOperator(db, process.argv.slice(2), path => readFileSync(path))
  .then(({ exitCode, output }) => {
    (exitCode === 0 ? console.log : console.error)(toJson(output));
    process.exitCode = exitCode;
  })
  .catch(() => {
    console.error(JSON.stringify({ ok: false, code: "unavailable" }));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
