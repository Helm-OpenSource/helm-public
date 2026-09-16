#!/usr/bin/env tsx

/**
 * Controlled CLI for pull inference access material. Validates only by default; pass --apply to write.
 *
 *   npm run caio:inference-token -- --template=issue
 *   npm run caio:inference-token -- --operation=issue --workspace-id=<id> --actor-user-id=<id> \
 *     --input-file=<path.json> [--apply]
 *   npm run caio:inference-token -- --operation=list --workspace-id=<id> --actor-user-id=<id>
 *
 * The issued material is printed exactly once, on its own line, and is never stored by this tool. Hand it to
 * the device directly; if it is lost, revoke the token and issue a new one.
 */

import { readFileSync } from "node:fs";

import {
  CAIO_INFERENCE_TOKEN_TEMPLATES,
  parseCaioInferenceTokenCliArgs,
  runCaioInferenceTokenOperation,
} from "@/lib/caio-operator/inference-token-operator";
import { db } from "@/lib/db";

async function main(): Promise<number> {
  const args = parseCaioInferenceTokenCliArgs(process.argv.slice(2));
  if (args.mode === "invalid") {
    console.error(JSON.stringify({ ok: false, code: "usage", reason: args.reason }));
    return 2;
  }
  if (args.mode === "template") {
    console.log(
      JSON.stringify(
        { operation: args.operation, template: CAIO_INFERENCE_TOKEN_TEMPLATES[args.operation] },
        null,
        2,
      ),
    );
    return 0;
  }
  let rawInput: unknown = {};
  if (args.inputFile) {
    try {
      rawInput = JSON.parse(readFileSync(args.inputFile, "utf8"));
    } catch {
      console.error(JSON.stringify({ ok: false, code: "input_invalid", reason: "input_file_unreadable_or_not_json" }));
      return 1;
    }
  }
  const result = await runCaioInferenceTokenOperation({
    operation: args.operation,
    workspaceId: args.workspaceId,
    actorUserId: args.actorUserId,
    rawInput,
    apply: args.apply,
  });
  if (!result.ok) {
    console.log(JSON.stringify({ operation: args.operation, ok: false, code: result.code }));
    return 1;
  }
  const { rawToken, ...printable } = result;
  console.log(JSON.stringify({ operation: args.operation, ...printable }));
  if (rawToken) {
    // Separate line, no JSON wrapper, no repetition: the operator copies it once and this process forgets it.
    console.log(`ACCESS MATERIAL (shown once, hand it to the device and do not store it): ${rawToken}`);
  }
  return 0;
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
