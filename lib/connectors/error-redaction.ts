/**
 * Redact sensitive tokens from connector error response bodies before they
 * land in thrown errors, audit logs, or client-visible failure messages.
 *
 * Most provider error envelopes are short JSON / text. We pass them through
 * a small set of regex strippers and trim the result instead of echoing the
 * raw body verbatim. This protects against:
 *   - provider responses that echo back the request body (some self-hosted
 *     gateways do this on 4xx)
 *   - logging pipelines that ship error.message to third-party observability
 *
 * Usage: `throw new Error(\`provider failed: \${redactProviderErrorBody(body)}\`);`
 */

const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(client_secret|clientSecret)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(access_token|accessToken)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(refresh_token|refreshToken)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(api[_-]?key|apiKey)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(appsecret|app_secret)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(corpsecret|corp_secret)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /(password|passwd)["'=:\s]+[^"',&\s}]+/gi, replacement: "$1=[redacted]" },
  { pattern: /Bearer\s+[A-Za-z0-9._-]{12,}/gi, replacement: "Bearer [redacted]" },
];

const DEFAULT_MAX_LENGTH = 240;

export function redactProviderErrorBody(body: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  if (!body) {
    return "";
  }

  let redacted = body;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  if (redacted.length > maxLength) {
    return `${redacted.slice(0, maxLength - 3).trimEnd()}...`;
  }

  return redacted;
}
