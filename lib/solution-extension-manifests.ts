import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { effectModes } from "./worker-skill-resource/contract";

const supportedWorkspaceClasses = ["CUSTOMER", "HELM_RESERVED"] as const;
const packOwnedEffectModes = ["human_seat_write"] as const;

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
  packDependencies?: Array<{
    packKey: string;
    manifestSha256: string;
    contractSha256: string;
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

type CanonicalPackProvidedExtension = {
  extensionKey: string;
  extensionSlug: string;
  rootPath: string;
  physicalExtensionSlug: string;
};

type PackDependencyAuthority = {
  packKey: string;
  providedExtensions: CanonicalPackProvidedExtension[];
  aliases: PackDependencyAlias[];
  authorityRoot: string;
};

type PackDependencyAlias = {
  sourceExtensionKey: string;
  extensionKey: string;
};

type PackDependencyBinding = {
  packKey: string;
  sourceExtensionKey: string;
  alias: boolean;
  logicalExtensionSlug: string;
  physicalExtensionSlug: string;
  canonicalManifestPath: string;
};

export type TenantExtensionManifestValidationResult = {
  extensionKey: string;
  manifestPath: string;
  validationScope: "tenant-owned" | "pack-dependency" | "pack-authority";
  sourceExtensionKey?: string;
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

function listTenantManifestDescriptors(extensionsRoot = resolveExtensionsRoot()) {
  const descriptors: Array<{ tenantKey: string; manifestPath: string }> = [];
  for (const tenantEntry of readdirSync(extensionsRoot, { withFileTypes: true })) {
    if (!tenantEntry.isDirectory()) continue;
    const manifestPath = path.join(extensionsRoot, tenantEntry.name, "tenant.manifest.json");
    if (existsSync(manifestPath)) {
      descriptors.push({ tenantKey: tenantEntry.name, manifestPath });
    }
  }
  return descriptors;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return isStringArray(value) && value.length > 0;
}

function isExactSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isSafePackKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/.test(value);
}

function sha256File(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function resolvePackAuthoritiesRoot(extensionsRoot: string) {
  return path.join(path.dirname(extensionsRoot), "pack-authority");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRegularFile(filePath: string, label: string, issues: string[]) {
  try {
    const stat = lstatSync(filePath);
    if (stat.isSymbolicLink()) {
      issues.push(`${label} must not be a symbolic link`);
      return false;
    }
    if (!stat.isFile()) {
      issues.push(`${label} must be a regular file`);
      return false;
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      issues.push(`${label} is missing`);
      return false;
    }
    throw error;
  }
}

function requireDirectory(directoryPath: string, label: string, issues: string[]) {
  try {
    const stat = lstatSync(directoryPath);
    if (stat.isSymbolicLink()) {
      issues.push(`${label} must not be a symbolic link`);
      return false;
    }
    if (!stat.isDirectory()) {
      issues.push(`${label} must be a directory`);
      return false;
    }
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      issues.push(`${label} is missing`);
      return false;
    }
    throw error;
  }
}

function resolveCanonicalPackPhysicalSlug(input: {
  packKey: string;
  rootPath: unknown;
}) {
  if (!isNonEmptyString(input.rootPath)) return null;

  const normalized = input.rootPath.replaceAll("\\", "/");
  const expectedPrefix = `packs/${input.packKey}/`;
  if (
    !normalized.startsWith(expectedPrefix) ||
    normalized.endsWith("/") ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  const physicalExtensionSlug = normalized.slice(expectedPrefix.length);
  return isSafePackKey(physicalExtensionSlug) ? physicalExtensionSlug : null;
}

function resolvePackDependencyAliases(input: {
  tenantKey: string;
  packKey: string;
  dependency: Record<string, unknown>;
  providedExtensions: CanonicalPackProvidedExtension[];
}): { aliases: PackDependencyAlias[]; issues: string[] } {
  const rawAliases = input.dependency.aliases;
  if (rawAliases === undefined) return { aliases: [], issues: [] };

  const issues: string[] = [];
  if (!Array.isArray(rawAliases)) {
    return {
      aliases: [],
      issues: [`pack dependency ${input.packKey} aliases must be an array`],
    };
  }

  const aliases: PackDependencyAlias[] = [];
  const seenSourceKeys = new Set<string>();
  const seenExtensionKeys = new Set<string>();
  for (const [index, candidate] of rawAliases.entries()) {
    if (!isRecord(candidate)) {
      issues.push(`pack dependency ${input.packKey} aliases[${index}] must be an object`);
      continue;
    }
    const sourceExtensionKey = candidate.sourceExtensionKey;
    const extensionKey = candidate.extensionKey;
    if (!isNonEmptyString(sourceExtensionKey)) {
      issues.push(
        `pack dependency ${input.packKey} aliases[${index}].sourceExtensionKey must be present`,
      );
    }
    if (!isNonEmptyString(extensionKey)) {
      issues.push(
        `pack dependency ${input.packKey} aliases[${index}].extensionKey must be present`,
      );
    }
    if (!isNonEmptyString(sourceExtensionKey) || !isNonEmptyString(extensionKey)) {
      continue;
    }

    const source = input.providedExtensions.find(
      (extension) => extension.extensionKey === sourceExtensionKey,
    );
    if (!source) {
      issues.push(
        `pack dependency ${input.packKey} aliases[${index}].sourceExtensionKey must reference a canonical Pack extension`,
      );
      continue;
    }
    const expectedExtensionKey = `${input.tenantKey}-${source.extensionSlug}`;
    if (extensionKey !== expectedExtensionKey) {
      issues.push(
        `pack dependency ${input.packKey} aliases[${index}].extensionKey must equal ${expectedExtensionKey}`,
      );
      continue;
    }
    if (seenSourceKeys.has(sourceExtensionKey)) {
      issues.push(
        `pack dependency ${input.packKey} aliases must not duplicate sourceExtensionKey ${sourceExtensionKey}`,
      );
      continue;
    }
    if (seenExtensionKeys.has(extensionKey)) {
      issues.push(
        `pack dependency ${input.packKey} aliases must not duplicate extensionKey ${extensionKey}`,
      );
      continue;
    }
    seenSourceKeys.add(sourceExtensionKey);
    seenExtensionKeys.add(extensionKey);
    aliases.push({ sourceExtensionKey, extensionKey });
  }

  return { aliases, issues };
}

function loadPackDependencyAuthority(input: {
  tenantKey: string;
  dependency: Record<string, unknown>;
  packAuthoritiesRoot: string;
  index: number;
}) {
  const issues: string[] = [];
  const packKey = input.dependency.packKey;
  if (!isSafePackKey(packKey)) {
    return {
      authority: null,
      issues: [
        `packDependencies[${input.index}].packKey must be a safe lowercase package key`,
      ],
    } as const;
  }

  if ("providedExtensions" in input.dependency) {
    issues.push(
      `pack dependency ${packKey} must not declare providedExtensions; the canonical Pack manifest is the authority`,
    );
  }

  const manifestSha256 = input.dependency.manifestSha256;
  const contractSha256 = input.dependency.contractSha256;
  if (!isExactSha256(manifestSha256)) {
    issues.push(`pack dependency ${packKey} manifestSha256 must be a lowercase SHA-256`);
  }
  if (!isExactSha256(contractSha256)) {
    issues.push(`pack dependency ${packKey} contractSha256 must be a lowercase SHA-256`);
  }

  const authorityRoot = path.join(input.packAuthoritiesRoot, packKey);
  const manifestPath = path.join(authorityRoot, "pack.manifest.json");
  const contractPath = path.join(authorityRoot, "pack-contract.json");
  requireDirectory(authorityRoot, `pack dependency ${packKey} authority root`, issues);
  requireRegularFile(manifestPath, `pack dependency ${packKey} canonical Pack manifest`, issues);
  requireRegularFile(contractPath, `pack dependency ${packKey} canonical Pack contract`, issues);
  if (issues.length > 0) return { authority: null, issues } as const;

  if (sha256File(manifestPath) !== manifestSha256) {
    issues.push(
      `pack dependency ${packKey} manifestSha256 must match the canonical Pack manifest`,
    );
  }
  if (sha256File(contractPath) !== contractSha256) {
    issues.push(
      `pack dependency ${packKey} contractSha256 must match the canonical Pack contract`,
    );
  }

  let packManifest: unknown;
  let packContract: unknown;
  try {
    packManifest = readJsonFile<unknown>(manifestPath);
  } catch {
    issues.push(`pack dependency ${packKey} canonical Pack manifest must contain JSON`);
  }
  try {
    packContract = readJsonFile<unknown>(contractPath);
  } catch {
    issues.push(`pack dependency ${packKey} canonical Pack contract must contain JSON`);
  }
  if (issues.length > 0) return { authority: null, issues } as const;

  if (!packManifest || typeof packManifest !== "object") {
    issues.push(`pack dependency ${packKey} canonical Pack manifest must be an object`);
  }
  if (!packContract || typeof packContract !== "object") {
    issues.push(`pack dependency ${packKey} canonical Pack contract must be an object`);
  }
  if (issues.length > 0) return { authority: null, issues } as const;

  const manifest = packManifest as {
    packKey?: unknown;
    providedExtensions?: unknown;
  };
  const contract = packContract as {
    packKey?: unknown;
    providedExtensionKeys?: unknown;
  };
  if (manifest.packKey !== packKey) {
    issues.push(`pack dependency ${packKey} canonical Pack manifest packKey must match`);
  }
  if (contract.packKey !== packKey) {
    issues.push(`pack dependency ${packKey} canonical Pack contract packKey must match`);
  }
  const canonicalProvidedExtensions: unknown[] | null = Array.isArray(manifest.providedExtensions)
    ? manifest.providedExtensions
    : null;
  const rawProvidedExtensionKeys = contract.providedExtensionKeys;
  const canonicalProvidedExtensionKeys: string[] | null = isNonEmptyStringArray(
    rawProvidedExtensionKeys,
  )
    ? [...rawProvidedExtensionKeys]
    : null;
  if (!canonicalProvidedExtensions || canonicalProvidedExtensions.length === 0) {
    issues.push(`pack dependency ${packKey} canonical Pack manifest must provide extensions`);
  }
  if (!canonicalProvidedExtensionKeys) {
    issues.push(`pack dependency ${packKey} canonical Pack contract must provide extension keys`);
  }
  if (!canonicalProvidedExtensions || !canonicalProvidedExtensionKeys) {
    return { authority: null, issues } as const;
  }

  const providedExtensions: CanonicalPackProvidedExtension[] = [];
  for (const [extensionIndex, candidate] of canonicalProvidedExtensions.entries()) {
    if (!isRecord(candidate)) {
      issues.push(
        `pack dependency ${packKey} canonical Pack manifest extension ${extensionIndex} must be an object`,
      );
      continue;
    }
    const extension = candidate as Record<string, unknown>;
    if (!isNonEmptyString(extension.extensionKey)) {
      issues.push(
        `pack dependency ${packKey} canonical Pack manifest extension ${extensionIndex} must declare extensionKey`,
      );
    }
    if (!isNonEmptyString(extension.extensionSlug)) {
      issues.push(
        `pack dependency ${packKey} canonical Pack manifest extension ${extensionIndex} must declare extensionSlug`,
      );
    }
    const physicalExtensionSlug = resolveCanonicalPackPhysicalSlug({
      packKey,
      rootPath: extension.rootPath,
    });
    if (!physicalExtensionSlug) {
      issues.push(
        `pack dependency ${packKey} canonical Pack manifest extension ${extensionIndex} must declare a safe Pack rootPath`,
      );
    }
    if (
      isNonEmptyString(extension.extensionKey) &&
      isNonEmptyString(extension.extensionSlug) &&
      physicalExtensionSlug
    ) {
      providedExtensions.push({
        extensionKey: extension.extensionKey,
        extensionSlug: extension.extensionSlug,
        rootPath: extension.rootPath as string,
        physicalExtensionSlug,
      });
    }
  }

  const providedExtensionKeys = providedExtensions.map(
    (extension) => extension.extensionKey,
  );
  const providedExtensionSlugs = providedExtensions.map(
    (extension) => extension.extensionSlug,
  );
  const physicalExtensionSlugs = providedExtensions.map(
    (extension) => extension.physicalExtensionSlug,
  );
  if (new Set(providedExtensionKeys).size !== providedExtensionKeys.length) {
    issues.push(`pack dependency ${packKey} canonical Pack manifest must not duplicate extensionKey`);
  }
  if (new Set(providedExtensionSlugs).size !== providedExtensionSlugs.length) {
    issues.push(`pack dependency ${packKey} canonical Pack manifest must not duplicate extensionSlug`);
  }
  if (new Set(physicalExtensionSlugs).size !== physicalExtensionSlugs.length) {
    issues.push(
      `pack dependency ${packKey} canonical Pack manifest must not duplicate physical extension directory`,
    );
  }
  if (
    providedExtensionKeys.length !== canonicalProvidedExtensionKeys.length ||
    providedExtensionKeys.some(
      (extensionKey, index) => extensionKey !== canonicalProvidedExtensionKeys[index],
    )
  ) {
    issues.push(
      `pack dependency ${packKey} canonical Pack manifest and contract extension identities must match in order`,
    );
  }
  if (issues.length > 0) return { authority: null, issues } as const;

  const aliases = resolvePackDependencyAliases({
    tenantKey: input.tenantKey,
    packKey,
    dependency: input.dependency,
    providedExtensions,
  });
  issues.push(...aliases.issues);
  if (issues.length > 0) return { authority: null, issues } as const;

  return {
    authority: {
      packKey,
      providedExtensions,
      aliases: aliases.aliases,
      authorityRoot,
    } satisfies PackDependencyAuthority,
    issues,
  } as const;
}

function loadPackDependencyAuthorities(input: {
  tenantKey: string;
  tenantManifest: TenantManifest;
  packAuthoritiesRoot: string;
}) {
  const authorities: PackDependencyAuthority[] = [];
  const issues: string[] = [];
  const seenPackKeys = new Set<string>();
  for (const [index, dependency] of (input.tenantManifest.packDependencies ?? []).entries()) {
    const resolved = loadPackDependencyAuthority({
      tenantKey: input.tenantKey,
      dependency: dependency as unknown as Record<string, unknown>,
      packAuthoritiesRoot: input.packAuthoritiesRoot,
      index,
    });
    issues.push(...resolved.issues);
    if (!resolved.authority) continue;
    if (seenPackKeys.has(resolved.authority.packKey)) {
      issues.push(`pack dependency ${resolved.authority.packKey} must not be declared more than once`);
      continue;
    }
    seenPackKeys.add(resolved.authority.packKey);
    authorities.push(resolved.authority);
  }
  return { authorities, issues } as const;
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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hasSameJson(left: unknown, right: unknown) {
  return stableJson(left) === stableJson(right);
}

function validateStringListSubset(input: {
  source: unknown;
  assembled: unknown;
  fieldPath: string;
  issues: string[];
}) {
  const source = input.source;
  const assembled = input.assembled;
  if (source === undefined && assembled === undefined) {
    return;
  }
  if (!isStringArray(source) || !isStringArray(assembled)) {
    input.issues.push(`${input.fieldPath} must remain string arrays under Pack authority`);
    return;
  }
  if (!assembled.every((value) => source.includes(value))) {
    input.issues.push(`${input.fieldPath} must not expand canonical Pack authority`);
  }
}

function validateCanonicalResourceDependencies(input: {
  source: unknown;
  assembled: unknown;
  issues: string[];
}) {
  if (input.source === undefined && input.assembled === undefined) return;
  if (!Array.isArray(input.source) || !Array.isArray(input.assembled)) {
    input.issues.push("resourceDependencyDeclarations must remain arrays under Pack authority");
    return;
  }
  if (input.source.length !== input.assembled.length) {
    input.issues.push("resourceDependencyDeclarations must not expand canonical Pack authority");
    return;
  }
  for (const [index, sourceEntry] of input.source.entries()) {
    const assembledEntry = input.assembled[index];
    if (!isRecord(sourceEntry) || !isRecord(assembledEntry)) {
      input.issues.push("resourceDependencyDeclarations entries must be objects under Pack authority");
      continue;
    }
    const sourceWithoutKey = { ...sourceEntry };
    const assembledWithoutKey = { ...assembledEntry };
    delete sourceWithoutKey.resourceDependencyKey;
    delete assembledWithoutKey.resourceDependencyKey;
    if (!hasSameJson(sourceWithoutKey, assembledWithoutKey)) {
      input.issues.push("resourceDependencyDeclarations must not change canonical Pack authority");
    }
    if (!isNonEmptyString(assembledEntry.resourceDependencyKey)) {
      input.issues.push(
        `resourceDependencyDeclarations[${index}].resourceDependencyKey must remain non-empty under Pack authority`,
      );
    }
  }
}

function validateCanonicalPackExtensionManifest(input: {
  manifest: TenantExtensionManifest;
  tenantKey: string;
  binding: PackDependencyBinding;
  issues: string[];
}) {
  if (!requireRegularFile(
    input.binding.canonicalManifestPath,
    `pack dependency ${input.binding.packKey} canonical extension manifest`,
    input.issues,
  )) {
    return;
  }

  let sourceManifest: unknown;
  try {
    sourceManifest = readJsonFile<unknown>(input.binding.canonicalManifestPath);
  } catch {
    input.issues.push(
      `pack dependency ${input.binding.packKey} canonical extension manifest must contain JSON`,
    );
    return;
  }
  if (!isRecord(sourceManifest)) {
    input.issues.push(
      `pack dependency ${input.binding.packKey} canonical extension manifest must be an object`,
    );
    return;
  }
  if (sourceManifest.extensionKey !== input.binding.sourceExtensionKey) {
    input.issues.push(
      `pack dependency ${input.binding.packKey} canonical extension manifest extensionKey must equal ${input.binding.sourceExtensionKey}`,
    );
  }
  if (sourceManifest.extensionSlug !== input.binding.logicalExtensionSlug) {
    input.issues.push(
      `pack dependency ${input.binding.packKey} canonical extension manifest extensionSlug must equal ${input.binding.logicalExtensionSlug}`,
    );
  }

  if (!input.binding.alias) {
    if (!hasSameJson(sourceManifest, input.manifest)) {
      input.issues.push(
        "direct Pack extension manifest must exactly match canonical Pack authority",
      );
    }
    return;
  }

  const assembledManifest = input.manifest as unknown as Record<string, unknown>;
  const tenantIdentityFields = new Set([
    "apiPrefixes",
    "apiRouteContracts",
    "bundleVersion",
    "displayName",
    "extensionKey",
    "notes",
    "owner",
    "summary",
    "surfaces",
    "tenantKey",
  ]);
  const sourceKeys = new Set(Object.keys(sourceManifest));
  const assembledKeys = new Set(Object.keys(assembledManifest));
  for (const key of assembledKeys) {
    if (!sourceKeys.has(key) && !tenantIdentityFields.has(key)) {
      input.issues.push(`Pack alias manifest adds unsupported authority field ${key}`);
    }
  }
  for (const key of sourceKeys) {
    if (!assembledKeys.has(key) && !tenantIdentityFields.has(key)) {
      input.issues.push(`Pack alias manifest omits canonical authority field ${key}`);
    }
  }

  for (const key of sourceKeys) {
    if (tenantIdentityFields.has(key)) continue;
    if (key === "runtimeDeclarations") {
      const sourceRuntime = sourceManifest.runtimeDeclarations;
      const assembledRuntime = assembledManifest.runtimeDeclarations;
      if (!isRecord(sourceRuntime) || !isRecord(assembledRuntime)) {
        input.issues.push("runtimeDeclarations must remain objects under Pack authority");
        continue;
      }
      const sourceWithoutSurfaces = { ...sourceRuntime };
      const assembledWithoutSurfaces = { ...assembledRuntime };
      delete sourceWithoutSurfaces.surfaces;
      delete assembledWithoutSurfaces.surfaces;
      if (!hasSameJson(sourceWithoutSurfaces, assembledWithoutSurfaces)) {
        input.issues.push("runtimeDeclarations must not change canonical Pack authority");
      }
      validateStringListSubset({
        source: sourceRuntime.surfaces,
        assembled: assembledRuntime.surfaces,
        fieldPath: "runtimeDeclarations.surfaces",
        issues: input.issues,
      });
      continue;
    }
    if (key === "resourceDependencyDeclarations") {
      validateCanonicalResourceDependencies({
        source: sourceManifest.resourceDependencyDeclarations,
        assembled: assembledManifest.resourceDependencyDeclarations,
        issues: input.issues,
      });
      continue;
    }
    if (!hasSameJson(sourceManifest[key], assembledManifest[key])) {
      input.issues.push(`Pack alias manifest changes canonical authority field ${key}`);
    }
  }

  validateStringListSubset({
    source: sourceManifest.surfaces,
    assembled: assembledManifest.surfaces,
    fieldPath: "surfaces",
    issues: input.issues,
  });
  validateStringListSubset({
    source: sourceManifest.apiPrefixes,
    assembled: assembledManifest.apiPrefixes,
    fieldPath: "apiPrefixes",
    issues: input.issues,
  });
  if (assembledManifest.apiRouteContracts !== undefined) {
    const expectedRouteContract = `overlay-route-contract:${input.tenantKey}-${input.binding.logicalExtensionSlug}`;
    if (
      !isStringArray(assembledManifest.apiRouteContracts) ||
      !assembledManifest.apiRouteContracts.every((contract) => contract === expectedRouteContract)
    ) {
      input.issues.push("Pack alias apiRouteContracts must remain tenant-local route contracts");
    }
  }
}

export function validateTenantExtensionManifestBundle(input: {
  manifestPath: string;
  manifest: TenantExtensionManifest;
  tenantManifest: TenantManifest;
  packDependencyBinding?: PackDependencyBinding;
}) {
  const issues: string[] = [];
  const extensionRoot = path.dirname(input.manifestPath);
  const tenantRoot = path.dirname(extensionRoot);
  const tenantKeyFromDir = path.basename(tenantRoot);
  const extensionSlugFromDir = path.basename(extensionRoot);
  const expectedExtensionKey = `${tenantKeyFromDir}-${extensionSlugFromDir}`;

  if (input.packDependencyBinding) {
    const binding = input.packDependencyBinding;
    if (extensionSlugFromDir !== binding.physicalExtensionSlug) {
      issues.push(
        `pack dependency directory must match canonical Pack physical directory (${binding.physicalExtensionSlug})`,
      );
    }
    if (input.manifest.extensionSlug !== binding.logicalExtensionSlug) {
      issues.push(
        `pack dependency extensionSlug must match canonical Pack logical slug (${binding.logicalExtensionSlug})`,
      );
    }
    if (binding.alias) {
      if (input.manifest.tenantKey !== tenantKeyFromDir) {
        issues.push(
          `pack dependency alias tenantKey must equal ${tenantKeyFromDir}`,
        );
      }
      const expectedAliasKey = `${tenantKeyFromDir}-${binding.logicalExtensionSlug}`;
      if (input.manifest.extensionKey !== expectedAliasKey) {
        issues.push(
          `pack dependency alias extensionKey must equal ${expectedAliasKey}`,
        );
      }
    } else {
      if (input.manifest.tenantKey !== binding.packKey) {
        issues.push(
          `pack dependency tenantKey must equal declared packKey ${binding.packKey}`,
        );
      }
      if (input.manifest.extensionKey !== binding.sourceExtensionKey) {
        issues.push(
          `pack dependency extensionKey must equal ${binding.sourceExtensionKey}`,
        );
      }
    }
    validateCanonicalPackExtensionManifest({
      manifest: input.manifest,
      tenantKey: tenantKeyFromDir,
      binding,
      issues,
    });
  } else {
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
    } else if (
      packOwnedEffectModes.includes(
        capabilityManifest.maxEffectMode as (typeof packOwnedEffectModes)[number],
      ) &&
      !input.packDependencyBinding
    ) {
      issues.push(
        `capabilityManifest.maxEffectMode ${capabilityManifest.maxEffectMode} requires a declared Pack dependency authority`,
      );
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
            if (
              packOwnedEffectModes.includes(
                mode as (typeof packOwnedEffectModes)[number],
              ) &&
              !input.packDependencyBinding
            ) {
              issues.push(
                `${fieldPath}.declaredCapabilityModes ${mode} requires a declared Pack dependency authority`,
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
    validationScope: input.packDependencyBinding
      ? "pack-dependency"
      : "tenant-owned",
    ...(input.packDependencyBinding
      ? { sourceExtensionKey: input.packDependencyBinding.sourceExtensionKey }
      : {}),
    ok: issues.length === 0,
    issues,
  } satisfies TenantExtensionManifestValidationResult;
}

function resolvePackDependencyBinding(input: {
  tenantKey: string;
  extensionSlug: string;
  manifest: TenantExtensionManifest;
  tenantManifest: TenantManifest;
  authorities: PackDependencyAuthority[];
}) {
  const issues: string[] = [];

  const createBinding = (
    authority: PackDependencyAuthority,
    extension: CanonicalPackProvidedExtension,
    alias: boolean,
  ) => ({
    packKey: authority.packKey,
    sourceExtensionKey: extension.extensionKey,
    alias,
    logicalExtensionSlug: extension.extensionSlug,
    physicalExtensionSlug: extension.physicalExtensionSlug,
    canonicalManifestPath: path.join(
      authority.authorityRoot,
      extension.physicalExtensionSlug,
      "extension.manifest.json",
    ),
  }) satisfies PackDependencyBinding;

  let binding: PackDependencyBinding | null = null;

  for (const authority of input.authorities) {
    const directExtension = authority.providedExtensions.find(
      (extension) => extension.extensionKey === input.manifest.extensionKey,
    );
    if (directExtension) {
      binding = createBinding(authority, directExtension, false);
      break;
    }

    const alias = authority.aliases.find(
      (candidate) => candidate.extensionKey === input.manifest.extensionKey,
    );
    const aliasExtension = alias
      ? authority.providedExtensions.find(
          (extension) => extension.extensionKey === alias.sourceExtensionKey,
        )
      : undefined;
    if (aliasExtension) {
      binding = createBinding(authority, aliasExtension, true);
      break;
    }
  }

  if (binding) {
    const ownedCollision = input.tenantManifest.ownedExtensions.find(
      (extension) =>
        extension.extensionSlug === binding.physicalExtensionSlug ||
        extension.extensionKey === input.manifest.extensionKey,
    );
    if (ownedCollision) {
      issues.push(
        `tenant.manifest.json ownedExtensions must not shadow canonical Pack extension ${binding.sourceExtensionKey}`,
      );
    }
    return { binding, issues } as const;
  }

  for (const authority of input.authorities) {
    const canonicalPhysicalExtension = authority.providedExtensions.find(
      (extension) => extension.physicalExtensionSlug === input.extensionSlug,
    );
    if (canonicalPhysicalExtension) {
      issues.push(
        `tenant extension directory ${input.extensionSlug} must not shadow canonical Pack extension ${canonicalPhysicalExtension.extensionKey}`,
      );
      break;
    }
  }

  return { binding: null, issues } as const;
}

export function collectTenantExtensionManifestValidationReadout(
  extensionsRoot = resolveExtensionsRoot(),
  packAuthoritiesRoot = resolvePackAuthoritiesRoot(extensionsRoot),
) {
  const results: TenantExtensionManifestValidationResult[] = [];
  const authorityResults: TenantExtensionManifestValidationResult[] = [];
  const tenantStates = new Map<
    string,
    { tenantManifest: TenantManifest; authorityReadout: ReturnType<typeof loadPackDependencyAuthorities> }
  >();

  for (const descriptor of listTenantManifestDescriptors(extensionsRoot)) {
    const tenantManifest = loadTenantManifest(descriptor.tenantKey, extensionsRoot);
    const authorityReadout = loadPackDependencyAuthorities({
      tenantKey: descriptor.tenantKey,
      tenantManifest,
      packAuthoritiesRoot,
    });
    tenantStates.set(descriptor.tenantKey, { tenantManifest, authorityReadout });
    if ((tenantManifest.packDependencies ?? []).length > 0) {
      authorityResults.push({
        extensionKey: `${descriptor.tenantKey}--pack-authority`,
        manifestPath: descriptor.manifestPath,
        validationScope: "pack-authority",
        ok: authorityReadout.issues.length === 0,
        issues: [...authorityReadout.issues],
      });
    }
  }

  for (const descriptor of listTenantExtensionManifestDescriptors(extensionsRoot)) {
    const tenantState = tenantStates.get(descriptor.tenantKey);
    if (!tenantState) {
      throw new Error(`tenant manifest not found for tenantKey=${descriptor.tenantKey}`);
    }
    const manifest = readJsonFile<TenantExtensionManifest>(descriptor.manifestPath);
    const bindingResolution = resolvePackDependencyBinding({
      tenantKey: descriptor.tenantKey,
      extensionSlug: descriptor.extensionSlug,
      manifest,
      tenantManifest: tenantState.tenantManifest,
      authorities: tenantState.authorityReadout.authorities,
    });
    const result = validateTenantExtensionManifestBundle({
      manifestPath: descriptor.manifestPath,
      manifest,
      tenantManifest: tenantState.tenantManifest,
      ...(bindingResolution.binding
        ? { packDependencyBinding: bindingResolution.binding }
        : {}),
    });
    result.issues.push(...bindingResolution.issues);
    result.ok = result.issues.length === 0;
    results.push(result);
  }

  results.push(...authorityResults);

  const resultsByExtensionKey = new Map<string, TenantExtensionManifestValidationResult[]>();
  for (const result of results) {
    if (result.validationScope === "pack-authority") continue;
    const matchingResults = resultsByExtensionKey.get(result.extensionKey) ?? [];
    matchingResults.push(result);
    resultsByExtensionKey.set(result.extensionKey, matchingResults);
  }
  for (const [extensionKey, matchingResults] of resultsByExtensionKey) {
    if (matchingResults.length < 2) continue;
    for (const result of matchingResults) {
      result.issues.push(`extensionKey must be globally unique: ${extensionKey}`);
      result.ok = false;
    }
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

  const matches: TenantExtensionManifest[] = [];
  for (const descriptor of listTenantExtensionManifestDescriptors()) {
    const manifest = readJsonFile<TenantExtensionManifest>(descriptor.manifestPath);
    if (manifest.extensionKey === normalizedKey) {
      matches.push(manifest);
    }
  }

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    throw new Error(`extension manifest key is ambiguous: ${normalizedKey}`);
  }

  throw new Error(`extension manifest not found for extensionKey=${normalizedKey}`);
}
