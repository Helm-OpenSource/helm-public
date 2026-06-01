import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectTenantExtensionManifestValidationReadout } from "@/lib/solution-extension-manifests";

const tempProjectRoots: string[] = [];

describe("solution extension manifest bundle validation", () => {
  afterEach(() => {
    while (tempProjectRoots.length > 0) {
      const root = tempProjectRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("keeps every currently checked-in tenant manifest valid in read-only validation mode", () => {
    const readout = collectTenantExtensionManifestValidationReadout(
      path.join(process.cwd(), "extensions"),
    );

    // Tenant-specific assertions live alongside each tenant's own extension
    // tree (private mirror). The shared-layer regression guard only asserts
    // that whatever manifests are checked in pass read-only validation.
    expect(readout.length).toBeGreaterThan(0);
    expect(readout.every((result) => result.ok)).toBe(true);
  });

  it("fails closed when manifestVersion is missing", () => {
    const fixture = createTempHarnessProject();
    const manifest = fixture.readManifest();

    delete manifest.manifestVersion;
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(fixture.extensionsRoot);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain("manifestVersion must be present");
  });

  it("rejects customer_visible_send during read-only validation adoption", () => {
    const fixture = createTempHarnessProject();
    const manifest = fixture.readManifest();

    manifest.capabilityManifest.maxEffectMode = "customer_visible_send";
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(fixture.extensionsRoot);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "capabilityManifest.maxEffectMode must not declare customer_visible_send in read-only validation phase",
    );
  });

  it("fails when documentation and eval pointers drift", () => {
    const fixture = createTempHarnessProject();
    const manifest = fixture.readManifest();

    manifest.documentationPointers.docs = ["docs/missing-guide.md"];
    manifest.evalContract.checks = ["tests/missing-route.test.ts"];
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(fixture.extensionsRoot);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "documentationPointers.docs points to a missing file: docs/missing-guide.md",
    );
    expect(result.issues).toContain(
      "evalContract.checks points to a missing file: tests/missing-route.test.ts",
    );
  });

  it("fails when resource dependency declarations are malformed for phase 4 adoption", () => {
    const fixture = createTempHarnessProject();
    const manifest = fixture.readManifest();

    manifest.resourceDependencyDeclarations = [
      {
        resourceDependencyKey: "demo-sample:crm",
        provider: "demo-crm",
        declaredCapabilityModes: ["customer_visible_send"],
        objectBindings: [],
        policyHints: [],
      },
    ];
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(fixture.extensionsRoot);

    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "resourceDependencyDeclarations[0].declaredCapabilityModes must not declare customer_visible_send in phase 4 adoption",
    );
    expect(result.issues).toContain(
      "resourceDependencyDeclarations[0].objectBindings must be a non-empty string array",
    );
    expect(result.issues).toContain(
      "resourceDependencyDeclarations[0].policyHints must be a non-empty string array",
    );
  });
});

function createTempHarnessProject() {
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), "helm-solution-extension-manifests-"));
  tempProjectRoots.push(projectRoot);

  const extensionsRoot = path.join(projectRoot, "extensions");
  const tenantRoot = path.join(extensionsRoot, "demo");
  const extensionRoot = path.join(tenantRoot, "sample");
  mkdirSync(path.join(extensionRoot, "docs"), { recursive: true });
  mkdirSync(path.join(extensionRoot, "tests"), { recursive: true });

  writeFileSync(
    path.join(tenantRoot, "tenant.manifest.json"),
    JSON.stringify(
      {
        tenantKey: "demo",
        displayName: "Demo Tenant",
        status: "ACTIVE",
        ownedExtensions: [
          {
            extensionSlug: "sample",
            extensionKey: "demo-sample",
            displayName: "Demo Sample",
            rootPath: "extensions/demo/sample",
          },
        ],
      },
      null,
      2,
    ),
  );

  writeFileSync(path.join(extensionRoot, "README.md"), "# Demo Sample\n");
  writeFileSync(path.join(extensionRoot, "docs", "guide.md"), "# Guide\n");
  writeFileSync(path.join(extensionRoot, "tests", "route.test.ts"), "export {};\n");

  const manifestPath = path.join(extensionRoot, "extension.manifest.json");
  writeFileSync(manifestPath, JSON.stringify(buildManifestFixture(), null, 2));

  return {
    extensionsRoot,
    readManifest: () => JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestFixture,
    writeManifest: (manifest: ManifestFixture) =>
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)),
  };
}

function buildManifestFixture(): ManifestFixture {
  return {
    manifestVersion: "1",
    bundleVersion: "2026.04.24",
    extensionKey: "demo-sample",
    tenantKey: "demo",
    extensionSlug: "sample",
    displayName: "Demo Sample",
    kind: "TENANT_CUSTOM",
    status: "ACTIVE",
    owner: "demo",
    nonCoreDeclaration: true,
    compatibility: {
      minRuntimeContractVersion: "2026.04.24-harness-phase3",
      supportedWorkspaceClasses: ["CUSTOMER"],
      requiredFeatures: ["WorkspaceSolutionExtension"],
    },
    migrationHints: ["bundle_manifest_read_only_validation_phase3"],
    runtimeDeclarations: {
      workers: [],
      skills: [],
      resources: [],
      hooks: [],
      monitors: [],
      surfaces: ["/reports?tab=sample"],
    },
    capabilityManifest: {
      capabilityDeclarations: ["sample_readout"],
      maxEffectMode: "read_only",
      customerFacingAllowed: false,
      requiresReviewByDefault: true,
      nonCommitmentOnly: true,
    },
    dependencyDeclarations: {
      connectors: ["demo-connector"],
      workspaceTruths: ["WorkspaceSolutionExtension"],
      policyTruths: ["review-first"],
    },
    documentationPointers: {
      readme: "README.md",
      docs: ["docs/guide.md"],
    },
    evalContract: {
      fixtures: [],
      checks: ["tests/route.test.ts"],
    },
    summary: "Demo harness manifest sample",
    surfaces: ["/reports?tab=sample"],
  };
}

type ManifestFixture = {
  manifestVersion?: string;
  bundleVersion: string;
  extensionKey: string;
  tenantKey: string;
  extensionSlug: string;
  displayName: string;
  kind: string;
  status: string;
  owner: string;
  nonCoreDeclaration: boolean;
  compatibility: {
    minRuntimeContractVersion: string;
    supportedWorkspaceClasses: string[];
    requiredFeatures: string[];
  };
  migrationHints: string[];
  runtimeDeclarations: {
    workers: unknown[];
    skills: unknown[];
    resources: unknown[];
    hooks: unknown[];
    monitors: unknown[];
    surfaces: string[];
  };
  capabilityManifest: {
    capabilityDeclarations: string[];
    maxEffectMode: "read_only" | "customer_visible_send";
    customerFacingAllowed: boolean;
    requiresReviewByDefault: boolean;
    nonCommitmentOnly: boolean;
  };
  dependencyDeclarations: {
    connectors: string[];
    workspaceTruths: string[];
    policyTruths: string[];
  };
  resourceDependencyDeclarations?: Array<{
    resourceDependencyKey: string;
    provider: string;
    declaredCapabilityModes: string[];
    objectBindings: string[];
    policyHints: string[];
  }>;
  documentationPointers: {
    readme: string;
    docs: string[];
  };
  evalContract: {
    fixtures: string[];
    checks: string[];
  };
  summary: string;
  surfaces: string[];
};
