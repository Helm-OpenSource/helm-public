#!/usr/bin/env tsx
/**
 * Helm External Agent Intake — Boundary Demo CLI
 *
 * Demonstrates that Helm can ingest external Agent outputs as candidates
 * without allowing them to create Must Push, write memory, perform official
 * writes, send commitments, or influence final ranking.
 *
 * Offline only: local JSON file + pure TypeScript readout.
 */

import path from "node:path";

import {
  buildExternalAgentBoundaryDemoReadout,
  renderExternalAgentBoundaryDemoText,
} from "../features/external-agent-intake/demo-readout";
import { loadManualImportFile } from "../features/external-agent-intake/manual-import";

const DEFAULT_INPUT_FILE = "evals/external-agent-intake/manual-import-demo.json";

interface CliOptions {
  readonly inputFile: string;
  readonly workspaceId?: string;
  readonly format: "text" | "json";
}

function parseCliArgs(argv: readonly string[]): CliOptions | { readonly error: string } {
  const options: {
    inputFile: string;
    workspaceId?: string;
    format: "text" | "json";
  } = {
    inputFile: DEFAULT_INPUT_FILE,
    format: "text",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input-file") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        return { error: "Missing value for --input-file." };
      }
      options.inputFile = value;
      index += 1;
      continue;
    }
    if (token === "--workspace-id") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        return { error: "Missing value for --workspace-id." };
      }
      options.workspaceId = value;
      index += 1;
      continue;
    }
    if (token === "--format") {
      const value = argv[index + 1];
      if (value !== "text" && value !== "json") {
        return { error: "Missing or invalid value for --format; use text or json." };
      }
      options.format = value;
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }
    return { error: `Unknown argument: ${token}` };
  }

  return options;
}

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  npm run demo:external-agent-boundary",
      "  npm run demo:external-agent-boundary -- --input-file <path>",
      "  npm run demo:external-agent-boundary -- --format json",
      "  npm run demo:external-agent-boundary -- --workspace-id <id>",
      "",
      "Default input:",
      `  ${DEFAULT_INPUT_FILE}`,
      "",
      "This command is offline-only: no DB, no network, no provider API, no runtime adapter.",
    ].join("\n"),
  );
}

function run(options: CliOptions): number {
  const inputFile = path.resolve(options.inputFile);
  const load = loadManualImportFile(inputFile);

  if (!load.ok) {
    const payload = {
      ok: false,
      filePath: load.filePath,
      errors: load.errors,
    };
    if (options.format === "json") {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.error("\nHelm External Agent Boundary Demo");
      console.error("=================================");
      console.error(`File: ${load.filePath}`);
      console.error("\nLoad / validation errors:");
      for (const error of load.errors) {
        console.error(`  - ${error}`);
      }
      console.error("\nBoundary demo FAILED (load / parse).\n");
    }
    return 1;
  }

  const readout = buildExternalAgentBoundaryDemoReadout(load.artifacts, {
    inputFile: load.filePath,
    workspaceId: options.workspaceId ?? load.metadata.workspaceId,
    referenceTimeIso: load.metadata.referenceTimeIso,
    description: load.metadata.description,
  });

  if (options.format === "json") {
    console.log(JSON.stringify(readout, null, 2));
  } else {
    console.log(renderExternalAgentBoundaryDemoText(readout));
  }

  return readout.gatePassed ? 0 : 1;
}

const parsed = parseCliArgs(process.argv.slice(2));
if ("error" in parsed) {
  console.error(parsed.error);
  printUsage();
  process.exit(2);
}

process.exit(run(parsed));
