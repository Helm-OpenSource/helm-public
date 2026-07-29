/**
 * caio-connect thin bin wrapper — parseArgs-based, pure over an injected
 * dispatcher; maps result status to exit codes (0 ok / 2 failed / 3 blocked)
 * and supports --json. Never calls process.exit itself; the packaging layer's
 * launcher assigns process.exitCode from the returned value. All output runs
 * through the shared redaction helper so tokens can never be echoed.
 */

import { parseArgs } from "node:util";

import { deepRedact, redactArgv, redactText } from "@/tools/caio-admin/redaction";

export const CAIO_CONNECT_COMMANDS = ["pair", "write-config", "manifest-check"] as const;
export type CaioConnectCommand = (typeof CAIO_CONNECT_COMMANDS)[number];

export const CONNECT_EXIT_OK = 0;
export const CONNECT_EXIT_FAILED = 2;
export const CONNECT_EXIT_BLOCKED = 3;

export interface ConnectCliResult {
  command: string;
  status: "ok" | "blocked" | "failed";
  blockedReason?: string;
  detail?: Record<string, unknown>;
}

export interface ConnectCliInvocation {
  command: CaioConnectCommand;
  json: boolean;
  positionals: string[];
  values: Record<string, string | boolean | undefined>;
}

export type ConnectDispatch = (invocation: ConnectCliInvocation) => Promise<ConnectCliResult>;

export interface ConnectCliDeps {
  dispatch: ConnectDispatch;
  stdout(text: string): void;
  stderr(text: string): void;
}

export function connectUsage(): string {
  return `usage: caio-connect <${CAIO_CONNECT_COMMANDS.join("|")}> [options] [--json]`;
}

export function connectExitCode(result: ConnectCliResult): number {
  if (result.status === "ok") return CONNECT_EXIT_OK;
  if (result.status === "blocked") return CONNECT_EXIT_BLOCKED;
  return CONNECT_EXIT_FAILED;
}

export function renderConnectResult(result: ConnectCliResult, json: boolean): string {
  const scrubbed = deepRedact(result);
  if (json) return JSON.stringify(scrubbed, null, 2);
  const lines = [`command: ${scrubbed.command}`, `status: ${scrubbed.status}`];
  if (scrubbed.blockedReason) lines.push(`reason: ${scrubbed.blockedReason}`);
  if (scrubbed.detail && Object.keys(scrubbed.detail).length > 0) {
    lines.push(`detail: ${JSON.stringify(scrubbed.detail)}`);
  }
  return lines.join("\n");
}

export async function runCaioConnectCli(
  argv: readonly string[],
  deps: ConnectCliDeps,
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      strict: false,
      options: {
        json: { type: "boolean", default: false },
      },
    });
  } catch (error) {
    deps.stderr(redactText(error instanceof Error ? error.message : "argument parse error"));
    deps.stderr(connectUsage());
    return CONNECT_EXIT_FAILED;
  }

  const [command, ...rest] = parsed.positionals;
  if (!command || !(CAIO_CONNECT_COMMANDS as readonly string[]).includes(command)) {
    deps.stderr(`unknown command: ${redactArgv(argv).join(" ")}`);
    deps.stderr(connectUsage());
    return CONNECT_EXIT_FAILED;
  }

  try {
    const result = await deps.dispatch({
      command: command as CaioConnectCommand,
      json: parsed.values.json === true,
      positionals: rest,
      values: parsed.values as ConnectCliInvocation["values"],
    });
    deps.stdout(renderConnectResult(result, parsed.values.json === true));
    return connectExitCode(result);
  } catch (error) {
    deps.stderr(redactText(error instanceof Error ? error.message : "command failed"));
    return CONNECT_EXIT_FAILED;
  }
}
