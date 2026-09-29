#!/usr/bin/env tsx

/**
 * Controlled CLI: registers member responses to CAIO prompts that the member MCP
 * recorded in MemberPromptResponseInbox (asynchronous registration, owner ruling
 * 2026-09-29). It is the only entry point to lib/member-mcp/response-processor,
 * which reaches lib/caio-governance and therefore may not run behind an app route.
 *
 *   npm run member:prompt-response-worker -- --once            # one pass (host timer, every minute)
 *   npm run member:prompt-response-worker -- --once --dry-run  # list what would be processed
 *   npm run member:prompt-response-worker -- --workspace=<id>  # loop every 60 s for one workspace
 *
 * Off unless HELM_MEMBER_MCP_ENABLED=true; per workspace it also requires featureFlags.memberMcp.
 * Prints one JSON summary line per pass. Exit codes: 0 ok / disabled, 2 usage, 1 failure.
 */

import { db } from "@/lib/db";
import { runMemberPromptResponseProcessor } from "@/lib/member-mcp/response-processor";

type Args = { once: boolean; dryRun: boolean; workspaceId: string | null; intervalMs: number };

function parseArgs(argv: readonly string[]): Args | { error: string } {
  const args: Args = { once: false, dryRun: false, workspaceId: null, intervalMs: 60_000 };
  for (const arg of argv) {
    if (arg === "--once") args.once = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--workspace=")) {
      const value = arg.slice("--workspace=".length);
      if (!/^[A-Za-z0-9_-]{1,191}$/.test(value)) return { error: "bad --workspace" };
      args.workspaceId = value;
    } else if (arg.startsWith("--interval-seconds=")) {
      const seconds = Number(arg.slice("--interval-seconds=".length));
      if (!Number.isInteger(seconds) || seconds < 10 || seconds > 3600) return { error: "bad --interval-seconds" };
      args.intervalMs = seconds * 1000;
    } else return { error: `unknown argument ${arg}` };
  }
  return args;
}

async function pass(args: Args): Promise<void> {
  const summary = await runMemberPromptResponseProcessor({ workspaceId: args.workspaceId, dryRun: args.dryRun });
  console.log(JSON.stringify({ ok: true, at: new Date().toISOString(), ...summary }));
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(JSON.stringify({ ok: false, code: "usage", reason: args.error }));
    return 2;
  }
  if (process.env.HELM_MEMBER_MCP_ENABLED !== "true") {
    console.log(JSON.stringify({ ok: true, code: "disabled", reason: "HELM_MEMBER_MCP_ENABLED is not true" }));
    return 0;
  }
  if (args.once) {
    await pass(args);
    return 0;
  }
  let stopping = false;
  process.on("SIGTERM", () => (stopping = true));
  process.on("SIGINT", () => (stopping = true));
  while (!stopping) {
    try {
      await pass(args);
    } catch (error) {
      console.error(JSON.stringify({ ok: false, code: "pass_failed", reason: error instanceof Error ? error.message : String(error) }));
    }
    await new Promise((resolve) => setTimeout(resolve, args.intervalMs));
  }
  return 0;
}

main()
  .then(async (code) => {
    await db.$disconnect();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error(JSON.stringify({ ok: false, code: "failed", reason: error instanceof Error ? error.message : String(error) }));
    await db.$disconnect();
    process.exit(1);
  });
