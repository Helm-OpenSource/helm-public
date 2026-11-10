/** Billing V1 money: CNY integer fen as bigint, unsigned integer decimal strings at interfaces ("12345" = 123.45 yuan), no
 * floating point. 1 fen = 10 li (厘) = 10_000 micro-yuan (微元); only `half_up` rounds, `exact` refuses a remainder. */
export const MAX_FEN = BigInt(Number.MAX_SAFE_INTEGER); // 9007199254740991 fen; journal CHECK uses the same bound.
const ZERO = BigInt(0), LI_PER_FEN = BigInt(10), MICRO_PER_FEN = BigInt(10_000);

export type FenRounding = "exact" | "half_up";

function fail(code: string): never { throw new RangeError(code); }

/** Parses an unsigned integer fen string: digits only, no sign, no leading zero, no fraction, at most MAX_FEN. */
export function fenFromDecimalString(value: unknown): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,15})$/.test(value)) fail("money_fen_string_invalid");
  const fen = BigInt(value);
  if (fen > MAX_FEN) fail("money_fen_out_of_range");
  return fen;
}

/** Formats a fen amount (balances may be signed) as an integer decimal string. */
export function fenToDecimalString(fen: unknown): string {
  if (typeof fen !== "bigint") fail("money_fen_type_invalid");
  if (fen > MAX_FEN || fen < -MAX_FEN) fail("money_fen_out_of_range");
  return fen.toString();
}

/** Requires a positive bigint fen amount within the journal bound. */
export function assertPositiveFen(fen: unknown, code = "money_fen_amount_invalid"): bigint {
  if (typeof fen !== "bigint" || fen <= ZERO || fen > MAX_FEN) fail(code);
  return fen;
}

function toFen(amount: unknown, perFen: bigint, rounding: FenRounding): bigint {
  if (typeof amount !== "bigint" || amount < ZERO) fail("money_source_amount_invalid");
  if (rounding !== "exact" && rounding !== "half_up") fail("money_rounding_invalid");
  const quotient = amount / perFen, remainder = amount % perFen;
  if (rounding === "exact" && remainder !== ZERO) fail("money_not_exact_fen");
  // Half-up on non-negative values: a remainder of at least half a fen rounds away from zero.
  const fen = rounding === "half_up" && remainder * BigInt(2) >= perFen ? quotient + BigInt(1) : quotient;
  if (fen > MAX_FEN) fail("money_fen_out_of_range");
  return fen;
}

/** 厘 -> 分. */
export function liToFen(li: bigint, rounding: FenRounding): bigint { return toFen(li, LI_PER_FEN, rounding); }
/** 微元 -> 分 (the LLM spend and vendor cost ledgers count micro-yuan). */
export function microToFen(micros: bigint, rounding: FenRounding): bigint { return toFen(micros, MICRO_PER_FEN, rounding); }
