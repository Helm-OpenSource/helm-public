import {
  findTenantExtensionManifestByExtensionKey,
  type TenantExtensionManifest,
  type TenantExtensionResourceDependencyDeclaration,
} from "@/lib/solution-extension-manifests";
import {
  normalizeManifestEffectModes,
  type TenantExtensionManifestInput,
  type TenantResourceEffectMode,
} from "@/lib/tenant-resources/readiness";

function normalizeProvider(value: string) {
  return value.trim().replaceAll("-", "_").toUpperCase();
}

function normalizePolicyHints(
  dependency: TenantExtensionResourceDependencyDeclaration | null,
  manifest: TenantExtensionManifest,
) {
  return uniqueStrings([
    ...(dependency?.policyHints ?? []),
    ...manifest.dependencyDeclarations.policyTruths,
  ]);
}

function normalizeDeclaredCapabilityModes(
  dependency: TenantExtensionResourceDependencyDeclaration | null,
  manifest: TenantExtensionManifest,
): TenantResourceEffectMode[] {
  if (dependency?.declaredCapabilityModes?.length) {
    const declaredModes: TenantResourceEffectMode[] = [];
    for (const mode of dependency.declaredCapabilityModes) {
      if (isTenantResourceEffectMode(mode)) {
        declaredModes.push(mode);
      }
    }
    return declaredModes;
  }

  return normalizeManifestEffectModes(manifest.capabilityManifest.maxEffectMode);
}

function normalizeResourceDependencies(
  manifest: TenantExtensionManifest,
): NonNullable<TenantExtensionManifestInput["resourceDependencies"]> {
  if (manifest.resourceDependencyDeclarations?.length) {
    return manifest.resourceDependencyDeclarations.map((dependency) => ({
      resourceDependencyKey: dependency.resourceDependencyKey,
      provider: normalizeProvider(dependency.provider),
      declaredCapabilityModes: normalizeDeclaredCapabilityModes(dependency, manifest),
      objectBindings: uniqueStrings(dependency.objectBindings),
      policyHints: normalizePolicyHints(dependency, manifest),
    }));
  }

  return manifest.dependencyDeclarations.connectors.map((connector) => ({
    resourceDependencyKey: `${manifest.extensionKey}:${connector.toLowerCase()}`,
    provider: normalizeProvider(connector),
    declaredCapabilityModes: normalizeManifestEffectModes(
      manifest.capabilityManifest.maxEffectMode,
    ),
    objectBindings: ["EXTENSION_OBJECT"],
    policyHints: uniqueStrings(manifest.dependencyDeclarations.policyTruths),
  }));
}

export function toTenantResourceExtensionManifestInputFromManifest(
  manifest: TenantExtensionManifest,
): TenantExtensionManifestInput {
  return {
    extensionKey: manifest.extensionKey,
    displayName: manifest.displayName,
    dependencyConnectors: manifest.dependencyDeclarations.connectors.map(normalizeProvider),
    workspaceTruths: manifest.dependencyDeclarations.workspaceTruths,
    policyTruths: manifest.dependencyDeclarations.policyTruths,
    capabilityDeclarations: manifest.capabilityManifest.capabilityDeclarations,
    maxEffectMode: manifest.capabilityManifest.maxEffectMode,
    requiresReviewByDefault: manifest.capabilityManifest.requiresReviewByDefault,
    resourceDependencies: normalizeResourceDependencies(manifest),
  };
}

export function toTenantResourceExtensionManifestInput(
  extensionKey: string,
): TenantExtensionManifestInput | undefined {
  try {
    return toTenantResourceExtensionManifestInputFromManifest(
      findTenantExtensionManifestByExtensionKey(extensionKey),
    );
  } catch {
    return undefined;
  }
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isTenantResourceEffectMode(value: string): value is TenantResourceEffectMode {
  return [
    "read_only",
    "draft_only",
    "internal_write",
    "manual_execution",
    "guarded_write_intent",
  ].includes(value);
}
