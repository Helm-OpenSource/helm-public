import { CHANNEL_PARTNER_REASON_CODES } from "./reason-codes";
import {
  FORBIDDEN_RAW_FIELD_NAMES,
  type ForbiddenRawFieldName,
  type PartnerSafeRecommendationDTO,
} from "./types";

// P0-REQ-02 + P0-REQ-07: Partner-visible code paths MUST consume only
// `PartnerSafe*DTO` projections. They MUST NOT carry any forbidden raw field.
// This module provides a contract/test-time validator for ANY object claiming
// to be partner-safe.

export type DtoBlackListResult =
  | { ok: true }
  | { ok: false; offendingField: ForbiddenRawFieldName; path: string };

export function containsForbiddenRawField(
  value: unknown,
  path = "$",
): DtoBlackListResult {
  if (value === null || value === undefined) {
    return { ok: true };
  }
  if (typeof value !== "object") {
    return { ok: true };
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const result = containsForbiddenRawField(value[i], `${path}[${i}]`);
      if (!result.ok) return result;
    }
    return { ok: true };
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if ((FORBIDDEN_RAW_FIELD_NAMES as readonly string[]).includes(key)) {
      return {
        ok: false,
        offendingField: key as ForbiddenRawFieldName,
        path: `${path}.${key}`,
      };
    }
    const childResult = containsForbiddenRawField(child, `${path}.${key}`);
    if (!childResult.ok) return childResult;
  }
  return { ok: true };
}

// Convenience: assert a Recommendation DTO is shape-valid for partner exposure.
// (We only check that no forbidden raw field leaked in; structural typing on
// the DTO is the compile-time line of defense.)
export function assertPartnerSafeRecommendationDto(
  dto: PartnerSafeRecommendationDTO,
): void {
  const check = containsForbiddenRawField(dto);
  if (!check.ok) {
    throw new Error(
      `${CHANNEL_PARTNER_REASON_CODES.PARTNER_SAFE_DTO_ONLY}:forbidden_field=${check.offendingField} at=${check.path}`,
    );
  }
}
