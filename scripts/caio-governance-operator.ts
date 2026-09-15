#!/usr/bin/env tsx

/**
 * Controlled CLI for CAIO governance records (principal bindings, mandate lifecycle, guardian stop,
 * CEO resume). Validates only by default; pass --apply to write.
 *
 *   npm run caio:governance-operator -- --template=<operation>
 *   npm run caio:governance-operator -- --operation=<operation> --workspace-id=<id> \
 *     --actor-user-id=<id> --input-file=<path.json> [--apply]
 *
 * Output is one JSON line with a closed result code or a whitelisted summary; exit code 1 on refusal.
 */

import { readFileSync } from "node:fs";

import {
  CAIO_GOVERNANCE_OPERATIONS,
  parseCaioGovernanceCliArgs,
  runCaioGovernanceOperation,
} from "@/lib/caio-operator/governance-operator";
import { db } from "@/lib/db";

async function main(): Promise<number> {
  const args = parseCaioGovernanceCliArgs(process.argv.slice(2));
  if (args.mode === "invalid") {
    console.error(JSON.stringify({ ok: false, code: "usage", reason: args.reason }));
    return 2;
  }
  if (args.mode === "template") {
    const { access, actor, template } = CAIO_GOVERNANCE_OPERATIONS[args.operation];
    console.log(JSON.stringify({ operation: args.operation, access, actor, template }, null, 2));
    return 0;
  }
  let rawInput: unknown;
  try {
    rawInput = JSON.parse(readFileSync(args.inputFile, "utf8"));
  } catch {
    console.error(JSON.stringify({ ok: false, code: "input_invalid", reason: "input_file_unreadable_or_not_json" }));
    return 1;
  }
  const result = await runCaioGovernanceOperation({
    operation: args.operation,
    workspaceId: args.workspaceId,
    actorUserId: args.actorUserId,
    rawInput,
    apply: args.apply,
  });
  console.log(JSON.stringify({ operation: args.operation, applied: args.apply && result.ok, ...result }));
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
