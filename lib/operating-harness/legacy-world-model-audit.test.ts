import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  auditLegacyWorldModelMetadata,
  validateLegacyWorldModelAuditReceipt,
  validateLegacyWorldModelAuditReceiptBinding,
} from "./legacy-world-model-audit";

function safeInput() {
  return {
    expectedWorkspaceAlias: "workspace:synthetic-operating-context",
    metadata: {
      schemaVersion:
        "helm.operating-harness.legacy-world-model-audit-input.v1" as const,
      sourceModel: "Prisma.WorldModelSnapshot" as const,
      workspaceAlias: "workspace:synthetic-operating-context",
      recordAlias: "legacy-world-model:synthetic-17",
      observedAt: "2026-07-12T00:00:00.000Z",
      summaryPresent: true,
      snapshotJsonPresent: true,
      rawContentIncluded: false as const,
      identifiersIncluded: false as const,
    },
  };
}

describe("legacy WorldModelSnapshot audit-only adapter", () => {
  it("returns only a non-importable quarantine receipt", () => {
    const result = auditLegacyWorldModelMetadata(safeInput());

    expect(result.status).toBe("audited");
    expect(result.errors).toEqual([]);
    expect(result.receipt).toMatchObject({
      sourceModel: "Prisma.WorldModelSnapshot",
      auditOnly: true,
      disposition: "quarantine",
      contentIncluded: false,
      identifiersIncluded: false,
      canonicalImportAllowed: false,
      contextProjectionAllowed: false,
      writebackAllowed: false,
      actionAuthority: "none",
    });
    expect(result.receipt).not.toHaveProperty("workspaceAlias");
    expect(result.receipt).not.toHaveProperty("recordAlias");
    expect(result.receipt).not.toHaveProperty("summary");
    expect(result.receipt).not.toHaveProperty("snapshotJson");
    expect(validateLegacyWorldModelAuditReceipt(result.receipt)).toEqual({
      ok: true,
      errors: [],
    });
    expect(
      validateLegacyWorldModelAuditReceiptBinding({
        input: safeInput(),
        receipt: result.receipt,
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("rejects raw content, legacy identifiers, and cross-workspace metadata", () => {
    const raw = safeInput() as ReturnType<typeof safeInput> & {
      metadata: ReturnType<typeof safeInput>["metadata"] & {
        snapshotJson: string;
      };
    };
    raw.metadata.snapshotJson = '{"facts":["private"]}';

    const identified = safeInput() as ReturnType<typeof safeInput> & {
      metadata: ReturnType<typeof safeInput>["metadata"] & {
        companyId: string;
      };
    };
    identified.metadata.companyId = "company:private-17";

    const crossWorkspace = safeInput();
    crossWorkspace.metadata.workspaceAlias = "workspace:synthetic-other";

    expect(auditLegacyWorldModelMetadata(raw)).toMatchObject({
      status: "rejected",
      receipt: null,
      errors: expect.arrayContaining([
        "legacy_raw_field_forbidden:snapshotJson",
      ]),
    });
    expect(auditLegacyWorldModelMetadata(identified)).toMatchObject({
      status: "rejected",
      receipt: null,
      errors: expect.arrayContaining([
        "legacy_identifier_field_forbidden:companyId",
      ]),
    });
    expect(auditLegacyWorldModelMetadata(crossWorkspace)).toMatchObject({
      status: "rejected",
      receipt: null,
      errors: expect.arrayContaining(["legacy_workspace_alias_mismatch"]),
    });
  });

  it("has no database, canonical projector, network, or write primitive", () => {
    const source = readFileSync(
      new URL("./legacy-world-model-audit.ts", import.meta.url),
      "utf8",
    );

    for (const forbidden of [
      "@prisma/client",
      'from "@/lib/db"',
      "context-projector",
      'from "./contracts"',
      ".upsert(",
      ".create(",
      ".update(",
      "fetch(",
      "XMLHttpRequest",
      "sendBeacon",
      "WebSocket",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("rejects cyclic metadata graphs without hanging or throwing", () => {
    const cyclic: Record<string, unknown> = safeInput();
    cyclic.self = cyclic;

    expect(() => auditLegacyWorldModelMetadata(cyclic)).not.toThrow();
    expect(auditLegacyWorldModelMetadata(cyclic)).toMatchObject({
      status: "rejected",
      receipt: null,
      errors: expect.arrayContaining([
        "legacy_input_graph_contains_reused_reference",
      ]),
    });
  });

  it("binds a quarantine receipt without exposing the safe aliases", () => {
    const firstInput = safeInput();
    const secondInput = safeInput();
    secondInput.metadata.recordAlias = "legacy-world-model:synthetic-18";
    const first = auditLegacyWorldModelMetadata(firstInput);
    const second = auditLegacyWorldModelMetadata(secondInput);
    if (!first.receipt || !second.receipt) {
      throw new Error("expected audited receipts");
    }

    expect(first.receipt.metadataBindingHash).not.toBe(
      second.receipt.metadataBindingHash,
    );
    expect(first.receipt.contentHash).not.toBe(second.receipt.contentHash);
    expect(first.receipt).not.toHaveProperty("recordAlias");
    expect(
      validateLegacyWorldModelAuditReceiptBinding({
        input: secondInput,
        receipt: first.receipt,
      }).errors,
    ).toContain("legacy_world_model_audit_receipt_not_reproducible");
  });
});
