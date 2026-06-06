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

function asString(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

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
    const flags = options.flags;
    const out = runProfileCommand({
      cwd,
      scopePath: options.scope,
      source: options.source,
      output: options.output,
      workspace: asString(flags.workspace),
      redact: flags.redact === true,
      emitOverlayDraft: flags["emit-overlay-draft"] === true,
      overlayRoot: asString(flags["overlay-root"]),
      tenant: asString(flags.tenant),
      extensionSlug: asString(flags["extension-slug"]),
      force: options.force,
    });
    if (options.json) {
      process.stdout.write(`${JSON.stringify(out.result, null, 2)}\n`);
    } else {
      const { codeScan, candidates } = out.result;
      process.stdout.write(
        `profile: scanned ${codeScan.scannedFileCount}/${codeScan.fileCount} file(s), ` +
          `found ${codeScan.objects.length} object(s), ` +
          `${candidates.length} mapping candidate(s)\n`,
      );
      process.stdout.write(`profile: wrote run to ${out.runDir}\n`);
      if (out.materializedFiles) {
        process.stdout.write(
          `profile: materialized ${out.materializedFiles.length} overlay file(s)\n`,
        );
      }
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
