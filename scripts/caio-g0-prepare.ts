#!/usr/bin/env tsx

/**
 * Controlled CLI: prepare CAIO G0 initialization inputs from live quick-check observation.
 * Validates only by default; pass --apply to write the artifacts and initialization receipts.
 *
 *   npm run caio:g0-prepare -- --workspace-id=<id> --actor-user-id=<id> [--apply]
 *
 * Output is one JSON line; exit code 1 on refusal, 2 on usage errors.
 */

import { prepareCaioG0FromLiveObservation } from "@/lib/caio-operating-context/g0-preparation.service";
import { db } from "@/lib/db";

function parseArgs(argv: readonly string[]) {
  const known = new Set(["workspace-id", "actor-user-id"]);
  const values = new Map<string, string>();
  let apply = false;
  for (const arg of argv) {
    if (arg === "--apply") {
      if (apply) return null;
      apply = true;
      continue;
    }
    const match = /^--([a-z-]+)=(.+)$/u.exec(arg);
    if (!match || !known.has(match[1]) || values.has(match[1])) return null;
    values.set(match[1], match[2].trim());
  }
  const workspaceId = values.get("workspace-id");
  const actorUserId = values.get("actor-user-id");
  return workspaceId && actorUserId ? { workspaceId, actorUserId, apply } : null;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(JSON.stringify({ ok: false, code: "usage" }));
    return 2;
  }
  const actor = await db.user.findUnique({ where: { id: args.actorUserId }, select: { name: true } });
  const result = await prepareCaioG0FromLiveObservation({
    workspaceId: args.workspaceId,
    actorUserId: args.actorUserId,
    actorName: actor?.name ?? "caio-g0-prepare",
    apply: args.apply,
  });
  console.log(JSON.stringify({ applied: args.apply && result.ok, ...result }));
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
