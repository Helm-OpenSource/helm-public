export type SensitiveValuePatternCode =
  | "raw_email_pattern"
  | "raw_phone_pattern"
  | "raw_ip_pattern"
  | "raw_uuid_pattern"
  | "raw_bearer_token_pattern"
  | "raw_api_key_pattern";

export type SensitiveValuePattern = {
  code: SensitiveValuePatternCode;
  regex: RegExp;
};

export const SENSITIVE_VALUE_PATTERNS: readonly SensitiveValuePattern[] = [
  {
    code: "raw_email_pattern",
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
  },
  {
    code: "raw_phone_pattern",
    regex: /(?:\+?\d[\d\s()]{8,}\d|\b\d{3}[-\s]\d{3,4}[-\s]\d{4}\b)/u,
  },
  { code: "raw_ip_pattern", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/u },
  {
    code: "raw_uuid_pattern",
    regex:
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu,
  },
  {
    code: "raw_bearer_token_pattern",
    regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/u,
  },
  {
    code: "raw_api_key_pattern",
    regex: /\b(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16})\b/u,
  },
] as const;

export const SENSITIVE_VALUE_PATTERN_CODES = SENSITIVE_VALUE_PATTERNS.map(
  (pattern) => pattern.code,
);
