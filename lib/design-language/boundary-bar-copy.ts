/**
 * Boundary bar copy contract — fail-closed resolution.
 *
 * Ported design language from the NPA pack's page-level boundary declaration:
 * a boundary bar always states (1) what you are looking at, (2) what the
 * system will NOT do, and (3) who decides next, plus an explicit negative
 * list. Invalid or incomplete copy must render as a visible error state with
 * an error code — never silently fall back to default wording.
 */

export interface BilingualCopy {
  readonly zh: string;
  readonly en: string;
}

export interface BoundaryBarCopyInput {
  /** ① What the reader is looking at. */
  readonly observed: BilingualCopy;
  /** ② What the system will not do on this surface. */
  readonly wontDo: BilingualCopy;
  /** ③ Who makes the next decision. */
  readonly decider: BilingualCopy;
  /** Explicit negative list rendered as pills. */
  readonly negatives?: readonly BilingualCopy[];
}

export interface ResolvedBoundaryBarCopy {
  readonly ok: true;
  readonly observed: string;
  readonly wontDo: string;
  readonly decider: string;
  readonly negatives: readonly string[];
}

export type BoundaryBarCopyErrorCode =
  | "BOUNDARY_COPY_MISSING_SEGMENT"
  | "BOUNDARY_COPY_EMPTY_NEGATIVE";

export interface BoundaryBarCopyError {
  readonly ok: false;
  readonly errorCode: BoundaryBarCopyErrorCode;
  readonly missingFields: readonly string[];
}

export type BoundaryBarCopyResolution =
  | ResolvedBoundaryBarCopy
  | BoundaryBarCopyError;

function isFilled(copy: BilingualCopy | undefined): copy is BilingualCopy {
  return (
    !!copy && copy.zh.trim().length > 0 && copy.en.trim().length > 0
  );
}

export function resolveBoundaryBarCopy(
  input: BoundaryBarCopyInput,
  english: boolean,
): BoundaryBarCopyResolution {
  const missingFields: string[] = [];
  if (!isFilled(input.observed)) missingFields.push("observed");
  if (!isFilled(input.wontDo)) missingFields.push("wontDo");
  if (!isFilled(input.decider)) missingFields.push("decider");

  if (missingFields.length > 0) {
    return {
      ok: false,
      errorCode: "BOUNDARY_COPY_MISSING_SEGMENT",
      missingFields,
    };
  }

  const negatives = input.negatives ?? [];
  const emptyNegativeIndexes = negatives.flatMap((entry, index) =>
    isFilled(entry) ? [] : [`negatives[${index}]`],
  );
  if (emptyNegativeIndexes.length > 0) {
    return {
      ok: false,
      errorCode: "BOUNDARY_COPY_EMPTY_NEGATIVE",
      missingFields: emptyNegativeIndexes,
    };
  }

  const pick = (copy: BilingualCopy) => (english ? copy.en : copy.zh);
  return {
    ok: true,
    observed: pick(input.observed),
    wontDo: pick(input.wontDo),
    decider: pick(input.decider),
    negatives: negatives.map(pick),
  };
}

export const BOUNDARY_BAR_SEGMENT_LABELS: {
  readonly observed: BilingualCopy;
  readonly wontDo: BilingualCopy;
  readonly decider: BilingualCopy;
} = {
  observed: { zh: "你看到的是", en: "You are looking at" },
  wontDo: { zh: "系统不会", en: "The system will not" },
  decider: { zh: "下一步由谁决定", en: "Who decides next" },
};
