import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { effectModes } from "./worker-skill-resource/contract";

const supportedWorkspaceClasses = ["CUSTOMER", "HELM_RESERVED"] as const;

type SupportedWorkspaceClass = (typeof supportedWorkspaceClasses)[number];
type BundleEffectMode = (typeof effectModes)[number];

type RuntimeDeclarationSet = {
  workers: unknown[];
  skills: unknown[];
  resources: unknown[];
  hooks: unknown[];
  monitors: unknown[];
  surfaces: string[];
};

type CapabilityManifest = {
  capabilityDeclarations: string[];
  maxEffectMode: BundleEffectMode;
  customerFacingAllowed: boolean;
  requiresReviewByDefault: boolean;
  nonCommitmentOnly: boolean;
};

export type TenantExtensionResourceDependencyDeclaration = {
  resourceDependencyKey: string;
  provider: string;
  declaredCapabilityModes: BundleEffectMode[];
  objectBindings: string[];
  policyHints: string[];
};

type DependencyDeclarations = {
  connectors: string[];
  workspaceTruths: string[];
  policyTruths: string[];
};

type DocumentationPointers = {
  readme: string;
  docs: string[];
};

type EvalContract = {
  fixtures: string[];
  checks: string[];
};

export type TenantExtensionManifest = {
  manifestVersion: string;
  bundleVersion: string;
  extensionKey: string;
  tenantKey: string;
  extensionSlug: string;
  displayName: string;
  kind: string;
  status: string;
  owner?: string;
  nonCoreDeclaration?: boolean;
  compatibility: {
    minRuntimeContractVersion: string;
    supportedWorkspaceClasses: SupportedWorkspaceClass[];
    requiredFeatures: string[];
  };
  migrationHints: string[];
  runtimeDeclarations: RuntimeDeclarationSet;
  capabilityManifest: CapabilityManifest;
  dependencyDeclarations: DependencyDeclarations;
  resourceDependencyDeclarations?: TenantExtensionResourceDependencyDeclaration[];
  documentationPointers: DocumentationPointers;
  evalContract: EvalContract;
  summary?: string;
  surfaces?: string[];
  apiPrefixes?: string[];
  ownedAssets?: string[];
  capabilities?: string[];
  notes?: string[];
};

export type TenantManifest = {
  tenantKey: string;
  displayName: string;
  status: string;
  ownedExtensions: Array<{
    extensionSlug: string;
    extensionKey: string;
    displayName: string;
    rootPath?: string;
  }>;
};

export type TenantExtensionManifestValidationResult = {
  extensionKey: string;
  manifestPath: string;
  ok: boolean;
  issues: string[];
};

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function resolveExtensionsRoot() {
  return path.join(/* turbopackIgnore: true */ process.cwd(), "extensions");
}

export function resolveTenantManifestPath(tenantKey: string, extensionsRoot = resolveExtensionsRoot()) {
  return path.join(extensionsRoot, tenantKey, "tenant.manifest.json");
}

export function resolveTenantExtensionRoot(
  input: { tenantKey: string; extensionSlug: string },
  extensionsRoot = resolveExtensionsRoot(),
) {
  return path.join(extensionsRoot, input.tenantKey, input.extensionSlug);
}

export function resolveTenantExtensionManifestPath(
  input: { tenantKey: string; extensionSlug: string },
  extensionsRoot = resolveExtensionsRoot(),
) {
  return path.join(resolveTenantExtensionRoot(input, extensionsRoot), "extension.manifest.json");
}

