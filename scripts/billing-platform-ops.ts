#!/usr/bin/env tsx

/**
 * Billing V1 platform billing operations (maker drafts, a different checker reviews); docs/operations/BILLING_PLATFORM_OPERATIONS.md.
 *   npm run billing:platform-ops -- --command=draft --list-file=<list.json> --actor-user-id=<maker> [--confirm-enforce] [--apply --list-sha=<sha256>]
 *   npm run billing:platform-ops -- --command=review --list-file=<list.json> --actor-user-id=<checker> --decision=approve|reject \
 *     --review-evidence-ref=<ref> [--confirm-enforce] [--apply --list-sha=<sha256>]
 *   Emergency (one person, enforce -> shadow only; a different checker confirms within 24 hours):
 *   npm run billing:platform-ops -- --command=emergency-rollback --workspace-id=<id> --actor-user-id=<id> --evidence-ref=<ref> [--apply]
 *   npm run billing:platform-ops -- --command=confirm-rollback --rollback-id=<id> --actor-user-id=<checker> --evidence-ref=<ref> [--apply]
 *   npm run billing:platform-ops -- --command=pending-rollbacks   (exit code 3 when any review is overdue)
 *
 * Output is one JSON document with closed codes and ids only; exit code 1 on refusal, 2 on usage error.
 */

import { readFileSync } from "node:fs";

import { db } from "@/lib/db";
import { parseOperationList, parsePlatformBatchArgs, runPlatformBatch } from "@/lib/billing/platform/platform-batch";
import { EMERGENCY_COMMANDS, parseEmergencyArgs, runEmergencyCommand } from "@/lib/billing/platform/platform-emergency";

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (EMERGENCY_COMMANDS.some(command => argv.includes(`--command=${command}`))) {
    const emergency = parseEmergencyArgs(argv);
    if ("invalid" in emergency) {
      console.error(JSON.stringify({ ok: false, code: "usage", reason: emergency.invalid }));
      return 2;
    }
    const result = await runEmergencyCommand(db, emergency);
    console.log(JSON.stringify(result, null, 2));
    if ("alert" in result && result.alert) console.error(JSON.stringify({ alert: result.alert })); // overdue second-person review
    return !result.ok ? 1 : "alert" in result && result.alert ? 3 : 0;
  }
  const args = parsePlatformBatchArgs(argv);
  if ("invalid" in args) {
    console.error(JSON.stringify({ ok: false, code: "usage", reason: args.invalid }));
    return 2;
  }
  let list;
  try {
    list = parseOperationList(readFileSync(args.listFile));
  } catch {
    console.error(JSON.stringify({ ok: false, code: "list_invalid" }));
    return 1;
  }
  const result = await runPlatformBatch(db, args, list);
  console.log(JSON.stringify(result, null, 2));
  return result.ok ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch(() => {
    console.error(JSON.stringify({ ok: false, code: "unavailable" }));
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
