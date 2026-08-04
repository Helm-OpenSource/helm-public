/**
 * Shared redaction helpers for the caio-admin and caio-connect CLI cores.
 *
 * Every operator-facing surface (argv echoes, env dumps, log lines, --json
 * output) must pass through these helpers so that secret material never
 * reaches a terminal, a log file, or a serialized result.
 *
 * Detection is STRUCTURAL FIRST, entropy second — the same discipline the
 * launchd plist scanner uses:
 *
 *   1. NAME: a credential-ish argument / env / object key name means the value
 *      it carries is secret material, whatever it looks like. A short token
 *      (`--token hunter2`) or a spaced passphrase (`--password "four word
 *      phrase"`) carries no entropy signal at all, so entropy alone can never
 *      protect them.
 *   2. SHAPE: URL-embedded credentials, PEM headers and long high-entropy
 *      blobs are an ADDITIONAL trigger, applied to every value regardless of
 *      its name. Shape is never a permission: a value that fails the shape
 *      check is not thereby declared safe.
 */

/**
 * Credential-ish key/flag NAME vocabulary, matched as a substring because
 * separator-free names (`DBPASSWORD`, `apiKey`) must still hit. These tokens
 * are specific enough that substring matching does not collide with ordinary
 * operational vocabulary.
 */
const CREDENTIAL_NAME_STRONG_PATTERN =
  /(secret|token|passwd|password|credential|authorization|bearer|session|dsn|api[-_]?key|access[-_]?key|private[-_]?key|database[-_]?url)/i;

/**
 * Short/ambiguous credential words that must appear as a WHOLE name segment,
 * so `--auth`/`DB_PWD`/`connStr` match while `--author`, `connected` and
 * `upwards` do not. Segments are split on separators and camelCase humps.
 *
 * These stay deliberately fail-closed: a hypothetical `--conn-timeout` or
 * `--auth-mode` would be treated as credential-named (the caio-admin flag
 * vocabulary contains no such flag). Refusing a benign flag is a recoverable
 * operator error; admitting a secret onto the command line is not.
 */
const CREDENTIAL_NAME_SEGMENTS: ReadonlySet<string> = new Set([
  "pwd",
  "pass",
  "auth",
  "conn",
  "cred",
  "creds",
]);

/**
 * Trailing segments that turn a credential-named FLAG into a pointer: it
 * carries a logical ref name or a path to a 0600 secret file, not the secret
 * itself (`--credential-ref db-password`, `--secret-file /path`). Pointer
 * flags are exempt from the name rule ONLY on the blocking path — the shape
 * rule still runs on their values, and redaction (which may over-redact
 * freely) does not use this exemption at all.
 */
const POINTER_NAME_SEGMENTS: ReadonlySet<string> = new Set([
  "ref",
  "refs",
  "file",
  "files",
  "path",
  "paths",
  "name",
  "names",
  "dir",
  "dirs",
  "root",
]);

const URL_CREDENTIALS_PATTERN = /([a-z][a-z0-9+.-]*:\/\/)([^/\s@]*:[^/\s@]*)@/gi;

/** PEM armor: private keys and certificates arrive WITH whitespace. */
const PEM_HEADER_PATTERN = /-----BEGIN [A-Z][A-Z0-9 ]*-----/;

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

/** Split a flag / env / object key into lowercase name segments. */
function nameSegments(name: string): string[] {
  return name
    .replace(/^-+/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.toLowerCase());
}

function hasCredentialName(name: string): boolean {
  const bare = name.replace(/^-+/, "");
  if (bare.length === 0) return false;
  if (CREDENTIAL_NAME_STRONG_PATTERN.test(bare)) return true;
  return nameSegments(bare).some((segment) =>
    CREDENTIAL_NAME_SEGMENTS.has(segment),
  );
}

/**
 * Env-variable / object-key semantics: credential-ish name ⇒ the value is
 * secret. No pointer exemption here — over-redacting `SECRET_FILE=/path` in a
 * log line costs nothing, while under-redacting cannot be undone.
 */
export function isCredentialKeyName(key: string): boolean {
  return hasCredentialName(key);
}

/**
 * CLI flag semantics used by the BLOCKING path (refusing secrets on the
 * command line): credential-ish flag name ⇒ its value is secret, whatever its
 * length, entropy or whitespace. Pointer flags (`--credential-ref`,
 * `--secret-file`, `--token-path`) are excluded because refusing them would
 * reject the only supported way to pass credentials, and their values are
 * still shape-checked.
 */
