/**
 * caio-admin thin bin wrapper — parses argv (node:util parseArgs), delegates
 * to an injected dispatcher, renders the result (text by default, --json on
 * request) and maps result status to a process exit code. The wrapper itself
 * never calls process.exit; the packaging layer's launcher does:
 *
 *   runCaioAdminCli(process.argv.slice(2), deps).then((code) => process.exitCode = code)
 *
 * Real port wiring (sudo channel, verifiers, mysql probes) is supplied by the
 * deployment packaging layer; this core stays pure and testable.
 */

import { parseArgs } from "node:util";

import {
  EXIT_FAILED,
  type CaioAdminResult,
  renderCaioAdminResult,
} from "@/tools/caio-admin/contracts";
import { redactArgv, redactText } from "@/tools/caio-admin/redaction";

export const CAIO_ADMIN_COMMANDS = [
  "preflight",
  "install",
  "configure",
  "status",
  "activate",
  "active-release",
  "upgrade-check",
  "upgrade",
  "rollback",
  "launchd",
] as const;
export type CaioAdminCommand = (typeof CAIO_ADMIN_COMMANDS)[number];

export interface CliInvocation {
  command: CaioAdminCommand;
  json: boolean;
  positionals: string[];
  values: Record<string, string | boolean | undefined>;
}

export type CaioAdminDispatch = (invocation: CliInvocation) => Promise<CaioAdminResult>;

export interface CliDeps {
  dispatch: CaioAdminDispatch;
  stdout(text: string): void;
  stderr(text: string): void;
}

export function usage(): string {
  return `usage: caio-admin <${CAIO_ADMIN_COMMANDS.join("|")}> [options] [--json]`;
}

export async function runCaioAdminCli(
  argv: readonly string[],
  deps: CliDeps,
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
    deps.stderr(usage());
    return EXIT_FAILED;
  }

  const [command, ...rest] = parsed.positionals;
  if (!command || !(CAIO_ADMIN_COMMANDS as readonly string[]).includes(command)) {
    // Echo only a scrubbed argv; unknown args may carry pasted secrets.
    deps.stderr(`unknown command: ${redactArgv(argv).join(" ")}`);
    deps.stderr(usage());
    return EXIT_FAILED;
  }

  try {
    const result = await deps.dispatch({
      command: command as CaioAdminCommand,
      json: parsed.values.json === true,
      positionals: rest,
      values: parsed.values as CliInvocation["values"],
    });
    deps.stdout(renderCaioAdminResult(result, { json: parsed.values.json === true }));
    return result.exitCode;
  } catch (error) {
    deps.stderr(redactText(error instanceof Error ? error.message : "command failed"));
    return EXIT_FAILED;
  }
}
