/**
 * caio-admin configure — generate the owner-private configuration skeleton
 * OUTSIDE the immutable release tree. Accepts only credentialRef names plus
 * paths to pre-provisioned 0600 secret files; refuses secrets passed as CLI
 * arguments and never reads secret values into any output.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  type CaioAdminFinding,
  type CaioAdminResult,
  type FileInspectorPort,
  blockedResult,
  failedResult,
  okResult,
} from "@/tools/caio-admin/contracts";
import { looksLikeSecretValue } from "@/tools/caio-admin/redaction";

export const CONFIG_FILE_NAME = "caio-admin.json";
export const CONFIG_ROOT_MODE = 0o700;
export const CONFIG_FILE_MODE = 0o600;

const CREDENTIAL_REF_NAME_PATTERN = /^[a-z][a-z0-9_.-]*$/;

export interface CredentialRefInput {
  /** Logical name only — never a secret value. */
  name: string;
  /** Path to a pre-provisioned secret file (0600, regular, nlink=1). */
  secretFilePath: string;
}

export interface ConfigurePorts {
  files: FileInspectorPort;
  identity: {
    /** uid of the account that must own the secret files. */
    expectedOwnerUid(): number;
  };
  now?: () => number;
}

export interface ConfigureInput {
  configRoot: string;
  credentialRefs: readonly CredentialRefInput[];
  /** Raw argv as received; scanned for secret values, never echoed. */
  argv: readonly string[];
  ports: ConfigurePorts;
}

/**
 * Returns the indexes of argv entries that look like secret values. Values
 * after `--flag=` separators are checked too. Paths are exempt.
 */
export function findSecretArgvIndexes(argv: readonly string[]): number[] {
  const hits: number[] = [];
  argv.forEach((arg, index) => {
    const eq = arg.indexOf("=");
    const candidate = arg.startsWith("--") && eq > 2 ? arg.slice(eq + 1) : arg;
    if (looksLikeSecretValue(candidate)) hits.push(index);
  });
  return hits;
}

export async function caioAdminConfigure(input: ConfigureInput): Promise<CaioAdminResult> {
  const { configRoot, credentialRefs, argv, ports } = input;
  const now = ports.now ? ports.now() : Date.now();
  const privateInputPaths = [
    configRoot,
    ...credentialRefs.map((ref) => ref.secretFilePath),
  ];

  // Refuse secrets on the command line — report positions only, never values.
  const secretIndexes = findSecretArgvIndexes(argv);
  if (secretIndexes.length > 0) {
    return blockedResult("configure", "secret_on_command_line", {
      findings: secretIndexes.map((index) => ({
        checkKey: `argv_${index}`,
        status: "fail" as const,
        detail: `argument at position ${index} looks like a secret value; pass a credentialRef name and a 0600 secret file path instead`,
      })),
      privateInputPaths,
    });
  }

  const findings: CaioAdminFinding[] = [];
  const expectedUid = ports.identity.expectedOwnerUid();

  for (const ref of credentialRefs) {
    const key = `credential_ref_${ref.name}`;
    if (!CREDENTIAL_REF_NAME_PATTERN.test(ref.name)) {
      findings.push({ checkKey: key, status: "fail", detail: "invalid credentialRef name" });
      continue;
    }
    const info = await ports.files.inspect(ref.secretFilePath);
    if (!info) {
      findings.push({ checkKey: key, status: "fail", detail: "secret file missing" });
      continue;
    }
    const problems: string[] = [];
    if (info.kind !== "file") problems.push(`not a regular file (${info.kind})`);
    if ((info.mode & 0o777) !== 0o600) {
      problems.push(`mode ${(info.mode & 0o777).toString(8)} != 600`);
    }
    if (info.nlink !== 1) problems.push(`nlink ${info.nlink} != 1`);
    if (info.uid !== expectedUid) problems.push("unexpected owner");
    findings.push(
      problems.length === 0
        ? { checkKey: key, status: "ok", detail: "secret file mode/owner verified (value not read)" }
        : { checkKey: key, status: "fail", detail: problems.join("; ") },
    );
  }

  if (findings.some((f) => f.status === "fail")) {
    return failedResult("configure", { findings, privateInputPaths });
  }

  // Owner-private skeleton: 0700 root, 0600 files, refs only — no values.
  await fs.mkdir(configRoot, { recursive: true, mode: CONFIG_ROOT_MODE });
  await fs.chmod(configRoot, CONFIG_ROOT_MODE);
  const configPath = path.join(configRoot, CONFIG_FILE_NAME);
  const body = {
    version: 1,
    generatedAt: new Date(now).toISOString(),
    credentialRefs: credentialRefs.map((ref) => ({
      name: ref.name,
      secretFile: ref.secretFilePath,
    })),
  };
  const tmpPath = path.join(configRoot, `.${CONFIG_FILE_NAME}.tmp-${process.pid}-${now}`);
  await fs.writeFile(tmpPath, `${JSON.stringify(body, null, 2)}\n`, { mode: CONFIG_FILE_MODE });
  await fs.chmod(tmpPath, CONFIG_FILE_MODE);
  await fs.rename(tmpPath, configPath);

  return okResult("configure", {
    findings,
    detail: { configPath, credentialRefCount: credentialRefs.length },
    privateInputPaths: [...privateInputPaths, configPath],
  });
}
