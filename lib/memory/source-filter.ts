import type { Prisma } from "@prisma/client";

export type MemorySourceFilter = "ALL" | "HELM" | "OPENCLAW" | "QODERWORK";

export function normalizeMemorySourceFilter(source?: string | null): MemorySourceFilter {
  if (source === "OPENCLAW" || source === "QODERWORK" || source === "HELM" || source === "ALL") {
    return source;
  }

  return "ALL";
}

export function buildMemoryEntrySourceWhere(
  source?: string | null,
): Prisma.MemoryEntryWhereInput {
  const normalizedSource = normalizeMemorySourceFilter(source);

  if (normalizedSource === "OPENCLAW") {
    return { source: { startsWith: "OPENCLAW:" } };
  }

  if (normalizedSource === "QODERWORK") {
    return { source: { startsWith: "QODERWORK:" } };
  }

  return {
    NOT: {
      OR: [
        { source: { startsWith: "OPENCLAW:" } },
        { source: { startsWith: "QODERWORK:" } },
      ],
    },
  };
}
