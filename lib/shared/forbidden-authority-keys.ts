export const FORBIDDEN_AUTHORITY_KEY_FRAGMENTS = [
  "approval",
  "approve",
  "authority",
  "autoApprove",
  "autoCommit",
  "autoExecute",
  "autoSend",
  "autoSettle",
  "autoWrite",
  "broadAutoWrite",
  "directExternalSideEffect",
  "entitlement",
  "licenseEntitlement",
  "marketplaceInstall",
  "officialWrite",
  "schemaMigration",
  "sendNow",
  "silentCrm",
  "silentCrmWrite",
  "silentWrite",
  "resync",
  "assignOwnerInline",
] as const;

export const FORBIDDEN_AUTHORITY_TEXT_FRAGMENTS = [
  "assignOwnerInline",
  "autoApprove",
  "autoCommit",
  "autoExecute",
  "autoSend",
  "autoSettle",
  "autoWrite",
  "broadAutoWrite",
  "directExternalSideEffect",
  "licenseEntitlement",
  "marketplaceInstall",
  "officialWrite",
  "schemaMigration",
  "sendNow",
  "silentCrm",
  "silentCrmWrite",
  "silentWrite",
  "resync",
] as const;

export type ForbiddenAuthorityKeyFragment =
  (typeof FORBIDDEN_AUTHORITY_KEY_FRAGMENTS)[number];

const normalizedForbiddenAuthorityKeyFragments = FORBIDDEN_AUTHORITY_KEY_FRAGMENTS.map(
  (fragment) => ({
    fragment,
    normalized: normalizeAuthorityKey(fragment),
  }),
).sort((first, second) => second.normalized.length - first.normalized.length);

export function normalizeAuthorityKey(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replaceAll(/[-_:\s.]/g, "")
    .toLowerCase();
}

export function findForbiddenAuthorityKeyFragment(
  value: string,
): ForbiddenAuthorityKeyFragment | null {
  const normalizedValue = normalizeAuthorityKey(value);
  return (
    normalizedForbiddenAuthorityKeyFragments.find(({ normalized }) =>
      normalizedValue.includes(normalized),
    )?.fragment ?? null
  );
}

export function containsForbiddenAuthorityText(value: string) {
  const normalizedValue = normalizeAuthorityKey(value);
  return FORBIDDEN_AUTHORITY_TEXT_FRAGMENTS.some((fragment) =>
    normalizedValue.includes(normalizeAuthorityKey(fragment)),
  );
}

export function isAuthorityGrantValue(value: unknown) {
  if (value === true) return true;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return !["", "0", "false", "none", "disabled", "no"].includes(normalized);
  }
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "object" && value !== null;
}
