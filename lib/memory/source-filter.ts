export type MemorySourceFilter = "ALL" | "HELM" | "OPENCLAW";

export function normalizeMemorySourceFilter(source?: string | null): MemorySourceFilter {
  if (source === "OPENCLAW" || source === "HELM" || source === "ALL") {
    return source;
  }

  return "ALL";
}

export function buildMemoryEntrySourceWhere(source?: string | null) {
  const normalizedSource = normalizeMemorySourceFilter(source);

  if (normalizedSource === "OPENCLAW") {
    return { source: { startsWith: "OPENCLAW:" } } as const;
  }

  return { NOT: { source: { startsWith: "OPENCLAW:" } } } as const;
}
