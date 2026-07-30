/**
 * caio-admin launchd — persistent service contract.
 *
 * Only a TESTED service contract shipped inside the new package may create
 * launchd plists. Plist templates are validated before provisioning: no
 * DATABASE_URL and no secret-looking environment values may appear inside a
 * plist (launchd plists are world-readable by convention). When no supported
 * contract is present, the command runs a foreground smoke only and reports
 * persistent_service_not_provisioned.
 */

import {
  type CaioAdminResult,
  type CommandRunnerPort,
  blockedResult,
  failedResult,
  okResult,
} from "@/tools/caio-admin/contracts";
import { looksLikeSecretValue } from "@/tools/caio-admin/redaction";

export interface ServiceContract {
  label: string;
  plistTemplate: string;
  /** True only when the packaged contract ships its own passing tests. */
  contractTested: boolean;
}

export interface LaunchdPorts {
  /** Reads the packaged service contract from the release; null if absent. */
  readServiceContract(releaseDir: string): Promise<ServiceContract | null>;
  writePlist(label: string, plistText: string): Promise<{ path: string }>;
  runner: CommandRunnerPort;
}

export type PlistValidation = { ok: true } | { ok: false; reason: string };

const SECRET_KEY_PATTERN =
  /(secret|token|passwd|password|credential|api[-_]?key|private[-_]?key)/i;

/**
 * Credential-shaped environment variable NAMES. Applied to plist
 * EnvironmentVariables keys only, where a wide pattern cannot collide with
 * launchd's own structural key vocabulary.
 */
const CREDENTIAL_ENV_KEY_PATTERN =
  /(pass|pwd|secret|token|credential|auth|bearer|api[-_]?key|private[-_]?key|[-_]key$|^key$|dsn|conn|database[-_]?url|_url$|^url$)/i;

/** scheme://user:password@host — a secret regardless of length or entropy. */
const URL_CREDENTIALS_PATTERN = /[a-z][a-z0-9+.-]*:\/\/[^/\s:@]*:[^/\s@]*@/i;

/**
 * Environment variable names that may legitimately appear in a plist. launchd
 * plists are world-readable by convention, so this list is an ALLOWLIST: an
 * unrecognized name is refused, never admitted. Exact, case-sensitive match.
 */
export const ALLOWED_PLIST_ENV_KEYS: readonly string[] = [
  "PATH",
  "HOME",
  "TMPDIR",
  "LANG",
  "LC_ALL",
  "TZ",
  "NODE_ENV",
  "NODE_OPTIONS",
  "UMASK",
  "CAIO_CONFIG_ROOT",
  "CAIO_RELEASE_DIR",
  "CAIO_LOG_DIR",
  "CAIO_LISTEN_ADDRESS",
  "CAIO_LISTEN_PORT",
];

type EnvBlocks = { ok: true; blocks: string[] } | { ok: false; reason: string };

/** Slice out every `EnvironmentVariables` dict body with balanced tags. */
function extractEnvironmentVariableBlocks(plistText: string): EnvBlocks {
  const blocks: string[] = [];
  const opener = /<key>\s*EnvironmentVariables\s*<\/key>\s*<dict\s*(\/?)>/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(plistText)) !== null) {
    if (match[1] === "/") continue; // <dict/> — empty environment
    const start = match.index + match[0].length;
    const tag = /<(\/?)dict\s*(\/?)>/g;
    tag.lastIndex = start;
    let depth = 1;
    let end = -1;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tag.exec(plistText)) !== null) {
      if (tagMatch[2] === "/") continue; // self-closing, no depth change
      depth += tagMatch[1] === "/" ? -1 : 1;
      if (depth === 0) {
        end = tagMatch.index;
        break;
      }
    }
    if (end < 0) {
      return { ok: false, reason: "plist has an unterminated EnvironmentVariables dict" };
    }
    blocks.push(plistText.slice(start, end));
    opener.lastIndex = end;
  }
  return { ok: true, blocks };
}

const ENV_ENTRY_PATTERN =
  /<key>([^<]*)<\/key>\s*(?:<string>([^<]*)<\/string>|<integer>([^<]*)<\/integer>|<(?:true|false)\s*\/>)/g;

/**
 * Validate a launchd plist template.
 *
 * Secret detection here is STRUCTURAL, never entropy-based: a value's length
 * or character mix can never be the reason a plist is accepted. The rules are
 *   1. DATABASE_URL anywhere is a refusal;
 *   2. every EnvironmentVariables key must be on ALLOWED_PLIST_ENV_KEYS and
 *      must not be credential-shaped (unknown key ⇒ refusal, fail closed);
 *   3. EnvironmentVariables must be a flat dict of scalar values;
 *   4. any value embedding URL credentials (`scheme://user:pass@`) is a
 *      refusal;
 *   5. secret-named structural keys and high-entropy values are refused too —
 *      an additional net on top of 1..4, not the load-bearing check.
 */