export function isCredentialFlagName(name: string): boolean {
  const segments = nameSegments(name);
  if (segments.length === 0) return false;
  if (POINTER_NAME_SEGMENTS.has(segments[segments.length - 1])) return false;
  return hasCredentialName(name);
}

/**
 * SHAPE check for a value with NO name context (a bare positional argument, a
 * plist <string>, a token spotted inside free text). It fires on URL-embedded
 * credentials and PEM armor unconditionally, and otherwise only on long
 * (>= 20 chars) high-entropy material.
 *
 * The length / whitespace / path carve-outs below exist ONLY because a bare
 * short low-entropy positional (`abc`, `four word phrase`) is indistinguishable
 * from a benign argument, so refusing it would break ordinary CLI use. They are
 * NOT a statement that such values are safe: every caller that has a name in
 * hand must consult isCredentialKeyName / isCredentialFlagName FIRST, and the
 * name verdict wins.
 */
export function looksLikeSecretValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  URL_CREDENTIALS_PATTERN.lastIndex = 0;
  if (URL_CREDENTIALS_PATTERN.test(trimmed)) return true;
  if (PEM_HEADER_PATTERN.test(trimmed)) return true;
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
  // KEY="quoted value" assignments: the quotes delimit the value, so a spaced
  // secret is scrubbed in full.
  out = out.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*)=(["'])(?:\\.|(?!\2)[^\\])*\2/g,
    (match, key: string, quote: string) =>
      isCredentialKeyName(key) ? `${key}=${quote}${REDACTED}${quote}` : match,
  );
  // KEY=value assignments where the key name implies a secret. In free text the
  // value's end is unknowable, so an UNQUOTED value is scrubbed only up to the
  // first whitespace; argv and env callers (redactArgv / redactEnv) know the
  // real boundary and scrub the whole value.
  out = out.replace(
    /\b([A-Za-z_][A-Za-z0-9_]*)=(\S+)/g,
    (match, key: string, value: string) => {
      if (!isCredentialKeyName(key)) return match;
      // Already fully handled by the quoted-value rule above; keep its quotes.
      if (value === `"${REDACTED}"` || value === `'${REDACTED}'`) return match;
      return `${key}=${REDACTED}`;
    },
  );
  // Long high-entropy tokens anywhere in the text.
  out = out.replace(/[A-Za-z0-9+/_=:@.-]{20,}/g, (candidate) =>
    looksLikeSecretValue(candidate) ? REDACTED : candidate,
  );
  return out;
}

/**
 * Returns a scrubbed copy of argv suitable for logs and error messages.
 *
 * Name-first: `--<credential-ish>=value` is redacted whatever the value looks
 * like, and the token FOLLOWING a credential-ish flag is redacted too (the
 * `--token hunter2` separate form). Pointer flags are not exempt here — this is
 * the redaction path, where over-scrubbing a path is harmless.
 */
export function redactArgv(argv: readonly string[]): string[] {
  let previousWasCredentialFlag = false;
  return argv.map((arg) => {
    const carriesSecretValue = previousWasCredentialFlag;
    const eq = arg.indexOf("=");
    const isFlag = arg.startsWith("-") && arg.length > 1;
    const inlineForm = isFlag && eq > 1;
    previousWasCredentialFlag =
      isFlag && !inlineForm && isCredentialKeyName(arg);

    if (inlineForm) {
      const key = arg.slice(0, eq);
      const value = arg.slice(eq + 1);
      if (isCredentialKeyName(key) || looksLikeSecretValue(value)) {
        return `${key}=${REDACTED}`;
      }
      return arg;
    }
    if (carriesSecretValue && !isFlag && arg.length > 0) return REDACTED;
    return looksLikeSecretValue(arg) ? REDACTED : redactText(arg);
  });
}

/**
 * Returns a scrubbed copy of an environment map. Name-first: a credential-ish
 * variable NAME redacts its value whatever the value looks like, so short
 * (`CAIO_TOKEN=hunter2`) and spaced (`DB_PASSWORD=four word phrase`) secrets
 * are scrubbed; value shape is an additional trigger for oddly-named vars.
 */
export function redactEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      out[key] = undefined;
    } else if (isCredentialKeyName(key) || looksLikeSecretValue(value)) {
      out[key] = REDACTED;
    } else {
      out[key] = redactText(value);
    }
  }
  return out;
}

/**
 * Recursively scrub every string inside a JSON-like structure. Object KEYS are
 * consulted first (`{ token: "hunter2" }`, `{ apiKey: "x y z" }` are redacted
 * on the strength of the key alone); remaining strings go through redactText.
 */
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
      if (typeof entry === "string" && isCredentialKeyName(key)) {
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
