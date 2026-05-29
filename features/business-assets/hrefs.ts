export const BUSINESS_ASSET_TYPES = [
  "customer",
  "opportunity",
  "commitment",
  "risk",
] as const;

export type BusinessAssetType = (typeof BUSINESS_ASSET_TYPES)[number];

export function normalizeBusinessAssetType(
  value: string | null | undefined,
): BusinessAssetType | null {
  if (
    value === "customer" ||
    value === "opportunity" ||
    value === "commitment" ||
    value === "risk"
  ) {
    return value;
  }

  return null;
}

export function buildBusinessAssetHref(input: {
  type: BusinessAssetType;
  id: string;
  source?: string | null;
}) {
  const href = `/assets/${input.type}/${input.id}`;
  if (!input.source) {
    return href;
  }

  const params = new URLSearchParams({ source: input.source });
  return `${href}?${params.toString()}`;
}

export function buildCustomerAssetHref(id: string, source?: string | null) {
  return buildBusinessAssetHref({ type: "customer", id, source });
}

export function buildOpportunityAssetHref(id: string, source?: string | null) {
  return buildBusinessAssetHref({ type: "opportunity", id, source });
}

export function buildCommitmentAssetHref(id: string, source?: string | null) {
  return buildBusinessAssetHref({ type: "commitment", id, source });
}

export function buildRiskAssetHref(id: string, source?: string | null) {
  return buildBusinessAssetHref({ type: "risk", id, source });
}

export function buildBusinessAssetHrefFromObject(input: {
  objectType?: string | null;
  objectId?: string | null;
  source?: string | null;
}) {
  if (!input.objectId) {
    return null;
  }

  if (input.objectType === "COMPANY") {
    return buildCustomerAssetHref(input.objectId, input.source);
  }

  if (input.objectType === "OPPORTUNITY") {
    return buildOpportunityAssetHref(input.objectId, input.source);
  }

  return null;
}
