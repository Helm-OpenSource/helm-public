export function normalizeEvalText(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/\s+/g, "");
}

export function includesEvalText(haystack: string | null | undefined, needle: string | null | undefined) {
  const normalizedNeedle = normalizeEvalText(needle);
  if (!normalizedNeedle) return false;
  return normalizeEvalText(haystack).includes(normalizedNeedle);
}

export function includesInAny(values: Array<string | null | undefined>, needle: string) {
  return values.some((value) => includesEvalText(value, needle));
}

export function toRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function average(numbers: number[]) {
  if (!numbers.length) return 0;
  return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 10) / 10;
}
