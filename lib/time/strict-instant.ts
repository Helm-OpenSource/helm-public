// lib/time/strict-instant.ts
//
// Pure strict RFC-3339 instant parsing; no authority semantics. Extracted
// from lib/caio-governance/contract.ts so that authority-restricted
// surfaces (actions.ts / "use server" / lib/auth / app/api) can depend on
// strict time parsing without transitively reaching the governance
// contract (check:caio-terminology authority firewall, ADR §3: a
// CaioMandate is not an authorization token, and nothing that merely
// parses a timestamp belongs on that side of the firewall either).
// lib/caio-governance/contract.ts re-exports parseInstant unchanged so its
// own callers are unaffected.

// Strict RFC 3339 instant: date, time, and an explicit zone (Z or offset).
// Impossible calendar dates and out-of-range clock fields are rejected —
// Date.parse's silent normalization is not accepted.
const INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseInstant(value: string): number | null {
  const match = INSTANT_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 60
  ) {
    return null;
  }
  const epoch = Date.parse(value);
  return Number.isNaN(epoch) ? null : epoch;
}
