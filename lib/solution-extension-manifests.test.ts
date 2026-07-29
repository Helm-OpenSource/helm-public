import { createHash } from "node:crypto";
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

  it("validates a Pack dependency from its canonical authority files", () => {
    const fixture = createTempHarnessProject();
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const manifest = fixture.readManifest();
    manifest.tenantKey = "npa";
    manifest.extensionKey = "npa-sample";
    manifest.capabilityManifest.maxEffectMode = "human_seat_write";
    fixture.writeManifest(manifest);
    const authority = fixture.writePackAuthority({
      packKey: "npa",
      providedExtensions: [
        {
          extensionKey: "npa-sample",
          extensionSlug: "sample",
          rootPath: "packs/npa/sample",
        },
      ],
    });
    tenantManifest.packDependencies = [{ packKey: "npa", ...authority }];
    fixture.writeTenantManifest(tenantManifest);
    fixture.writeCanonicalPackExtensionManifest({
      packKey: "npa",
      physicalExtensionSlug: "sample",
      manifest,
    });

    const [result] = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    );

    expect(result).toMatchObject({
      ok: true,
      validationScope: "pack-dependency",
      extensionKey: "npa-sample",
      sourceExtensionKey: "npa-sample",
    });
  });

  it("validates an explicitly declared tenant alias for a Pack extension", () => {
    const fixture = createTempHarnessProject();
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const authority = fixture.writePackAuthority({
      packKey: "npa",
      providedExtensions: [
        {
          extensionKey: "npa-sample",
          extensionSlug: "sample",
          rootPath: "packs/npa/sample",
        },
      ],
    });
    tenantManifest.packDependencies = [
      {
        packKey: "npa",
        ...authority,
        aliases: [
          {
            sourceExtensionKey: "npa-sample",
            extensionKey: "demo-sample",
          },
        ],
      },
    ];
    fixture.writeTenantManifest(tenantManifest);

    const [result] = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    );

    expect(result).toMatchObject({
      ok: true,
      validationScope: "pack-dependency",
      extensionKey: "demo-sample",
      sourceExtensionKey: "npa-sample",
    });
  });

  it("rejects a Pack alias that is not declared by the tenant dependency", () => {
    const fixture = createTempHarnessProject();
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const authority = fixture.writePackAuthority({
      packKey: "npa",
      providedExtensions: [
        {
          extensionKey: "npa-sample",
          extensionSlug: "sample",
          rootPath: "packs/npa/sample",
        },
      ],
    });
    tenantManifest.packDependencies = [{ packKey: "npa", ...authority }];
    fixture.writeTenantManifest(tenantManifest);

    const [result] = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    );

    expect(result.ok).toBe(false);
    expect(result.validationScope).toBe("tenant-owned");
    expect(result.issues).toContain(
      "tenant extension directory sample must not shadow canonical Pack extension npa-sample",
    );
  });

  it("does not accept tenant-local Pack copies as canonical authority", () => {
    const fixture = createTempHarnessProject();
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const tenantPackRoot = path.join(
      fixture.extensionsRoot,
      "demo",
      ".pack-dependencies",
      "npa",
    );
    const providedExtensions = [
      {
        extensionKey: "npa-sample",
        extensionSlug: "sample",
        rootPath: "packs/npa/sample",
      },
    ];
    const manifestSha256 = writeCanonicalJson(
      path.join(tenantPackRoot, "pack.manifest.json"),
      { packKey: "npa", providedExtensions },
    );
    const contractSha256 = writeCanonicalJson(
      path.join(tenantPackRoot, "pack-contract.json"),
      { packKey: "npa", providedExtensionKeys: ["npa-sample"] },
    );
    tenantManifest.packDependencies = [
      { packKey: "npa", manifestSha256, contractSha256 },
    ];
    fixture.writeTenantManifest(tenantManifest);

    const result = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    ).find((entry) => entry.validationScope === "pack-authority");

    expect(result?.ok).toBe(false);
    expect(result?.issues).toContain(
      "pack dependency npa authority root is missing",
    );
  });

  it("rejects tenant alias manifests that expand canonical Pack authority", () => {
    const fixture = createTempHarnessProject();
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const authority = fixture.writePackAuthority({
      packKey: "npa",
      providedExtensions: [
        {
          extensionKey: "npa-sample",
          extensionSlug: "sample",
          rootPath: "packs/npa/sample",
        },
      ],
    });
    tenantManifest.packDependencies = [
      {
        packKey: "npa",
        ...authority,
        aliases: [
          {
            sourceExtensionKey: "npa-sample",
            extensionKey: "demo-sample",
          },
        ],
      },
    ];
    fixture.writeTenantManifest(tenantManifest);
    const manifest = fixture.readManifest();
    manifest.capabilityManifest.maxEffectMode = "human_seat_write";
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "Pack alias manifest changes canonical authority field capabilityManifest",
    );
  });

  it("rejects globally ambiguous extension keys across tenant roots", () => {
    const fixture = createTempHarnessProject();
    const secondTenantRoot = path.join(fixture.extensionsRoot, "other");
    const secondExtensionRoot = path.join(secondTenantRoot, "sample");
    mkdirSync(path.join(secondExtensionRoot, "docs"), { recursive: true });
    mkdirSync(path.join(secondExtensionRoot, "tests"), { recursive: true });
    writeFileSync(path.join(secondExtensionRoot, "README.md"), "# Other Sample\n");
    writeFileSync(path.join(secondExtensionRoot, "docs", "guide.md"), "# Guide\n");
    writeFileSync(path.join(secondExtensionRoot, "tests", "route.test.ts"), "export {};\n");
    writeFileSync(
      path.join(secondTenantRoot, "tenant.manifest.json"),
      JSON.stringify(
        {
          tenantKey: "other",
          displayName: "Other Tenant",
          status: "ACTIVE",
          ownedExtensions: [
            {
              extensionSlug: "sample",
              extensionKey: "demo-sample",
              displayName: "Other Sample",
              rootPath: "extensions/other/sample",
            },
          ],
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(secondExtensionRoot, "extension.manifest.json"),
      JSON.stringify(
        buildManifestFixture({
          tenantKey: "other",
          extensionSlug: "sample",
          extensionKey: "demo-sample",
        }),
        null,
        2,
      ),
    );

    const matchingResults = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    ).filter((entry) => entry.extensionKey === "demo-sample");

    expect(matchingResults).toHaveLength(2);
    expect(matchingResults.every((entry) => entry.ok)).toBe(false);
    expect(matchingResults.every((entry) => entry.issues.includes(
      "extensionKey must be globally unique: demo-sample",
    ))).toBe(true);
  });

  it("maps a Pack logical extension slug to its canonical physical directory", () => {
    const fixture = createTempHarnessProject({
      physicalExtensionSlug: "third-party-agency",
      logicalExtensionSlug: "agency-oversight",
    });
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const authority = fixture.writePackAuthority({
      packKey: "npa",
      providedExtensions: [
        {
          extensionKey: "npa-agency-oversight",
          extensionSlug: "agency-oversight",
          rootPath: "packs/npa/third-party-agency",
        },
      ],
    });
    tenantManifest.packDependencies = [{ packKey: "npa", ...authority }];
    fixture.writeTenantManifest(tenantManifest);
    const manifest = fixture.readManifest();
    manifest.tenantKey = "npa";
    manifest.extensionKey = "npa-agency-oversight";
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    );

    expect(result).toMatchObject({
      ok: true,
      validationScope: "pack-dependency",
      extensionKey: "npa-agency-oversight",
      sourceExtensionKey: "npa-agency-oversight",
    });
  });

  it("fails closed when a Pack authority digest is not exact", () => {
    const fixture = createTempHarnessProject();
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const authority = fixture.writePackAuthority({
      packKey: "npa",
      providedExtensions: [
        {
          extensionKey: "npa-sample",
          extensionSlug: "sample",
          rootPath: "packs/npa/sample",
        },
      ],
    });
    tenantManifest.packDependencies = [
      { ...authority, packKey: "npa", manifestSha256: "0".repeat(64) },
    ];
    fixture.writeTenantManifest(tenantManifest);
    const manifest = fixture.readManifest();
    manifest.tenantKey = "npa";
    manifest.extensionKey = "npa-sample";
    fixture.writeManifest(manifest);

    const result = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    ).find((entry) => entry.validationScope === "pack-authority");

    expect(result?.ok).toBe(false);
    expect(result?.issues).toContain(
      "pack dependency npa manifestSha256 must match the canonical Pack manifest",
    );
  });

  it("rejects tenant-owned Pack extension declarations", () => {
    const fixture = createTempHarnessProject();
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const authority = fixture.writePackAuthority({
      packKey: "npa",
      providedExtensions: [
        {
          extensionKey: "npa-sample",
          extensionSlug: "sample",
          rootPath: "packs/npa/sample",
        },
      ],
    });
    tenantManifest.packDependencies = [
      {
        packKey: "npa",
        ...authority,
        providedExtensions: ["npa-sample"],
      },
    ];
    fixture.writeTenantManifest(tenantManifest);
    const manifest = fixture.readManifest();
    manifest.tenantKey = "npa";
    manifest.extensionKey = "npa-sample";
    fixture.writeManifest(manifest);

    const result = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    ).find((entry) => entry.validationScope === "pack-authority");

    expect(result?.ok).toBe(false);
    expect(result?.issues).toContain(
      "pack dependency npa must not declare providedExtensions; the canonical Pack manifest is the authority",
    );
  });

  it("fails closed for an undeclared cross-tenant Pack manifest", () => {
    const fixture = createTempHarnessProject();
    const manifest = fixture.readManifest();
    manifest.tenantKey = "npa";
    manifest.extensionKey = "npa-sample";
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    );

    expect(result.ok).toBe(false);
    expect(result.validationScope).toBe("tenant-owned");
    expect(result.issues).toContain("tenantKey must match directory name (demo)");
  });

  it("reuses the read-only capability gate for declared Pack dependencies", () => {
    const fixture = createTempHarnessProject();
    const tenantManifest = fixture.readTenantManifest();
    tenantManifest.ownedExtensions = [];
    const authority = fixture.writePackAuthority({
      packKey: "npa",
      providedExtensions: [
        {
          extensionKey: "npa-sample",
          extensionSlug: "sample",
          rootPath: "packs/npa/sample",
        },
      ],
    });
    tenantManifest.packDependencies = [{ packKey: "npa", ...authority }];
    fixture.writeTenantManifest(tenantManifest);
    const manifest = fixture.readManifest();
    manifest.tenantKey = "npa";
    manifest.extensionKey = "npa-sample";
    manifest.capabilityManifest.maxEffectMode = "customer_visible_send";
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    );

    expect(result.validationScope).toBe("pack-dependency");
    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "capabilityManifest.maxEffectMode must not declare customer_visible_send in read-only validation phase",
    );
  });

  it("rejects human_seat_write on a tenant-owned manifest", () => {
    const fixture = createTempHarnessProject();
    const manifest = fixture.readManifest();
    manifest.capabilityManifest.maxEffectMode = "human_seat_write";
    fixture.writeManifest(manifest);

    const [result] = collectTenantExtensionManifestValidationReadout(
      fixture.extensionsRoot,
    );

    expect(result.ok).toBe(false);
    expect(result.issues).toContain(
      "capabilityManifest.maxEffectMode human_seat_write requires a declared Pack dependency authority",
    );
  });
});

