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

/**
 * Package-supplied strings NEVER reach a path without passing this grammar.
 * Lowercase alphanumerics and single dashes only: no dot, no separator in any
 * encoding (`%` and `\` are outside the class), no control character, no NUL,
 * length 2..64, and it can never be `.`/`..`.
 */
export const PACKAGE_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

/** A manifest digest is a bare lowercase sha256 hex string — nothing else. */
export const MANIFEST_SHA256_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Explicit deny list applied BEFORE the grammar. Redundant by construction,
 * kept so that a future grammar relaxation cannot silently re-open a path
 * escape, and so rejections are attributable.
 */
const UNSAFE_PATH_CHARS = /[/\\:%\s]|[\x00-\x1f\x7f]/;

/** True when `value` is safe to use as a single path component. */
export function isSafePackageKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 64) return false;
  if (UNSAFE_PATH_CHARS.test(value)) return false;
  if (value.includes("..") || value === "." || value === "..") return false;
  if (value !== path.basename(value)) return false;
  return PACKAGE_KEY_PATTERN.test(value);
}

/** True when `value` is a bare sha256 hex digest. */
export function isSafeManifestSha256(value: unknown): value is string {
  return typeof value === "string" && MANIFEST_SHA256_PATTERN.test(value);
}

/**
 * Compose the single release directory NAME. Throws on any input that is not
 * already validated — no caller may build a release path from package content
 * that has not passed the grammar.
 */
export function releaseDirName(packageKey: string, manifestSha256: string): string {
  if (!isSafePackageKey(packageKey)) {
    throw new Error("invalid packageKey: refusing to compose a release path");
  }
  if (!isSafeManifestSha256(manifestSha256)) {
    throw new Error("invalid manifest digest: refusing to compose a release path");
  }
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

async function lstatOrNull(p: string) {
  try {
    return await fs.lstat(p);
  } catch {
    return null;
  }
}

async function pathExists(p: string): Promise<boolean> {
  return (await lstatOrNull(p)) !== null;
}

/**
 * Containment gate run BEFORE anything is created: the release directory must
 * be a DIRECT child of the resolved releases root, and no component at or
 * below the root may be a symlink (mirrors the walk in active-release.ts).
 * Returns a blocked reason token, or null when the path is safe to create.
 */
async function releasePathRefusal(
  releasesRoot: string,
  dirName: string,
): Promise<string | null> {
  const root = path.resolve(releasesRoot);
  const target = path.resolve(root, dirName);

  // Direct child only: exactly one component below the root, no traversal.
  const rel = path.relative(root, target);
  if (
    rel === "" ||
    rel.startsWith("..") ||
    path.isAbsolute(rel) ||
    rel.split(path.sep).length !== 1 ||
    rel !== dirName
  ) {
    return "release_outside_root";
  }

  // If the root does not exist yet nothing below it can exist either.
  const rootStat = await lstatOrNull(root);
  if (rootStat === null) return null;

  const targetStat = await lstatOrNull(target);
  if (targetStat === null) return null;
  if (targetStat.isSymbolicLink()) return "symlink_in_release_path";

  // Belt-and-suspenders: with the root's own symlinks resolved, the existing
  // target must still be exactly the direct child we intend to touch.
  const rootReal = await fs.realpath(root);
  const targetReal = await fs.realpath(target);
  if (targetReal !== path.join(rootReal, dirName)) {
    return "release_outside_root";
  }
  return null;
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
  // Package-supplied strings are validated at the EARLIEST point they are
  // read — before any of them is echoed, joined into a path, or used to
  // create anything on disk.
  if (!isSafePackageKey(verification.packageKey)) {
    return blockedResult("install", "package_key_invalid", {
      findings: [
        {
          checkKey: "package_key",
          status: "fail",
          detail:
            "manifest packageKey does not match the required grammar [a-z0-9][a-z0-9-]{1,63}; refusing to compose a release path",
        },
      ],
    });
  }
  if (!isSafeManifestSha256(verification.manifestSha256)) {
    return blockedResult("install", "manifest_digest_invalid", {
      findings: [
        {
          checkKey: "package_manifest",
          status: "fail",
          detail: "manifest digest is not a bare sha256 hex string",
        },
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

  // Containment BEFORE creating anything.
  const refusal = await releasePathRefusal(releasesRoot, dirName);
  if (refusal !== null) {
    return blockedResult("install", refusal, {
      findings: [
        ...findings,
        {
          checkKey: "release_path",
          status: "fail",
          detail: "release path is not a symlink-free direct child of the releases root",
        },
      ],
      detail: { releaseDir: targetDir },
    });
  }

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

  // A pre-existing staging path (including a planted symlink) is a refusal,
  // never something to write through. mkdir below is non-recursive, so the
  // final component is created by us or not at all.
  if (await pathExists(stagingDir)) {
    return blockedResult("install", "staging_path_exists", {
      findings: [
        ...findings,
        {
          checkKey: "staging_path",
          status: "fail",
          detail: "staging path already exists; refusing to reuse or write through it",
        },
      ],
      detail: { releaseDir: targetDir },
    });
  }

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
