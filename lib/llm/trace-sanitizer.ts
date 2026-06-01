const TRACE_REDACTED = "[redacted]";
const TRACE_MAX_STRING_LENGTH = 500;
const TRACE_MAX_ARRAY_ITEMS = 20;
const TRACE_MAX_DEPTH = 6;

const SENSITIVE_TRACE_KEYS = new Set([
  "authorization",
  "apikey",
  "api_key",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "token",
  "secret",
  "password",
  "requestbody",
  "messages",
  "prompt",
  "systemprompt",
  "userprompt",
  "content",
  "reasoning_content",
  "reasoningcontent",
  "transcript",
  "audio",
  "file",
]);

function normalizeTraceKey(key: string) {
  return key.replace(/[-_\s]/g, "").toLowerCase();
}

function isSensitiveTraceKey(key: string) {
  const normalized = normalizeTraceKey(key);
  return SENSITIVE_TRACE_KEYS.has(normalized) || SENSITIVE_TRACE_KEYS.has(key.toLowerCase());
}

function sanitizeTraceString(value: string) {
  if (value.length <= TRACE_MAX_STRING_LENGTH) {
    return value;
  }
  return `${value.slice(0, TRACE_MAX_STRING_LENGTH)}...[truncated ${value.length - TRACE_MAX_STRING_LENGTH} chars]`;
}

function sanitizeTraceValue(value: unknown, key: string | null, depth: number): unknown {
  if (key && isSensitiveTraceKey(key)) {
    return TRACE_REDACTED;
  }

  if (typeof value === "string") {
    return sanitizeTraceString(value);
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "undefined"
  ) {
    return value;
  }

  if (depth >= TRACE_MAX_DEPTH) {
    return "[max_depth]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, TRACE_MAX_ARRAY_ITEMS)
      .map((item) => sanitizeTraceValue(item, null, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeTraceValue(entryValue, entryKey, depth + 1),
      ]),
    );
  }

  return String(value);
}

export function sanitizeLlmTracePayload(payload: Record<string, unknown>) {
  return sanitizeTraceValue(payload, null, 0) as Record<string, unknown>;
}

