/**
 * Source Profiler — Secret preflight
 *
 * Strict-by-default secret scanner run BEFORE any file content is profiled. A
 * hit in `strict` mode skips the file (and records it); in `warn` mode the file
 * is still profiled but a warning is recorded; `off` disables scanning.
 *
 * The pattern set is intentionally aligned with the private/contact + secret
 * vocabulary used by `lib/operating-signal-governance/source-governance.ts`
 * (which keeps those patterns module-private). We mirror equivalents here so the
 * standalone tool shares one notion of "looks like a secret / PII" without
 * coupling to server internals.
 */

export type SecretFinding = {
  rule: string;
  /** 1-based line number of the first match. */
  line: number;
};

/** Filenames that are always treated as secret-bearing regardless of content. */
const SECRET_FILENAME_PATTERNS: readonly RegExp[] = [
  /(^|\/)\.env(\..+)?$/i,
  /(^|\/)\.npmrc$/i,
  /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.keystore$/i,
];

/** Content patterns that indicate embedded credentials / private contact data. */
const SECRET_CONTENT_RULES: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  { rule: "private_key_block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { rule: "aws_access_key_id", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: "google_api_key", pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { rule: "slack_token", pattern: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/ },
  { rule: "github_token", pattern: /\bghp_[0-9A-Za-z]{36}\b/ },
  { rule: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  {
    rule: "url_embedded_credential",
    pattern: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]+@[^\s/]+/i,
  },
  {
    rule: "assigned_secret",
    pattern:
      /\b(password|passwd|secret|api[_-]?key|access[_-]?token|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*['"][^'"]{8,}['"]/i,
  },
  {
    rule: "connection_string",
    pattern: /\b(mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis|amqp):\/\/\S+/i,
  },
  // Private/contact patterns mirrored from source-governance posture.
  { rule: "email_address", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
  { rule: "rfc1918_ip", pattern: /\b(?:10|127)\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\b192\.168\.\d{1,3}\.\d{1,3}\b/ },
];

export type SecretPreflightOptions = {
  /** Extra regex source strings appended to the built-in content rules. */
  extraPatterns?: readonly string[];
};

/** Returns true if the path itself implies secrets regardless of content. */
export function isSecretFilename(relPath: string): boolean {
  return SECRET_FILENAME_PATTERNS.some((p) => p.test(relPath));
}

/**
 * Scan file content for secret/PII indicators. Returns all matched rules with
 * the first matching line. Pure function — no I/O.
 */
export function scanContentForSecrets(
  content: string,
  options: SecretPreflightOptions = {},
): SecretFinding[] {
  const rules = [
    ...SECRET_CONTENT_RULES,
    ...(options.extraPatterns ?? []).map((src, i) => ({
      rule: `custom_${i}`,
      pattern: safeRegExp(src),
    })),
  ].filter((r): r is { rule: string; pattern: RegExp } => r.pattern !== null);

  const findings: SecretFinding[] = [];
  const lines = content.split(/\r?\n/);
  for (const { rule, pattern } of rules) {
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        findings.push({ rule, line: i + 1 });
        break; // one finding per rule is enough to gate the file
      }
    }
  }
  return findings;
}

function safeRegExp(source: string): RegExp | null {
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}
