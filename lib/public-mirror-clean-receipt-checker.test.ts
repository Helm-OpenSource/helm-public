import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkPublicMirrorCleanReceipt,
  normalizePublicMirrorCleanReceiptId,
} from "../scripts/check-public-mirror-clean-receipt";
import {
  PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
  getPublicMirrorCleanReceiptPath,
} from "../scripts/release-readiness-check";

let repoRoot: string;

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeValidReceipt(receiptId: string): void {
  writeJson(getPublicMirrorCleanReceiptPath(receiptId, { repoRoot }), {
    receiptId,
    kind: PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
    createdAt: "2026-05-17",
    sourceRef: "main@abcdef0",
    commandEvidence: [
      {
        command: "npm run public-mirror:build -- --mirror-root <candidate>",
        completedAt: "2026-05-17",
        exitCode: 0,
        scannedFiles: 2963,
      },
    ],
  });
}

describe("public mirror clean receipt checker", () => {
  beforeEach(() => {
    repoRoot = mkdtempSync(path.join(tmpdir(), "helm-clean-receipt-check-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { force: true, recursive: true });
  });

  it("normalizes mirror-clean receipts without accepting raw env strings as paths", () => {
    expect(normalizePublicMirrorCleanReceiptId("mirror-clean:public-mirror-2026-05-17")).toBe(
      "public-mirror-2026-05-17",
    );
    expect(normalizePublicMirrorCleanReceiptId("public-mirror-2026-05-17")).toBe(
      "public-mirror-2026-05-17",
    );
  });

  it("passes for an existing valid mirror-clean receipt", () => {
    const receiptId = "public-mirror-2026-05-17";
    writeValidReceipt(receiptId);

    expect(
      checkPublicMirrorCleanReceipt({
        receiptId: `mirror-clean:${receiptId}`,
        repoRoot,
      }),
    ).toMatchObject({
      exitCode: 0,
      receiptId,
    });
  });

  it("fails for a missing receipt file", () => {
    const result = checkPublicMirrorCleanReceipt({
      receiptId: "public-mirror-2026-05-17-missing",
      repoRoot,
    });

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("does not exist");
  });

  it("fails for forged command evidence", () => {
    const receiptId = "public-mirror-2026-05-17-forged";
    writeJson(getPublicMirrorCleanReceiptPath(receiptId, { repoRoot }), {
      receiptId,
      kind: PUBLIC_MIRROR_CLEAN_RECEIPT_KIND,
      createdAt: "2026-05-17",
      sourceRef: "main@abcdef0",
      commandEvidence: [
        {
          command: "npm run test -- lib/public-mirror-clean-receipt-builder.test.ts",
          completedAt: "2026-05-17",
          exitCode: 0,
        },
      ],
    });

    const result = checkPublicMirrorCleanReceipt({ receiptId, repoRoot });

    expect(result.exitCode).toBe(1);
    expect(result.error).toContain("public-mirror:build or public-mirror:verify");
  });
});
