import { normalizeEmailAddress, normalizePhoneNumber } from "@/lib/auth/formal-auth";
import { z } from "zod";

export function resolveMemberIdentifier(rawValue: string | null | undefined) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return { normalizedEmail: null, normalizedPhone: null };
  }

  if (z.string().email().safeParse(raw).success) {
    return {
      normalizedEmail: normalizeEmailAddress(raw),
      normalizedPhone: null,
    };
  }

  // Only parse phone-shaped input as a phone. Stripping arbitrary characters
  // first turns malformed email addresses (for example, a missing `@`) into
  // phone numbers and can create placeholder login emails for those users.
  if (!/^\+?[\d\s().-]+$/u.test(raw)) {
    return { normalizedEmail: null, normalizedPhone: null };
  }

  return {
    normalizedEmail: null,
    normalizedPhone: normalizePhoneNumber(raw),
  };
}