function createTempHarnessProject(
  options: {
    physicalExtensionSlug?: string;
    logicalExtensionSlug?: string;
  } = {},
) {
  const physicalExtensionSlug = options.physicalExtensionSlug ?? "sample";
  const logicalExtensionSlug = options.logicalExtensionSlug ?? physicalExtensionSlug;
  const projectRoot = mkdtempSync(path.join(os.tmpdir(), "helm-solution-extension-manifests-"));
  tempProjectRoots.push(projectRoot);

  const extensionsRoot = path.join(projectRoot, "extensions");
  const packAuthoritiesRoot = path.join(projectRoot, "pack-authority");
  const tenantRoot = path.join(extensionsRoot, "demo");
  const extensionRoot = path.join(tenantRoot, physicalExtensionSlug);
  mkdirSync(path.join(extensionRoot, "docs"), { recursive: true });
  mkdirSync(path.join(extensionRoot, "tests"), { recursive: true });

  const tenantManifestPath = path.join(tenantRoot, "tenant.manifest.json");
  writeFileSync(
    tenantManifestPath,
    JSON.stringify(
      {
        tenantKey: "demo",
        displayName: "Demo Tenant",
        status: "ACTIVE",
        ownedExtensions: [
          {
            extensionSlug: physicalExtensionSlug,
            extensionKey: `demo-${physicalExtensionSlug}`,
            displayName: "Demo Sample",
            rootPath: `extensions/demo/${physicalExtensionSlug}`,
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
  writeFileSync(
    manifestPath,
    JSON.stringify(
      buildManifestFixture({
        extensionSlug: logicalExtensionSlug,
        extensionKey: `demo-${logicalExtensionSlug}`,
      }),
      null,
      2,
    ),
  );

  return {
    extensionsRoot,
    readTenantManifest: () =>
      JSON.parse(readFileSync(tenantManifestPath, "utf8")) as TenantManifestFixture,
    writeTenantManifest: (manifest: TenantManifestFixture) =>
      writeFileSync(tenantManifestPath, JSON.stringify(manifest, null, 2)),
    readManifest: () => JSON.parse(readFileSync(manifestPath, "utf8")) as ManifestFixture,
    writeManifest: (manifest: ManifestFixture) =>
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)),
    writePackAuthority: (input: {
      packKey: string;
      providedExtensions: PackProvidedExtensionFixture[];
    }) => {
      const authorityRoot = path.join(
        packAuthoritiesRoot,
        input.packKey,
      );
      mkdirSync(authorityRoot, { recursive: true });
      const packManifest = {
        packKey: input.packKey,
        providedExtensions: input.providedExtensions,
      };
      const packContract = {
        packKey: input.packKey,
        providedExtensionKeys: input.providedExtensions.map(
          (extension) => extension.extensionKey,
        ),
      };
      for (const extension of input.providedExtensions) {
        const physicalExtensionSlug = extension.rootPath.split("/").at(-1);
        if (!physicalExtensionSlug) throw new Error("fixture Pack rootPath must contain a slug");
        writeCanonicalJson(
          path.join(authorityRoot, physicalExtensionSlug, "extension.manifest.json"),
          buildManifestFixture({
            tenantKey: input.packKey,
            extensionSlug: extension.extensionSlug,
            extensionKey: extension.extensionKey,
          }),
        );
      }
      return {
        manifestSha256: writeCanonicalJson(
          path.join(authorityRoot, "pack.manifest.json"),
          packManifest,
        ),
        contractSha256: writeCanonicalJson(
          path.join(authorityRoot, "pack-contract.json"),
          packContract,
        ),
      };
    },
    writeCanonicalPackExtensionManifest: (input: {
      packKey: string;
      physicalExtensionSlug: string;
      manifest: ManifestFixture;
    }) =>
      writeCanonicalJson(
        path.join(
          packAuthoritiesRoot,
          input.packKey,
          input.physicalExtensionSlug,
          "extension.manifest.json",
        ),
        input.manifest,
      ),
  };
}

function buildManifestFixture(input: {
  tenantKey?: string;
  extensionSlug: string;
  extensionKey: string;
}): ManifestFixture {
  return {
    manifestVersion: "1",
    bundleVersion: "2026.04.24",
    extensionKey: input.extensionKey,
    tenantKey: input.tenantKey ?? "demo",
    extensionSlug: input.extensionSlug,
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

function writeCanonicalJson(filePath: string, value: unknown) {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents);
  return createHash("sha256").update(contents).digest("hex");
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
    maxEffectMode: "read_only" | "human_seat_write" | "customer_visible_send";
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

type TenantManifestFixture = {
  tenantKey: string;
  displayName: string;
  status: string;
  packDependencies?: Array<{
    packKey: string;
    manifestSha256?: string;
    contractSha256?: string;
    providedExtensions?: string[];
    aliases?: Array<{
      sourceExtensionKey: string;
      extensionKey: string;
    }>;
  }>;
  ownedExtensions: Array<{
    extensionSlug: string;
    extensionKey: string;
    displayName: string;
    rootPath?: string;
  }>;
};

type PackProvidedExtensionFixture = {
  extensionKey: string;
  extensionSlug: string;
  rootPath: string;
};