export function validateLaunchdPlistTemplate(plistText: string): PlistValidation {
  if (/DATABASE_URL/i.test(plistText)) {
    return { ok: false, reason: "plist contains DATABASE_URL" };
  }

  const env = extractEnvironmentVariableBlocks(plistText);
  if (!env.ok) return env;
  for (const block of env.blocks) {
    if (/<dict\s*>|<array\s*>/i.test(block)) {
      return {
        ok: false,
        reason: "plist EnvironmentVariables must be a flat dict of scalar values",
      };
    }
    const declaredKeys = [...block.matchAll(/<key>([^<]*)<\/key>/g)].map((m) => m[1]);
    ENV_ENTRY_PATTERN.lastIndex = 0;
    const entries = [...block.matchAll(ENV_ENTRY_PATTERN)];
    if (entries.length !== declaredKeys.length) {
      return {
        ok: false,
        reason: "plist EnvironmentVariables contains an unsupported value type",
      };
    }
    for (const entry of entries) {
      const key = entry[1].trim();
      const value = entry[2] ?? entry[3] ?? "";
      if (CREDENTIAL_ENV_KEY_PATTERN.test(key)) {
        return {
          ok: false,
          reason: `plist EnvironmentVariables key ${key} is credential-shaped`,
        };
      }
      if (!ALLOWED_PLIST_ENV_KEYS.includes(key)) {
        return {
          ok: false,
          reason: `plist EnvironmentVariables key ${key} is not on the non-secret allowlist`,
        };
      }
      if (URL_CREDENTIALS_PATTERN.test(value)) {
        return {
          ok: false,
          reason: `plist EnvironmentVariables key ${key} embeds URL credentials`,
        };
      }
    }
  }

  const keys = [...plistText.matchAll(/<key>([^<]*)<\/key>/g)].map((m) => m[1]);
  for (const key of keys) {
    if (SECRET_KEY_PATTERN.test(key)) {
      return { ok: false, reason: `plist contains secret-named key ${key}` };
    }
  }
  const strings = [...plistText.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
  for (const value of strings) {
    if (URL_CREDENTIALS_PATTERN.test(value)) {
      return { ok: false, reason: "plist contains a value embedding URL credentials" };
    }
    if (looksLikeSecretValue(value)) {
      return { ok: false, reason: "plist contains a secret-looking value" };
    }
  }
  return { ok: true };
}

/**
 * launchd labels are reverse-DNS style and become a plist FILE NAME in real
 * adapters, so the same single-path-component discipline as the release
 * directory applies (see install.ts).
 */
export const SERVICE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isSafeServiceLabel(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.includes("..") || value === "." || value === "..") return false;
  if (/[/\\:%\s]|[\x00-\x1f\x7f]/.test(value)) return false;
  return SERVICE_LABEL_PATTERN.test(value);
}

export interface ProvisionServiceInput {
  releaseDir: string;
  ports: LaunchdPorts;
}

export async function caioAdminProvisionService(
  input: ProvisionServiceInput,
): Promise<CaioAdminResult> {
  const { releaseDir, ports } = input;

  const contract = await ports.readServiceContract(releaseDir);
  if (!contract) {
    // No supported contract: foreground smoke only, no launchd artifacts.
    const smoke = await ports.runner.run({
      key: "foreground_smoke",
      command: "npm",
      args: ["run", "smoke"],
      cwd: releaseDir,
    });
    if (!smoke.ok) {
      return failedResult("launchd", {
        findings: [
          { checkKey: "foreground_smoke", status: "fail", detail: "foreground smoke failed" },
        ],
        detail: { persistentService: "not_provisioned" },
      });
    }
    return okResult("launchd", {
      findings: [
        { checkKey: "foreground_smoke", status: "ok", detail: "foreground smoke passed" },
        {
          checkKey: "persistent_service_not_provisioned",
          status: "warn",
          detail: "no tested service contract in package; launchd not provisioned",
        },
      ],
      detail: { persistentService: "not_provisioned" },
    });
  }

  // The label is package-supplied and real adapters turn it into a plist path
  // (`.../LaunchAgents/<label>.plist`), so it is validated as a single path
  // component before it is used or echoed.
  if (!isSafeServiceLabel(contract.label)) {
    return blockedResult("launchd", "service_label_invalid", {
      findings: [
        {
          checkKey: "service_label",
          status: "fail",
          detail:
            "packaged service label is not a safe single path component (reverse-DNS style [A-Za-z0-9._-] only)",
        },
      ],
      detail: { releaseDir },
    });
  }

  if (!contract.contractTested) {
    return blockedResult("launchd", "untested_service_contract", {
      detail: { releaseDir, label: contract.label },
    });
  }

  const validation = validateLaunchdPlistTemplate(contract.plistTemplate);
  if (!validation.ok) {
    return blockedResult("launchd", "plist_contains_secrets", {
      findings: [
        { checkKey: "plist_template", status: "fail", detail: validation.reason },
      ],
      detail: { releaseDir, label: contract.label },
    });
  }

  const written = await ports.writePlist(contract.label, contract.plistTemplate);
  return okResult("launchd", {
    findings: [
      { checkKey: "plist_template", status: "ok", detail: "plist validated and written" },
    ],
    detail: { persistentService: "provisioned", plistPath: written.path, label: contract.label },
  });
}
