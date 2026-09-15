import {
  assertCaioOperatingContextPack,
  type CaioDetector,
  type CaioMetricQueryTemplate,
} from "./contracts";

type Registry = { packIds: Set<string>; templates: CaioMetricQueryTemplate[]; detectors: CaioDetector[] };

declare global {
  // Shared across Next.js entry bundles, same reason as the pack contribution registry.
  var __helmCaioOperatingContextRegistry: Registry | undefined;
}

function registry(): Registry {
  globalThis.__helmCaioOperatingContextRegistry ??= { packIds: new Set(), templates: [], detectors: [] };
  return globalThis.__helmCaioOperatingContextRegistry;
}

export function registerCaioOperatingContextPack(input: {
  packId: string;
  templates: readonly CaioMetricQueryTemplate[];
  detectors: readonly CaioDetector[];
}): void {
  const current = registry();
  // Unlike registerPackContributions, a repeat is an error: silently keeping one copy hides a
  // double bootstrap, and re-adding would run every detector twice.
  if (current.packIds.has(input.packId)) throw new Error(`caio_operating_context_pack_already_registered:${input.packId}`);
  const templates = [...current.templates, ...input.templates];
  const detectors = [...current.detectors, ...input.detectors];
  assertCaioOperatingContextPack({ templates, detectors });
  current.packIds.add(input.packId);
  current.templates = templates;
  current.detectors = detectors;
}

export function getRegisteredCaioOperatingContext(): { templates: readonly CaioMetricQueryTemplate[]; detectors: readonly CaioDetector[] } {
  const { templates, detectors } = registry();
  return { templates, detectors };
}

export function resetCaioOperatingContextRegistryForTests(): void {
  globalThis.__helmCaioOperatingContextRegistry = undefined;
}
