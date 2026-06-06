/**
 * Source Profiler — CLI entry point.
 *
 * A read-only, open-source implementation-assist tool. It profiles a user's own
 * repo/deployment (source, ORM/schema, API docs, and — in later slices —
 * optional DB catalog) and emits user-private diagnosis artifacts. It never
 * commits, pushes, enables connectors, writes credentials, executes scanned
 * code, or sends data over the network in the deterministic layer.
 */

import { parseArgs, HELP_TEXT } from "./cli/args";
import { runInit } from "./cli/init";
import { runProfileCommand } from "./cli/profile";

export function main(argv: readonly string[], cwd: string = process.cwd()): number {
  const options = parseArgs(argv);

  if (options.command === "help") {
    process.stdout.write(`${HELP_TEXT}\n`);
    return 0;
  }

  if (options.command === "init") {
    const result = runInit({ cwd, scopePath: options.scope, force: options.force });
    for (const message of result.messages) process.stdout.write(`init: ${message}\n`);
    return 0;
  }

  // profile
  try {
    const { runDir, result } = runProfileCommand({
      cwd,
      scopePath: options.scope,
      source: options.source,
      output: options.output,
    });
    if (options.json) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      const { codeScan, candidates } = result;
      process.stdout.write(
        `profile: scanned ${codeScan.scannedFileCount}/${codeScan.fileCount} file(s), ` +
          `found ${codeScan.objects.length} object(s), ` +
          `${candidates.length} mapping candidate(s)\n`,
      );
      process.stdout.write(`profile: wrote run to ${runDir}\n`);
    }
    return 0;
  } catch (error) {
    process.stderr.write(`profile: error: ${(error as Error).message}\n`);
    return 1;
  }
}

// Direct invocation (tsx). Tests import the command modules, not this entry.
const isDirect = process.argv[1] && /source-profiler[/\\]src[/\\]index\.ts$/.test(process.argv[1]);
if (isDirect) {
  process.exit(main(process.argv.slice(2)));
}
