import { describe, expect, it } from "vitest";

import {
  buildPermissionPolicyFromManifest,
  permissionManifestSchema,
  validatePermissionManifest,
} from "@/lib/extensions/permission-manifest";
import manifest from "@/extensions/case-management-sample/permission.manifest.json";

describe("extension permission manifest", () => {
  it("validates the public-safe case-management sample manifest", () => {
    const parsed = validatePermissionManifest(manifest);

    expect(parsed.packKey).toBe("case-management-sample");
    expect(parsed.policyVersion).toBe("permission-policy/v1");
    expect(parsed.actions.map((action) => action.name)).toEqual([
      "case.read",
      "case.prepare_writeback",
      "case.execute_writeback",
    ]);
  });

  it("builds a Core permission policy from manifest actions", () => {
    const policy = buildPermissionPolicyFromManifest(manifest);

    expect(policy.policyVersion).toBe("permission-policy/v1");
    expect(policy.actions["case.read"]).toMatchObject({
      effectMode: "read_only",
      riskLevel: "low",
      source: "pack_manifest",
    });
    expect(policy.actions["case.execute_writeback"]).toMatchObject({
      effectMode: "blocked_side_effect",
      riskLevel: "critical",
    });
  });

  it("rejects manifests without a policy version", () => {
    expect(() =>
      validatePermissionManifest({
        ...manifest,
        policyVersion: "",
      }),
    ).toThrow(/policyVersion/);
  });

  it("rejects unknown data classifications", () => {
    expect(() =>
      validatePermissionManifest({
        ...manifest,
        resources: [
          {
            ...manifest.resources[0],
            dataClassifications: ["workspace_internal", "tenant-secret"],
          },
        ],
      }),
    ).toThrow(/data classifications/i);
  });

  it("rejects public Core writeback execution when it is not blocked", () => {
    expect(() =>
      validatePermissionManifest({
        ...manifest,
        actions: manifest.actions.map((action) =>
          action.name === "case.execute_writeback"
            ? { ...action, effectMode: "review_required" }
            : action,
        ),
      }),
    ).toThrow(/writeback execution/i);
  });

  it("rejects field redaction values that drift from the canonical mapping", () => {
    expect(() =>
      validatePermissionManifest({
        ...manifest,
        resources: [
          {
            ...manifest.resources[0],
            fieldRedactions: manifest.resources[0].fieldRedactions.map((redaction) =>
              redaction.field === "balance"
                ? { ...redaction, defaultRedaction: "alias_only" }
                : redaction,
            ),
          },
        ],
      }),
    ).toThrow(/canonical redaction/i);
  });

  it("requires every action to declare row-filter and field-redaction support", () => {
    const result = permissionManifestSchema.safeParse({
      ...manifest,
      actions: manifest.actions.map((action) => {
        if (action.name !== "case.read") return action;
        const { supportsRowFilter: _supportsRowFilter, ...withoutRowFilter } = action;
        return withoutRowFilter;
      }),
    });

    expect(result.success).toBe(false);
  });
});
