/**
 * Source Profiler — argv parsing.
 *
 * Minimal, dependency-free flag parser. The first non-flag token is the
 * command; if the first token is a flag, the command defaults to `profile`.
 */

export type Command = "init" | "profile" | "help";

export type CliOptions = {
  command: Command;
  scope?: string;
  source?: string;
  output?: string;
  force: boolean;
  json: boolean;
  /** Reserved for later PRs; parsed now so flags don't error. */
  flags: Record<string, string | boolean>;
};

const KNOWN_VALUE_FLAGS = new Set([
  "scope",
  "source",
  "output",
  "overlay-root",
  "tenant",
  "extension-slug",
  "ai-provider",
  "db-catalog",
]);

export function parseArgs(argv: readonly string[]): CliOptions {
  const tokens = [...argv];
  let command: Command = "profile";

  if (tokens.length > 0 && !tokens[0].startsWith("-")) {
    const first = tokens.shift() as string;
    if (first === "init" || first === "profile" || first === "help") {
      command = first;
    } else {
      command = "profile";
      tokens.unshift(first);
    }
  }

  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token.startsWith("--")) continue;
    const eq = token.indexOf("=");
    if (eq !== -1) {
      flags[token.slice(2, eq)] = token.slice(eq + 1);
      continue;
    }
    const key = token.slice(2);
    const next = tokens[i + 1];
    if (KNOWN_VALUE_FLAGS.has(key) && next !== undefined && !next.startsWith("-")) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }

  if (flags.help === true || command === "help") {
    return { command: "help", force: false, json: false, flags };
  }

  return {
    command,
    scope: asString(flags.scope),
    source: asString(flags.source),
    output: asString(flags.output),
    force: flags.force === true,
    json: flags.json === true,
    flags,
  };
}

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export const HELP_TEXT = `Source Profiler — read-only implementation-assist CLI

Usage:
  source-profiler init   [--scope <path>] [--force]
  source-profiler profile --scope <path> --source <dir> [--output <dir>] [--json]
  source-profiler help

Commands:
  init      Scaffold a scope manifest template and ensure .helm-profiler/ is gitignored.
  profile   Run the deterministic profiler over the in-scope source and write a run
            directory under the configured output dir.

Notes:
  Outputs are user-private and land under .helm-profiler/runs/ (gitignored).
  The deterministic layer never executes scanned code, sends data over the
  network, or reads database rows.`;
