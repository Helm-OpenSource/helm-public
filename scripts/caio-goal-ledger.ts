#!/usr/bin/env tsx

/**
 * Controlled CLI for the CAIO goal ledger: append one entry or import a chain. Validates only by default; pass
 * --apply to write. --actor-user-id is declared by whoever runs the command, not authenticated.
 *
 *   npm run caio:goal-ledger -- --template=<appendEntry|importChain>
 *   npm run caio:goal-ledger -- --operation=<appendEntry|importChain> --workspace-id=<id> \
 *     --actor-user-id=<id> --input-file=<path.json> [--apply] [--english]
 *   npm run caio:goal-ledger -- --verify --workspace-id=<id>
 *
 * The result is the last line of stdout, one JSON object (the template is printed for editing); a usage error, a
 * refused input file and an unexpected failure print it to stderr instead, and stdout then has no result line. When
 * the database layer fails, the database client first prints lines of its own error log to stdout; those may carry
 * local paths, the database user and table names, never the owner's words or the document. Exit code 0 on success, 1 on refusal
 * with a closed code, 2 on a usage error, 3 when --verify finds the ledger rejected or unavailable.
 */

import {
  CAIO_GOAL_LEDGER_OPERATIONS,
  parseCaioGoalLedgerCliArgs,
  readCaioGoalLedgerInputFile,
  runCaioGoalLedgerOperation,
  verifyCaioGoalLedger,
} from "@/lib/caio-operator/goal-ledger-operator";
import { db } from "@/lib/db";

async function main(): Promise<number> {
  const args = parseCaioGoalLedgerCliArgs(process.argv.slice(2));
  if (args.mode === "invalid") {
    console.error(JSON.stringify({ ok: false, code: "usage", reason: args.reason }));
    return 2;
  }
  if (args.mode === "template") {
    const { template } = CAIO_GOAL_LEDGER_OPERATIONS[args.operation];
    console.log(JSON.stringify({ operation: args.operation, access: "owner", actor: "owner", template }, null, 2));
    return 0;
  }
  if (args.mode === "verify") {
    const { exitCode, output } = await verifyCaioGoalLedger(args.workspaceId);
    console.log(JSON.stringify(output));
    return exitCode;
  }
  const input = readCaioGoalLedgerInputFile(args.inputFile);
  if (!input.ok) {
    console.error(JSON.stringify({ ok: false, code: "input_invalid", reason: input.reason }));
    return 1;
  }
  const result = await runCaioGoalLedgerOperation({
    operation: args.operation,
    workspaceId: args.workspaceId,
    actorUserId: args.actorUserId,
    rawInput: input.rawInput,
    apply: args.apply,
    english: args.english,
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
