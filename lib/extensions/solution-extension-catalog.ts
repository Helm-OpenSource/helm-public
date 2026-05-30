import {
  listSolutionExtensionCatalog,
  type SolutionExtensionCatalogEntry as RegistrySolutionExtensionCatalogEntry,
} from "@/lib/extensions/registry";

/**
 * Post-5A inversion: the catalog is registry-driven (populated when packs
 * register at the composition root), so it must be read at use-time — an eager
 * module-load snapshot would capture an empty catalog before registration.
 * Call this from server pages/actions (which run after instrumentation wiring).
 */
export function getSolutionExtensionCatalog(): ReadonlyArray<RegistrySolutionExtensionCatalogEntry> {
  return listSolutionExtensionCatalog();
}

export type SolutionExtensionCatalogEntry = RegistrySolutionExtensionCatalogEntry;
