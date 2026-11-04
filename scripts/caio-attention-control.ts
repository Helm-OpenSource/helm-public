#!/usr/bin/env tsx
/**
 * CAIO attention Control CLI (operator identity; design v5 §1.2, v6 §1–2). Contract shared with the overlay deploy
 * script (its ATTENTION_CONTROL_CONTRACT):
 *
 *   argv:   exactly one op, nothing else.  Database: DATABASE_URL (the controlled operator identity).
 *   stdin:  one JSON object line whose key set equals the op's input keys exactly.
 *   stdout: one JSON object line (the result), or for `hold` the line READY once the barrier is held; the hold
 *           transaction stays open until stdin reaches EOF, then commits. Diagnostics go to stderr only.
 *   exit:   0 ok; 3 lease fenced (the lease is no longer the caller's); 4 refused; anything else failed.
 *
 * Deploy ops: deploy-begin, hold, deploy-end, deploy-recover (host-locked recovery entry only), guard-downgrade.
 * attest-node is refused until readiness proofs land (fail closed: no proof, so resume stays blocked).
 * Operator ops: pause, resume (acks every pause request of the current open epoch by id), expected-nodes.
 */
import { PrismaClient } from "@prisma/client";

import {
  CaioAttentionControlRefusal,
  beginCaioAttentionDeployment,
  downgradeCaioAttentionGuard,
  endCaioAttentionDeployment,
  holdCaioAttentionLease,
  pauseCaioAttentionIntake,
  recoverCaioAttentionDeployment,
  resumeCaioAttentionIntake,
  setCaioAttentionExpectedNodes,
} from "@/lib/caio-attention/control.service";

export const CAIO_ATTENTION_CONTROL_OPS = {
  "deploy-begin": ["nodeId", "targetDeploymentId"],
  hold: ["lease", "nodeId", "targetDeploymentId", "epoch", "phase"],
  "attest-node": ["lease", "nodeId", "targetDeploymentId", "epoch", "guardVersion"],
  "deploy-end": ["lease"],
  "deploy-recover": ["nodeId"],
  "guard-downgrade": ["nodeId", "fromGuardVersion", "toGuardVersion"],
  pause: ["actorRef"],
  resume: ["actorRef", "ackPauseRequestIds"],
  "expected-nodes": ["actorRef", "nodeIds"],
} as const satisfies Record<string, readonly string[]>;
type Op = keyof typeof CAIO_ATTENTION_CONTROL_OPS;

const EXIT = { ok: 0, failed: 1, usage: 2, fenced: 3, refused: 4 } as const;
const MAX_LINE = 65_536;

export function parseCaioAttentionControlRequest(op: string, line: string): Record<string, unknown> | null {
  if (!Object.hasOwn(CAIO_ATTENTION_CONTROL_OPS, op)) return null;
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const keys = Object.keys(value).sort();
  const expected = [...CAIO_ATTENTION_CONTROL_OPS[op as Op]].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]) ? value as Record<string, unknown> : null;
}

/** Reads the first stdin line; `ended` settles when stdin reaches EOF (the hold release signal). */
function readStdin(): { firstLine: Promise<string | null>; ended: Promise<void> } {
  let buffer = "";
  let resolveLine!: (line: string | null) => void;
  let resolveEnded!: () => void;
  const firstLine = new Promise<string | null>((resolve) => { resolveLine = resolve; });
  const ended = new Promise<void>((resolve) => { resolveEnded = resolve; });
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    if (buffer.length <= MAX_LINE) buffer += chunk;
    const newline = buffer.indexOf("\n");
    if (newline >= 0) resolveLine(buffer.slice(0, newline)); else if (buffer.length > MAX_LINE) resolveLine(null);
  });
  // A promise settles once; later resolves are no-ops. EOF without a newline still yields the (bounded) buffer.
  const finish = () => { resolveLine(buffer.length > 0 && buffer.length <= MAX_LINE ? buffer : null); resolveEnded(); };
  for (const event of ["end", "close", "error"]) process.stdin.on(event, finish);
  return { firstLine, ended };
}

async function run(op: Op, request: Record<string, unknown>, prisma: PrismaClient, stdinEnded: Promise<void>): Promise<object | null> {
  switch (op) {
    case "deploy-begin": return beginCaioAttentionDeployment(prisma, request as never);
    case "deploy-end": return endCaioAttentionDeployment(prisma, request as never);
    case "deploy-recover": return recoverCaioAttentionDeployment(prisma, request as never);
    case "guard-downgrade": return downgradeCaioAttentionGuard(prisma, request as never);
    case "pause": return pauseCaioAttentionIntake(prisma, request as never);
    case "resume": return resumeCaioAttentionIntake(prisma, request as never);
    case "expected-nodes": return setCaioAttentionExpectedNodes(prisma, request as never);
    case "attest-node": throw new CaioAttentionControlRefusal("attest_not_available");
    case "hold": {
      let ready = false;
      let endedEarly = false;
      void stdinEnded.then(() => { if (!ready) endedEarly = true; });
      await holdCaioAttentionLease(prisma, request as never, () => {
        if (endedEarly) throw new CaioAttentionControlRefusal("released_before_ready");
        ready = true;
        process.stdout.write("READY\n");
      }, stdinEnded);
      return null;
    }
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const op = args[0];
  if (args.length !== 1 || !op || !Object.hasOwn(CAIO_ATTENTION_CONTROL_OPS, op)) {
    process.stderr.write(`usage: caio-attention-control.ts <${Object.keys(CAIO_ATTENTION_CONTROL_OPS).join("|")}> < request.json\n`);
    return EXIT.usage;
  }
  const stdin = readStdin();
  const line = await stdin.firstLine;
  const request = line === null ? null : parseCaioAttentionControlRequest(op, line);
  if (!request) {
    process.stderr.write("caio-attention-control: request_invalid\n");
    return EXIT.refused;
  }
  const prisma = new PrismaClient();
  try {
    const result = await run(op as Op, request, prisma, stdin.ended);
    if (result !== null) process.stdout.write(`${JSON.stringify(result)}\n`);
    return EXIT.ok;
  } catch (error) {
    if (error instanceof CaioAttentionControlRefusal) {
      process.stderr.write(`caio-attention-control: ${error.fenced ? "fenced" : "refused"} ${error.code}\n`);
      return error.fenced ? EXIT.fenced : EXIT.refused;
    }
    process.stderr.write(`caio-attention-control: failed ${error instanceof Error ? error.name : "error"}\n`);
    return EXIT.failed;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && /caio-attention-control\.ts$/u.test(process.argv[1])) {
  void main().then((code) => process.exit(code));
}
