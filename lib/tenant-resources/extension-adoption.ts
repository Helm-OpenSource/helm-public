import type {
  TenantExtensionManifestInput,
  TenantResourceReadiness,
  TenantResourceReadinessSummary,
} from "@/lib/tenant-resources/readiness";

export type TenantExtensionDependencyValidationStatus =
  | "declared"
  | "validated"
  | "blocked";

export type TenantExtensionDependencyAdoptionStatus =
  | "declared"
  | "validated"
  | "adopted_for_read"
  | "adopted_for_governed_loop"
  | "blocked"
  | "superseded";

export type TenantExtensionGovernedLoopBindingStatus =
  | "not_bound"
  | "bound"
  | "blocked";

export type TenantExtensionResourceDependencyReadout = {
  resourceKey: string;
  extensionKey: string;
  extensionDisplayName: string;
  resourceDependencyKey: string;
  provider: string;
  declaredCapabilityModes: string[];
  objectBindings: string[];
  policyHint: string | null;
  validationStatus: TenantExtensionDependencyValidationStatus;
  adoptionStatus: TenantExtensionDependencyAdoptionStatus;
  governedLoopBindingStatus: TenantExtensionGovernedLoopBindingStatus;
  blockingReasons: string[];
  nextReviewStep: string;
  boundaryNotes: string[];
};

export type TenantExtensionResourceAdoptionReadout = {
  resourceKey: string;
  extensionKey: string;
  extensionDisplayName: string;
  overallStatus: TenantExtensionDependencyAdoptionStatus;
  dependencyCount: number;
  dependencies: TenantExtensionResourceDependencyReadout[];
  summary: string;
  boundaryNotes: string[];
};

export function buildTenantExtensionResourceAdoptionReadouts(input: {
  readiness: TenantResourceReadinessSummary;
  extensionManifests: TenantExtensionManifestInput[];
}): TenantExtensionResourceAdoptionReadout[] {
  const manifestsByExtensionKey = new Map(
    input.extensionManifests.map((manifest) => [manifest.extensionKey, manifest]),
  );

  return input.readiness.resources
    .filter((resource) => resource.source.sourceKind === "workspace_solution_extension")
    .map((resource) =>
      buildExtensionAdoptionReadout(
        resource,
        manifestsByExtensionKey.get(resource.provider) ?? null,
      ),
    );
}

function buildExtensionAdoptionReadout(
  resource: TenantResourceReadiness,
  manifest: TenantExtensionManifestInput | null,
): TenantExtensionResourceAdoptionReadout {
  const extensionKey = resource.provider;
  const extensionDisplayName = manifest?.displayName ?? resource.resourceName;
  const duplicateCounts = new Map<string, number>();
  for (const dependency of manifest?.resourceDependencies ?? []) {
    duplicateCounts.set(
      dependency.resourceDependencyKey,
      (duplicateCounts.get(dependency.resourceDependencyKey) ?? 0) + 1,
    );
  }

  const dependencies = (manifest?.resourceDependencies ?? []).map((dependency) =>
    buildDependencyReadout({
      dependency,
      duplicateCount: duplicateCounts.get(dependency.resourceDependencyKey) ?? 0,
      extensionKey,
      extensionDisplayName,
      resource,
    }),
  );

  const overallStatus = resolveOverallStatus(resource, manifest, dependencies);

  return {
    resourceKey: resource.resourceKey,
    extensionKey,
    extensionDisplayName,
    overallStatus,
    dependencyCount: dependencies.length,
    dependencies,
    summary: buildSummary(resource, overallStatus, dependencies),
    boundaryNotes: uniqueStrings([
      "extension adoption is read-first and does not grant external write authority",
      "tenant custom extension stays tenant custom and does not become shared core product truth",
      "adopted dependency still remains review-first and bounded away from connector marketplace or remote execution",
    ]),
  };
}

function buildDependencyReadout(input: {
  resource: TenantResourceReadiness;
  extensionKey: string;
  extensionDisplayName: string;
  dependency: NonNullable<TenantExtensionManifestInput["resourceDependencies"]>[number];
  duplicateCount: number;
}): TenantExtensionResourceDependencyReadout {
  const blockingReasons = resolveBlockingReasons(input.resource, input.dependency, input.duplicateCount);
  const adoptionStatus = resolveAdoptionStatus(input.resource, blockingReasons, input.duplicateCount);
  const validationStatus =
    adoptionStatus === "declared"
      ? "declared"
      : adoptionStatus === "blocked" || adoptionStatus === "superseded"
        ? "blocked"
        : "validated";

  return {
    resourceKey: input.resource.resourceKey,
    extensionKey: input.extensionKey,
    extensionDisplayName: input.extensionDisplayName,
    resourceDependencyKey: input.dependency.resourceDependencyKey,
    provider: input.dependency.provider,
    declaredCapabilityModes: input.dependency.declaredCapabilityModes,
    objectBindings: input.dependency.objectBindings,
    policyHint: input.dependency.policyHints.join(" / "),
    validationStatus,
    adoptionStatus,
    governedLoopBindingStatus:
      adoptionStatus === "adopted_for_governed_loop"
        ? "bound"
        : adoptionStatus === "blocked" || adoptionStatus === "superseded"
          ? "blocked"
          : "not_bound",
    blockingReasons,
    nextReviewStep: buildNextReviewStep(adoptionStatus, blockingReasons, input.dependency.provider),
    boundaryNotes: uniqueStrings([
      "extension dependency adoption remains read-only and review-first",
      "dependency adoption does not create provider-side execution or connector provisioning",
      ...input.resource.readiness.boundaryNotes,
    ]),
  };
}

