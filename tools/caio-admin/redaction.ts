/**
 * Shared redaction helpers for the caio-admin and caio-connect CLI cores.
 *
 * Every operator-facing surface (argv echoes, env dumps, log lines, --json
 * output) must pass through these helpers so that secret material never
 * reaches a terminal, a log file, or a serialized result. The helpers are
 * deliberately heuristic-first and fail-closed: anything that *looks* like a
 * secret is scrubbed.
 */

const SECRET_ENV_KEY_PATTERN =
  /(secret|token|passwd|password|credential|api[-_]?key|private[-_]?key|database[-_]?url)/i;

const URL_CREDENTIALS_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)([^/\s@]*:[^/\s@]*)@/gi;

const REDACTED = "<redacted>";
const REDACTED_PATH = "<redacted-path>";

function isPathLike(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("~/")
  );
}

/**
 * Heuristic used both for scrubbing output and for refusing secrets passed as
 * CLI arguments: a value counts as secret-looking when it embeds URL
 * credentials, or when it is a long (>= 20 chars) high-entropy token.
 */
export function looksLikeSecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  URL_CREDENTIALS_PATTERN.lastIndex = 0;
  if (URL_CREDENTIALS_PATTERN.test(trimmed)) return true;
  if (trimmed.length < 20) return false;
  if (/\s/.test(trimmed)) return false;
  // Filesystem paths are legitimate CLI inputs; they are redacted from text
  // output separately but must not be refused as "secrets on the command line".
  if (isPathLike(trimmed)) return false;
  if (/^[A-Fa-f0-9]{32,}$/.test(trimmed)) return true;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) =>
    re.test(trimmed),
  ).length;
  if (classes >= 3) return true;
  if (
    /^[A-Za-z0-9+/_-]{28,}={0,2}$/.test(trimmed) &&
    /[0-9]/.test(trimmed) &&
    /[A-Za-z]/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

/** Scrub secret-looking material out of a single line/blob of text. */
export function redactText(text: string): string {
  let out = text.replace(URL_CREDENTIALS_PATTERN, `$1${REDACTED}@`);
  // KEY=value assignments where the key name implies a secret.
  out = out.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*)=(\S+)/g,
    (match, key: string) =>
      SECRET_ENV_KEY_PATTERN.test(key) ? `${key}=${REDACTED}` : match,
  );
  // Long high-entropy tokens anywhere in the text.
  out = out.replace(/[A-Za-z0-9+/_=:@.-]{20,}/g, (candidate) =>
    looksLikeSecretValue(candidate) ? REDACTED : candidate,
  );
  return out;
}

/** Returns a scrubbed copy of argv suitable for logs and error messages. */
export function redactArgv(argv: readonly string[]): string[] {
  return argv.map((arg) => {
    const eq = arg.indexOf("=");
    if (arg.startsWith("--") && eq > 2) {
      const key = arg.slice(0, eq);
      const value = arg.slice(eq + 1);
      if (SECRET_ENV_KEY_PATTERN.test(key) || looksLikeSecretValue(value)) {
        return `${key}=${REDACTED}`;
      }
      return arg;
    }
    return looksLikeSecretValue(arg) ? REDACTED : redactText(arg);
  });
}

/** Returns a scrubbed copy of an environment map. */
export function redactEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      out[key] = undefined;
    } else if (SECRET_ENV_KEY_PATTERN.test(key) || looksLikeSecretValue(value)) {
      out[key] = REDACTED;
    } else {
      out[key] = redactText(value);
    }
  }
  return out;
}

/** Recursively scrub every string inside a JSON-like structure. */
export function deepRedact<T>(value: T): T {
  if (typeof value === "string") {
    return redactText(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => deepRedact(entry)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (typeof entry === "string" && SECRET_ENV_KEY_PATTERN.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = deepRedact(entry);
      }
    }
    return out as unknown as T;
  }
  return value;
}

/** Replace private input paths (config roots, secret files, certs) in text. */
export function redactPrivatePaths(
  text: string,
  privatePaths: readonly string[],
): string {
  let out = text;
  const sorted = [...privatePaths].sort((a, b) => b.length - a.length);
  for (const p of sorted) {
    if (p.length === 0) continue;
    out = out.split(p).join(REDACTED_PATH);
  }
  return out;
}

export interface RedactingLogger {
  log(line: string): void;
}

/** Wrap a sink so every logged line is scrubbed before it is emitted. */
export function createRedactingLogger(
  sink: (line: string) => void,
  privatePaths: readonly string[] = [],
): RedactingLogger {
  return {
    log(line: string) {
      sink(redactPrivatePaths(redactText(line), privatePaths));
    },
  };
}

export const REDACTED_MARKER = REDACTED;
export const REDACTED_PATH_MARKER = REDACTED_PATH;
