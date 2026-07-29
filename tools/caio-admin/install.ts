/**
 * caio-admin install — verify a distribution package, materialize it into a
 * NEW immutable release directory, run the in-package contract steps, then
 * seal the tree. Never overwrites an existing release; interrupted installs
 * are quarantined and the command is safe to re-run.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  type CaioAdminFinding,
  type CaioAdminResult,
  type CommandRunnerPort,
  type PackageVerifierPort,
  blockedResult,
  failedResult,
  okResult,
} from "@/tools/caio-admin/contracts";

export const RELEASE_SEAL_FILE = "release-seal.json";
export const INSTALLED_STATE = "installed_but_not_configured_or_activated";

export interface ReleaseSeal {
  manifestSha256: string;
  sealedAt: string;
  entryCount: number;
  treeSha256: string;
}

/** Materializes package contents into a destination directory. */
export interface PackageExtractorPort {
  extract(packagePath: string, destDir: string): Promise<void>;
}

/** Applies the read-only chmod sweep over a sealed release tree. */
export interface TreeSealerPort {
  chmodTreeReadOnly(dir: string): Promise<void>;
}

export interface InstallPorts {
  verifier: PackageVerifierPort;
  extractor: PackageExtractorPort;
  runner: CommandRunnerPort;
  sealer: TreeSealerPort;
  now?: () => number;
}

export interface InstallInput {
  packagePath: string;
  releasesRoot: string;
  ports: InstallPorts;
}

/** In-package contract steps executed inside the staged release. */
export const INSTALL_CONTRACT_STEPS: ReadonlyArray<{
  key: string;
  command: string;
  args: readonly string[];
}> = [
  { key: "npm_ci", command: "npm", args: ["ci"] },
  { key: "typecheck", command: "npm", args: ["run", "typecheck"] },
  { key: "build", command: "npm", args: ["run", "build"] },
];

export function releaseDirName(packageKey: string, manifestSha256: string): string {
  return `${packageKey}-${manifestSha256.slice(0, 12)}`;
}

export async function readReleaseSeal(releaseDir: string): Promise<ReleaseSeal | null> {
  try {
    const raw = await fs.readFile(path.join(releaseDir, RELEASE_SEAL_FILE), "utf8");
    const parsed = JSON.parse(raw) as Partial<ReleaseSeal>;
    if (
      typeof parsed.manifestSha256 !== "string" ||
      typeof parsed.sealedAt !== "string" ||
      typeof parsed.entryCount !== "number" ||
      typeof parsed.treeSha256 !== "string"
    ) {
      return null;
    }
    return parsed as ReleaseSeal;
  } catch {
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.lstat(p);
    return true;
  } catch {
    return false;
  }
}

export async function caioAdminInstall(input: InstallInput): Promise<CaioAdminResult> {
  const { packagePath, releasesRoot, ports } = input;
  const now = ports.now ? ports.now() : Date.now();
  const findings: CaioAdminFinding[] = [];

  // Re-verify the external digest + manifest at install time.
  const verification = await ports.verifier.verify(packagePath);
  if (!verification.ok) {
    return blockedResult("install", "package_digest_mismatch", {
      findings: [
        { checkKey: "package_manifest", status: "fail", detail: verification.reason },
      ],
    });
  }
  findings.push({
    checkKey: "package_manifest",
    status: "ok",
    detail: `sha256 ${verification.manifestSha256.slice(0, 12)}... verified`,
  });

  const dirName = releaseDirName(verification.packageKey, verification.manifestSha256);
  const targetDir = path.join(releasesRoot, dirName);

  // Immutability: never overwrite an existing release directory.
  if (await pathExists(targetDir)) {
    const seal = await readReleaseSeal(targetDir);
    if (seal && seal.manifestSha256 === verification.manifestSha256) {
      return okResult("install", {
        findings,
        detail: {
          releaseDir: targetDir,
          alreadyInstalled: true,
          state: INSTALLED_STATE,
        },
      });
    }
    return failedResult("install", {
      findings: [
        ...findings,
        {
          checkKey: "release_dir",
          status: "fail",
          detail:
            "release directory already exists with different or unsealed content; refusing to overwrite",
        },
      ],
      detail: { releaseDir: targetDir },
    });
  }

  await fs.mkdir(releasesRoot, { recursive: true });
  const stagingDir = `${targetDir}.staging-${now}`;

  try {
    await fs.mkdir(stagingDir);
    await ports.extractor.extract(packagePath, stagingDir);

    for (const step of INSTALL_CONTRACT_STEPS) {
      const result = await ports.runner.run({ ...step, cwd: stagingDir });
      findings.push({
        checkKey: `step_${step.key}`,
        status: result.ok ? "ok" : "fail",
        detail: result.ok
          ? `${step.key} passed`
          : `${step.key} failed (exit ${result.exitCode})`,
      });
      if (!result.ok) {
        throw new Error(`contract step ${step.key} failed`);
      }
    }

    const seal: ReleaseSeal = {
      manifestSha256: verification.manifestSha256,
      sealedAt: new Date(now).toISOString(),
      entryCount: verification.entryCount,
      treeSha256: verification.treeSha256,
    };
    await fs.writeFile(
      path.join(stagingDir, RELEASE_SEAL_FILE),
      `${JSON.stringify(seal, null, 2)}\n`,
      { mode: 0o644 },
    );
    await ports.sealer.chmodTreeReadOnly(stagingDir);
    await fs.rename(stagingDir, targetDir);
  } catch (error) {
    // Quarantine the partial tree so a re-run starts clean.
    let quarantinedDir: string | undefined;
    if (await pathExists(stagingDir)) {
      quarantinedDir = `${targetDir}.partial-${Date.now()}`;
      await fs.rename(stagingDir, quarantinedDir);
    }
    return failedResult("install", {
      findings: [
        ...findings,
        {
          checkKey: "install_interrupted",
          status: "fail",
          detail: `install interrupted: ${error instanceof Error ? error.message : "unknown error"}`,
        },
      ],
      detail: {
        releaseDir: targetDir,
        ...(quarantinedDir ? { quarantinedDir } : {}),
      },
    });
  }

  return okResult("install", {
    findings,
    detail: {
      releaseDir: targetDir,
      alreadyInstalled: false,
      state: INSTALLED_STATE,
    },
  });
}