function resolveBlockingReasons(
  resource: TenantResourceReadiness,
  dependency: NonNullable<TenantExtensionManifestInput["resourceDependencies"]>[number],
  duplicateCount: number,
) {
  const reasons: string[] = [];

  if (duplicateCount > 1) {
    reasons.push("superseded_dependency_declaration");
  }
  if (resource.status === "paused") {
    reasons.push("extension_disabled");
  }
  if (resource.readiness.primaryGap === "manifest_missing") {
    reasons.push("extension_manifest_missing");
  }
  if (resource.readiness.primaryGap === "mapping_incomplete") {
    reasons.push("dependency_mapping_incomplete");
  }
  if (dependency.objectBindings.length === 0) {
    reasons.push("object_binding_missing");
  }
  if (dependency.policyHints.length === 0) {
    reasons.push("policy_hint_missing");
  }
  if (dependency.declaredCapabilityModes.length === 0) {
    reasons.push("declared_capability_mode_missing");
  }

  return reasons;
}

function resolveAdoptionStatus(
  resource: TenantResourceReadiness,
  blockingReasons: string[],
  duplicateCount: number,
): TenantExtensionDependencyAdoptionStatus {
  if (duplicateCount > 1) return "superseded";
  if (blockingReasons.length > 0) return "blocked";
  if (resource.status === "governed" || resource.status === "actionable") {
    return "adopted_for_governed_loop";
  }
  if (resource.status === "readable" || resource.status === "mapped") {
    return "adopted_for_read";
  }
  if (resource.status === "registered" || resource.status === "configured") {
    return "declared";
  }

  return "validated";
}

function resolveOverallStatus(
  resource: TenantResourceReadiness,
  manifest: TenantExtensionManifestInput | null,
  dependencies: TenantExtensionResourceDependencyReadout[],
): TenantExtensionDependencyAdoptionStatus {
  if (!manifest || dependencies.length === 0) {
    return resource.readiness.primaryGap === "manifest_missing" ? "blocked" : "declared";
  }
  if (dependencies.some((dependency) => dependency.adoptionStatus === "blocked")) {
    return "blocked";
  }
  if (dependencies.some((dependency) => dependency.adoptionStatus === "superseded")) {
    return "superseded";
  }
  if (
    dependencies.every(
      (dependency) => dependency.adoptionStatus === "adopted_for_governed_loop",
    )
  ) {
    return "adopted_for_governed_loop";
  }
  if (
    dependencies.some((dependency) => dependency.adoptionStatus === "adopted_for_read")
  ) {
    return "adopted_for_read";
  }
  if (dependencies.every((dependency) => dependency.validationStatus === "validated")) {
    return "validated";
  }
  return "declared";
}

function buildSummary(
  resource: TenantResourceReadiness,
  overallStatus: TenantExtensionDependencyAdoptionStatus,
  dependencies: TenantExtensionResourceDependencyReadout[],
) {
  if (dependencies.length === 0) {
    return "No extension dependency adoption has been declared yet.";
  }

  if (overallStatus === "blocked") {
    return `${dependencies.filter((dependency) => dependency.adoptionStatus === "blocked").length} dependency declarations are blocked and need review before this extension can stay on the governed resource path.`;
  }
  if (overallStatus === "superseded") {
    return "Duplicate dependency declarations need cleanup before this extension can be treated as stable governance truth.";
  }
  if (overallStatus === "adopted_for_governed_loop") {
    return `${resource.resourceName} has ${dependencies.length} extension dependency declarations bound into the existing governed loop without expanding execution authority.`;
  }
  if (overallStatus === "adopted_for_read") {
    return `${resource.resourceName} dependencies are visible for read/judgement, but still need deeper governed-loop review.`;
  }
  if (overallStatus === "validated") {
    return `${resource.resourceName} dependency declarations are validated against existing resource truth and are waiting for adoption review.`;
  }

  return `${resource.resourceName} dependency declarations are present but not yet adopted into tenant resource governance.`;
}

function buildNextReviewStep(
  adoptionStatus: TenantExtensionDependencyAdoptionStatus,
  blockingReasons: string[],
  provider: string,
) {
  if (blockingReasons.includes("superseded_dependency_declaration")) {
    return "Remove or reconcile duplicate dependency declarations before using this extension as governance truth.";
  }
  if (blockingReasons.includes("extension_disabled")) {
    return "Re-enable the extension before adopting this dependency into resource governance.";
  }
  if (blockingReasons.includes("extension_manifest_missing")) {
    return "Restore the extension manifest before attempting dependency adoption.";
  }
  if (blockingReasons.includes("dependency_mapping_incomplete")) {
    return `Repair dependency mapping and capability evidence before treating ${provider} as governed extension input.`;
  }
  if (blockingReasons.includes("object_binding_missing")) {
    return "Declare extension-owned object bindings before this dependency can shape judgement.";
  }
  if (blockingReasons.includes("policy_hint_missing")) {
    return "Declare review-first policy hints before this dependency can be adopted.";
  }
  if (blockingReasons.includes("declared_capability_mode_missing")) {
    return "Declare at least one allowed capability mode before this dependency can be adopted.";
  }
  if (adoptionStatus === "adopted_for_governed_loop") {
    return "Keep the dependency review-first inside the existing governed loop; do not expand execution authority.";
  }
  if (adoptionStatus === "adopted_for_read") {
    return "Promote this dependency from read visibility to governed-loop review only after the extension loop remains stable.";
  }
  if (adoptionStatus === "validated") {
    return "Review adoption scope and bind the dependency to an extension-owned governed loop.";
  }

  return "Declare and validate the dependency before using it in tenant resource governance.";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}
