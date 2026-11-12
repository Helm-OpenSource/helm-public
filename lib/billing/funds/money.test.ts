import { describe, expect, it } from "vitest";
import { MAX_FEN, assertPositiveFen, fenFromDecimalString, fenToDecimalString, liToFen, microToFen } from "./money";

const big = (value: string | number) => BigInt(value);

describe("fen decimal strings", () => {
  it("round-trips unsigned integer fen up to the bound", () => {
    for (const text of ["0", "1", "12345", "9007199254740991"]) expect(fenToDecimalString(fenFromDecimalString(text))).toBe(text);
    expect(fenFromDecimalString("9007199254740991")).toBe(MAX_FEN);
    expect(fenToDecimalString(big(-250))).toBe("-250");
  });
  it("refuses signs, fractions, exponents, padding, leading zeros, non-strings and overflow", () => {
    for (const bad of ["", "-1", "+1", "01", "1.0", "1.5", "1e3", " 1", "1 ", "0x10", "9007199254740992", "99999999999999999", 1, null]) {
      expect(() => fenFromDecimalString(bad), String(bad)).toThrow(RangeError);
    }
    expect(() => fenToDecimalString(1)).toThrow("money_fen_type_invalid");
    expect(() => fenToDecimalString(MAX_FEN + big(1))).toThrow("money_fen_out_of_range");
    expect(() => fenToDecimalString(-MAX_FEN - big(1))).toThrow("money_fen_out_of_range");
  });
  it("accepts only positive bigint amounts within the journal bound", () => {
    expect(assertPositiveFen(big(1))).toBe(big(1));
    expect(assertPositiveFen(MAX_FEN)).toBe(MAX_FEN);
    for (const bad of [big(0), big(-1), MAX_FEN + big(1), 1, "1"]) expect(() => assertPositiveFen(bad)).toThrow("money_fen_amount_invalid");
  });
});

describe("li and micro-yuan to fen", () => {
  it("converts exactly or refuses a remainder", () => {
    expect(liToFen(big(120), "exact")).toBe(big(12));
    expect(microToFen(big(10_000), "exact")).toBe(big(1));
    expect(() => liToFen(big(121), "exact")).toThrow("money_not_exact_fen");
    expect(() => microToFen(big(9_999), "exact")).toThrow("money_not_exact_fen");
  });
  it("rounds half-up only when asked, at the exact half boundary", () => {
    expect(liToFen(big(14), "half_up")).toBe(big(1));
    expect(liToFen(big(15), "half_up")).toBe(big(2));
    expect(liToFen(big(4), "half_up")).toBe(big(0));
    expect(microToFen(big(4_999), "half_up")).toBe(big(0));
    expect(microToFen(big(5_000), "half_up")).toBe(big(1));
    expect(microToFen(big(15_000), "half_up")).toBe(big(2));
  });
  it("bounds inputs and results", () => {
    expect(liToFen(MAX_FEN * big(10), "exact")).toBe(MAX_FEN);
    expect(() => liToFen(MAX_FEN * big(10) + big(5), "half_up")).toThrow("money_fen_out_of_range");
    expect(() => microToFen(big(-1), "half_up")).toThrow("money_source_amount_invalid");
    expect(() => liToFen(10 as unknown as bigint, "exact")).toThrow("money_source_amount_invalid");
    expect(() => liToFen(big(10), "floor" as never)).toThrow("money_rounding_invalid");
  });
});
