import {
  listSolutionExtensionCatalog,
  type SolutionExtensionCatalogEntry as RegistrySolutionExtensionCatalogEntry,
} from "@/lib/extensions/registry";

export const SOLUTION_EXTENSION_CATALOG = listSolutionExtensionCatalog();

export type SolutionExtensionCatalogEntry = RegistrySolutionExtensionCatalogEntry;