function listTenantExtensionManifestDescriptors(extensionsRoot = resolveExtensionsRoot()) {
  const descriptors: Array<{
    tenantKey: string;
    extensionSlug: string;
    manifestPath: string;
  }> = [];

  for (const tenantEntry of readdirSync(extensionsRoot, { withFileTypes: true })) {
    if (!tenantEntry.isDirectory()) {
      continue;
    }

    const tenantRoot = path.join(extensionsRoot, tenantEntry.name);
    for (const extensionEntry of readdirSync(tenantRoot, { withFileTypes: true })) {
      if (!extensionEntry.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(tenantRoot, extensionEntry.name, "extension.manifest.json");
      if (!existsSync(manifestPath)) {
        continue;
      }

      descriptors.push({
        tenantKey: tenantEntry.name,
        extensionSlug: extensionEntry.name,
        manifestPath,
      });
    }
  }

  return descriptors;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyStringArray(value: unknown) {
  return isStringArray(value) && value.length > 0;
}

function pushMissingField(issues: string[], fieldPath: string) {
  issues.push(`${fieldPath} must be present`);
}

function validateRelativeFilePointers(input: {
  extensionRoot: string;
  issues: string[];
  fieldPath: string;
  values: string[];
}) {
  for (const value of input.values) {
    if (!isNonEmptyString(value)) {
      input.issues.push(`${input.fieldPath} contains an empty path`);
      continue;
    }

    const filePath = path.join(input.extensionRoot, value);
    if (!existsSync(filePath)) {
      input.issues.push(`${input.fieldPath} points to a missing file: ${value}`);
    }
  }
}

export function validateTenantExtensionManifestBundle(input: {
  manifestPath: string;
  manifest: TenantExtensionManifest;
  tenantManifest: TenantManifest;
}) {
  const issues: string[] = [];
  const extensionRoot = path.dirname(input.manifestPath);
  const tenantRoot = path.dirname(extensionRoot);
  const tenantKeyFromDir = path.basename(tenantRoot);
  const extensionSlugFromDir = path.basename(extensionRoot);
  const expectedExtensionKey = `${tenantKeyFromDir}-${extensionSlugFromDir}`;

  if (input.manifest.tenantKey !== tenantKeyFromDir) {
    issues.push(`tenantKey must match directory name (${tenantKeyFromDir})`);
  }

  if (input.manifest.extensionSlug !== extensionSlugFromDir) {
    issues.push(`extensionSlug must match directory name (${extensionSlugFromDir})`);
  }

  if (input.manifest.extensionKey !== expectedExtensionKey) {
    issues.push(`extensionKey must equal ${expectedExtensionKey}`);
  }

  const ownedExtension = input.tenantManifest.ownedExtensions.find(
    (item) => item.extensionSlug === extensionSlugFromDir,
  );
  if (!ownedExtension) {
    issues.push(`tenant.manifest.json must include ownedExtensions entry for ${extensionSlugFromDir}`);
  } else {
    if (ownedExtension.extensionKey !== expectedExtensionKey) {
      issues.push(`tenant.manifest.json entry for ${extensionSlugFromDir} must use extensionKey ${expectedExtensionKey}`);
    }
    if (
      isNonEmptyString(ownedExtension.rootPath) &&
      ownedExtension.rootPath !== path.relative(process.cwd(), extensionRoot)
    ) {
      issues.push(
        `tenant.manifest.json rootPath for ${extensionSlugFromDir} must equal ${path.relative(process.cwd(), extensionRoot)}`,
      );
    }
  }

  if (!isNonEmptyString(input.manifest.manifestVersion)) {
    pushMissingField(issues, "manifestVersion");
  }

  if (!isNonEmptyString(input.manifest.bundleVersion)) {
    pushMissingField(issues, "bundleVersion");
  }

  if (input.manifest.status !== "ACTIVE") {
    issues.push("status must stay ACTIVE for read-only bundle validation samples");
  }

  if (!isNonEmptyString(input.manifest.compatibility?.minRuntimeContractVersion)) {
    pushMissingField(issues, "compatibility.minRuntimeContractVersion");
  }

  if (!isStringArray(input.manifest.compatibility?.supportedWorkspaceClasses)) {
    pushMissingField(issues, "compatibility.supportedWorkspaceClasses");
  } else if (input.manifest.compatibility.supportedWorkspaceClasses.length === 0) {
    issues.push("compatibility.supportedWorkspaceClasses must not be empty");
  } else {
    for (const workspaceClass of input.manifest.compatibility.supportedWorkspaceClasses) {
      if (!supportedWorkspaceClasses.includes(workspaceClass as SupportedWorkspaceClass)) {
        issues.push(`compatibility.supportedWorkspaceClasses contains unsupported value: ${workspaceClass}`);
      }
    }
  }

  if (!isStringArray(input.manifest.compatibility?.requiredFeatures)) {
    pushMissingField(issues, "compatibility.requiredFeatures");
  } else if (input.manifest.compatibility.requiredFeatures.length === 0) {
    issues.push("compatibility.requiredFeatures must not be empty");
  }

  if (!isStringArray(input.manifest.migrationHints)) {
    pushMissingField(issues, "migrationHints");
  }

  const runtimeDeclarations = input.manifest.runtimeDeclarations;
  if (!runtimeDeclarations || typeof runtimeDeclarations !== "object") {
    pushMissingField(issues, "runtimeDeclarations");
  } else {
    for (const fieldName of ["workers", "skills", "resources", "hooks", "monitors", "surfaces"] as const) {
      if (!Array.isArray(runtimeDeclarations[fieldName])) {
        issues.push(`runtimeDeclarations.${fieldName} must be an array`);
      }
    }

    if (Array.isArray(runtimeDeclarations.surfaces)) {
      for (const surface of runtimeDeclarations.surfaces) {
        if (!isNonEmptyString(surface)) {
          issues.push("runtimeDeclarations.surfaces must only contain non-empty strings");
        }
      }

      if (Array.isArray(input.manifest.surfaces)) {
        for (const surface of input.manifest.surfaces) {
          if (!runtimeDeclarations.surfaces.includes(surface)) {
            issues.push(`runtimeDeclarations.surfaces must include legacy surface pointer ${surface}`);
          }
        }
      }
    }
  }

  const capabilityManifest = input.manifest.capabilityManifest;
  if (!capabilityManifest || typeof capabilityManifest !== "object") {
    pushMissingField(issues, "capabilityManifest");
  } else {
    if (!isStringArray(capabilityManifest.capabilityDeclarations) || capabilityManifest.capabilityDeclarations.length === 0) {
      issues.push("capabilityManifest.capabilityDeclarations must be a non-empty string array");
    }

    if (!effectModes.includes(capabilityManifest.maxEffectMode)) {
      issues.push(`capabilityManifest.maxEffectMode must be one of ${effectModes.join(", ")}`);
    } else if (capabilityManifest.maxEffectMode === "customer_visible_send") {
      issues.push("capabilityManifest.maxEffectMode must not declare customer_visible_send in read-only validation phase");
    }

    for (const fieldName of [
      "customerFacingAllowed",
      "requiresReviewByDefault",
      "nonCommitmentOnly",
    ] as const) {
      if (typeof capabilityManifest[fieldName] !== "boolean") {
        issues.push(`capabilityManifest.${fieldName} must be boolean`);
      }
    }

    if (capabilityManifest.customerFacingAllowed && !capabilityManifest.requiresReviewByDefault) {
      issues.push("customer-facing bundle declarations must keep requiresReviewByDefault=true");
    }

    if (capabilityManifest.customerFacingAllowed && !capabilityManifest.nonCommitmentOnly) {
      issues.push("customer-facing bundle declarations must keep nonCommitmentOnly=true");
    }
  }

  const dependencyDeclarations = input.manifest.dependencyDeclarations;
  if (!dependencyDeclarations || typeof dependencyDeclarations !== "object") {
    pushMissingField(issues, "dependencyDeclarations");
  } else {
    for (const fieldName of ["connectors", "workspaceTruths", "policyTruths"] as const) {
      if (!isStringArray(dependencyDeclarations[fieldName])) {
        issues.push(`dependencyDeclarations.${fieldName} must be a string array`);
      }
    }
  }

  const resourceDependencyDeclarations = input.manifest.resourceDependencyDeclarations;
  if (resourceDependencyDeclarations !== undefined) {
    if (!Array.isArray(resourceDependencyDeclarations) || resourceDependencyDeclarations.length === 0) {
      issues.push("resourceDependencyDeclarations must be a non-empty array when present");
    } else {
      for (const [index, declaration] of resourceDependencyDeclarations.entries()) {
        const fieldPath = `resourceDependencyDeclarations[${index}]`;
        if (!declaration || typeof declaration !== "object") {
          issues.push(`${fieldPath} must be an object`);
          continue;
        }

        if (!isNonEmptyString(declaration.resourceDependencyKey)) {
          issues.push(`${fieldPath}.resourceDependencyKey must be present`);
        }
        if (!isNonEmptyString(declaration.provider)) {
          issues.push(`${fieldPath}.provider must be present`);
        }
        if (!isNonEmptyStringArray(declaration.declaredCapabilityModes)) {
          issues.push(`${fieldPath}.declaredCapabilityModes must be a non-empty string array`);
        } else {
          for (const mode of declaration.declaredCapabilityModes) {
            if (!effectModes.includes(mode as BundleEffectMode)) {
              issues.push(
                `${fieldPath}.declaredCapabilityModes contains unsupported mode: ${mode}`,
              );
            }
            if (mode === "customer_visible_send") {
              issues.push(
                `${fieldPath}.declaredCapabilityModes must not declare customer_visible_send in phase 4 adoption`,
              );
            }
          }
        }
        if (!isNonEmptyStringArray(declaration.objectBindings)) {
          issues.push(`${fieldPath}.objectBindings must be a non-empty string array`);
        }
        if (!isNonEmptyStringArray(declaration.policyHints)) {
          issues.push(`${fieldPath}.policyHints must be a non-empty string array`);
        }
      }
    }
  }

  const documentationPointers = input.manifest.documentationPointers;
  if (!documentationPointers || typeof documentationPointers !== "object") {
    pushMissingField(issues, "documentationPointers");
  } else {
    if (!isNonEmptyString(documentationPointers.readme)) {
      issues.push("documentationPointers.readme must be present");
    } else {
      validateRelativeFilePointers({
        extensionRoot,
        issues,
        fieldPath: "documentationPointers.readme",
        values: [documentationPointers.readme],
      });
    }

    if (!isStringArray(documentationPointers.docs) || documentationPointers.docs.length === 0) {
      issues.push("documentationPointers.docs must be a non-empty string array");
    } else {
      validateRelativeFilePointers({
        extensionRoot,
        issues,
        fieldPath: "documentationPointers.docs",
        values: documentationPointers.docs,
      });
    }
  }

  const evalContract = input.manifest.evalContract;
  if (!evalContract || typeof evalContract !== "object") {
    pushMissingField(issues, "evalContract");
  } else {
    if (!isStringArray(evalContract.fixtures)) {
      issues.push("evalContract.fixtures must be a string array");
    } else {
      validateRelativeFilePointers({
        extensionRoot,
        issues,
        fieldPath: "evalContract.fixtures",
        values: evalContract.fixtures,
      });
    }

    if (!isStringArray(evalContract.checks) || evalContract.checks.length === 0) {
      issues.push("evalContract.checks must be a non-empty string array");
    } else {
      validateRelativeFilePointers({
        extensionRoot,
        issues,
        fieldPath: "evalContract.checks",
        values: evalContract.checks,
      });
    }
  }

  return {
    extensionKey: input.manifest.extensionKey,
    manifestPath: input.manifestPath,
    ok: issues.length === 0,
    issues,
  } satisfies TenantExtensionManifestValidationResult;
}

export function collectTenantExtensionManifestValidationReadout(extensionsRoot = resolveExtensionsRoot()) {
  const results: TenantExtensionManifestValidationResult[] = [];

  for (const descriptor of listTenantExtensionManifestDescriptors(extensionsRoot)) {
    const tenantManifest = loadTenantManifest(descriptor.tenantKey, extensionsRoot);
    const manifest = readJsonFile<TenantExtensionManifest>(descriptor.manifestPath);
    results.push(
      validateTenantExtensionManifestBundle({
        manifestPath: descriptor.manifestPath,
        manifest,
        tenantManifest,
      }),
    );
  }

  return results;
}

export function loadTenantManifest(tenantKey: string, extensionsRoot = resolveExtensionsRoot()): TenantManifest {
  const manifestPath = resolveTenantManifestPath(tenantKey, extensionsRoot);
  if (!existsSync(manifestPath)) {
    throw new Error(`tenant manifest not found for tenantKey=${tenantKey}`);
  }
  return readJsonFile<TenantManifest>(manifestPath);
}

export function loadTenantExtensionManifest(
  input: { tenantKey: string; extensionSlug: string },
  extensionsRoot = resolveExtensionsRoot(),
) {
  const manifestPath = resolveTenantExtensionManifestPath(input, extensionsRoot);
  if (!existsSync(manifestPath)) {
    throw new Error(
      `extension manifest not found for tenantKey=${input.tenantKey}, extensionSlug=${input.extensionSlug}`,
    );
  }
  return readJsonFile<TenantExtensionManifest>(manifestPath);
}

export function findTenantExtensionManifestByExtensionKey(extensionKey: string) {
  const normalizedKey = extensionKey.trim();
  if (!normalizedKey) {
    throw new Error("extensionKey must not be empty");
  }

  for (const descriptor of listTenantExtensionManifestDescriptors()) {
    const manifest = readJsonFile<TenantExtensionManifest>(descriptor.manifestPath);
    if (manifest.extensionKey === normalizedKey) {
      return manifest;
    }
  }

  throw new Error(`extension manifest not found for extensionKey=${normalizedKey}`);
}
