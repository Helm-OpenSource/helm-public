#!/usr/bin/env tsx
/**
 * Public mirror clean receipt checker.
 *
 * Validates an existing `mirror-clean:<receipt-id>` receipt without running the
 * full release readiness gate. This is a narrow operator preflight for the
 * secret-history manual receipt; it does not create mirrors, rewrite history,
 * rotate credentials, or inspect raw logs.
 *
 * Usage:
 *   npx tsx scripts/check-public-mirror-clean-receipt.ts \
 *     --receipt mirror-clean:public-mirror-2026-05-17-smoke
 *
 *   npx tsx scripts/check-public-mirror-clean-receipt.ts \
 *     --receipt-id public-mirror-2026-05-17-smoke
 */

import path from "node:path";

import {
  getPublicMirrorCleanReceiptPath,
  validatePublicMirrorCleanReceiptFile,
} from "./release-readiness-check";

export type PublicMirrorCleanReceiptCheckOptions = {
  readonly receiptId: string;
  readonly repoRoot?: string;
};

export type PublicMirrorCleanReceiptCheckResult = {
  readonly receiptId: string;
  readonly receiptPath: string;
  readonly exitCode: 0 | 1;
  readonly error?: string;
};

export function normalizePublicMirrorCleanReceiptId(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("mirror-clean:")
    ? trimmed.slice("mirror-clean:".length)
    : trimmed;
}

export function checkPublicMirrorCleanReceipt(
  options: PublicMirrorCleanReceiptCheckOptions,
): PublicMirrorCleanReceiptCheckResult {
  const receiptId = normalizePublicMirrorCleanReceiptId(options.receiptId);
  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : undefined;
  const receiptPath = getPublicMirrorCleanReceiptPath(receiptId, { repoRoot });
  const error = validatePublicMirrorCleanReceiptFile(receiptId, { repoRoot });

  return {
    error,
    exitCode: error ? 1 : 0,
    receiptId,
    receiptPath,
  };
}

function parseArgs(args: string[]): PublicMirrorCleanReceiptCheckOptions {
  let receiptId: string | undefined;
  let repoRoot: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--receipt" || arg === "--receipt-id") {
      const value = args[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      if (receiptId) throw new Error("Use only one of --receipt or --receipt-id");
      receiptId = value;
      index += 1;
      continue;
    }
    if (arg === "--repo-root") {
      const value = args[index + 1];
      if (!value) throw new Error("--repo-root requires a directory path");
      repoRoot = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!receiptId) {
    throw new Error("--receipt mirror-clean:<receipt-id> or --receipt-id <receipt-id> is required");
  }

  return { receiptId, repoRoot };
}

function main(): number {
  let result: PublicMirrorCleanReceiptCheckResult;
  try {
    result = checkPublicMirrorCleanReceipt(parseArgs(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (result.exitCode === 0) {
    console.log(
      `public-mirror-clean-receipt: PASS — mirror-clean:${result.receiptId} (${result.receiptPath})`,
    );
    return 0;
  }

  console.error(
    [
      `public-mirror-clean-receipt: FAIL — mirror-clean:${result.receiptId}`,
      result.error,
    ].join("\n"),
  );
  return 1;
}

if (require.main === module) {
  process.exitCode = main();
}
