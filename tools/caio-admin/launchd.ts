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
 * Validate a launchd plist template. Rejects DATABASE_URL anywhere, secret
 * key names inside EnvironmentVariables, and secret-looking string values.
 */
export function validateLaunchdPlistTemplate(plistText: string): PlistValidation {
  if (/DATABASE_URL/i.test(plistText)) {
    return { ok: false, reason: "plist contains DATABASE_URL" };
  }
  const keys = [...plistText.matchAll(/<key>([^<]*)<\/key>/g)].map((m) => m[1]);
  for (const key of keys) {
    if (SECRET_KEY_PATTERN.test(key)) {
      return { ok: false, reason: `plist contains secret-named key ${key}` };
    }
  }
  const strings = [...plistText.matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
  for (const value of strings) {
    if (looksLikeSecretValue(value)) {
      return { ok: false, reason: "plist contains a secret-looking value" };
    }
  }
  return { ok: true };
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
