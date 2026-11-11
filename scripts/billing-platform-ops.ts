#!/usr/bin/env tsx

/**
 * Billing V1 E1a platform billing operations (maker drafts, a different checker reviews). Dry run by default; --apply needs the
 * --list-sha printed by the dry run. See docs/operations/BILLING_PLATFORM_OPERATIONS.md.
 *
 *   npm run billing:platform-ops -- --command=draft --list-file=<list.json> --actor-user-id=<maker> [--confirm-enforce] [--apply --list-sha=<sha256>]
 *   npm run billing:platform-ops -- --command=review --list-file=<list.json> --actor-user-id=<checker> --decision=approve|reject \
 *     --review-evidence-ref=<ref> [--confirm-enforce] [--apply --list-sha=<sha256>]
 *
 * Output is one JSON document with closed codes and ids only; exit code 1 on refusal, 2 on usage error.
 */

import { readFileSync } from "node:fs";

import { db } from "@/lib/db";
import { parseOperationList, parsePlatformBatchArgs, runPlatformBatch } from "@/lib/billing/platform/platform-batch";

async function main(): Promise<number> {
  const args = parsePlatformBatchArgs(process.argv.slice(2));
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
