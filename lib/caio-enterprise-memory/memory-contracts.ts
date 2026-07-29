// CAIO enterprise memory — states, TTLs, and the legal transition table.
//
// Auto-generated content may ONLY enter the memory as a "candidate"; a
// candidate is invisible to retrieval until a human adopts it (→ ephemeral)
// and a knowledge owner confirms it (→ verified). Everything outside the
// transition table throws the typed illegal_transition error.

import { z } from "zod";

export const CAIO_MEMORY_STATES = [
  "candidate",
  "ephemeral",
  "verified",
  "rejected",
  "expired",
] as const;

export const caioMemoryStateSchema = z.enum(CAIO_MEMORY_STATES);
export type CaioMemoryState = z.infer<typeof caioMemoryStateSchema>;

/** Candidates live 7 days before the TTL sweep expires them. */
export const CANDIDATE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
/** Adopted (ephemeral) entries live 90 days unless verified. */
export const EPHEMERAL_TTL_MS = 90 * 24 * 60 * 60 * 1_000;

/**
 * Legal transitions:
 *   candidate → ephemeral  (user adoption)
 *   candidate → rejected   (user)
 *   candidate → expired    (TTL sweep)
 *   ephemeral → verified   (knowledge owner confirm)
 *   ephemeral → expired    (TTL)
 * verified / rejected / expired are terminal.
 */
export const LEGAL_MEMORY_TRANSITIONS: Readonly<
  Record<CaioMemoryState, readonly CaioMemoryState[]>
> = Object.freeze({
  candidate: Object.freeze<CaioMemoryState[]>([
    "ephemeral",
    "rejected",
    "expired",
  ]),
  ephemeral: Object.freeze<CaioMemoryState[]>(["verified", "expired"]),
  verified: Object.freeze<CaioMemoryState[]>([]),
  rejected: Object.freeze<CaioMemoryState[]>([]),
  expired: Object.freeze<CaioMemoryState[]>([]),
});

export const CAIO_MEMORY_ERROR_CODES = [
  "illegal_transition",
  "forbidden",
  "not_found",
  "expired",
  "conflict",
  "invalid_input",
  "internal_error",
] as const;

export type CaioMemoryErrorCode = (typeof CAIO_MEMORY_ERROR_CODES)[number];

const HTTP_STATUS_BY_CODE: Record<CaioMemoryErrorCode, number> = {
  illegal_transition: 409,
  forbidden: 403,
  not_found: 404,
  expired: 410,
  conflict: 409,
  invalid_input: 400,
  internal_error: 500,
};

export class CaioMemoryError extends Error {
  readonly code: CaioMemoryErrorCode;
  readonly httpStatus: number;

  constructor(code: CaioMemoryErrorCode, message: string) {
    super(message);
    this.name = "CaioMemoryError";
    this.code = code;
    this.httpStatus = HTTP_STATUS_BY_CODE[code];
  }
}

export function assertLegalMemoryTransition(
  from: CaioMemoryState,
  to: CaioMemoryState,
): void {
  if (!LEGAL_MEMORY_TRANSITIONS[from]?.includes(to)) {
    throw new CaioMemoryError(
      "illegal_transition",
      `Memory transition ${from} -> ${to} is not allowed.`,
    );
  }
}

/**
 * Creation contract: strict — there is NO state field, so auto-generated
 * content structurally cannot enter in any state other than "candidate".
 */
export const memoryCandidateCreateSchema = z
  .object({
    workspaceId: z.string().min(1).max(200),
    createdByRef: z.string().min(1).max(200),
    body: z.string().min(1).max(200_000),
    projectRef: z.string().min(1).max(200).optional(),
    sourceRequestId: z.string().min(1).max(200).optional(),
  })
  .strict();

export type MemoryCandidateCreateInput = z.infer<
  typeof memoryCandidateCreateSchema
>;
