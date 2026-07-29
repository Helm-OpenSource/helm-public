/**
 * caio-admin active-release pointer contract.
 *
 * The pointer file is plain text containing one absolute path, mode 0600 and
 * owner-private. Updates go through a same-filesystem temp file plus atomic
 * rename. The target must live inside releasesRoot with no symlink at any
 * ancestor below the root, must be a sealed release that verifies, must NOT
 * be writable, and its digest must be known to the operator's registry.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  type CaioAdminResult,
  blockedResult,
  okResult,
} from "@/tools/caio-admin/contracts";
import {
  RELEASE_SEAL_FILE,
  type ReleaseSeal,
  readReleaseSeal,
} from "@/tools/caio-admin/install";

export const ACTIVE_RELEASE_POINTER_MODE = 0o600;

export interface SealVerifierPort {
  /** Verify a release tree against its seal (tree hash, entry count, ...). */
  verifySeal(releaseDir: string, seal: ReleaseSeal): Promise<boolean>;
}

export interface DigestRegistryPort {
  isKnownDigest(manifestSha256: string): Promise<boolean>;
}

export interface SetActiveReleaseInput {
  pointerPath: string;
  releasesRoot: string;
  targetDir: string;
  ports: {
    sealVerifier: SealVerifierPort;
    digests: DigestRegistryPort;
  };
}

export async function readActiveReleasePointer(pointerPath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(pointerPath, "utf8");
    const value = raw.trim();
    return value.length > 0 && path.isAbsolute(value) ? value : null;
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

export async function setActiveRelease(input: SetActiveReleaseInput): Promise<CaioAdminResult> {
  const { pointerPath, releasesRoot, targetDir, ports } = input;
  const root = path.resolve(releasesRoot);
  const target = path.resolve(targetDir);

  // Containment: target must resolve strictly inside releasesRoot.
  const rel = path.relative(root, target);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    return blockedResult("active-release", "release_outside_root", {
      detail: { targetDir: target },
    });
  }

  // No symlink at any path component below releasesRoot (including target).
  let cursor = root;
  for (const segment of rel.split(path.sep)) {
    cursor = path.join(cursor, segment);
    const st = await lstatOrNull(cursor);
    if (!st) {
      return blockedResult("active-release", "release_missing", {
        detail: { targetDir: target },
      });
    }
    if (st.isSymbolicLink()) {
      return blockedResult("active-release", "symlink_in_release_path", {
        detail: { targetDir: target },
      });
    }
  }
  const targetStat = await lstatOrNull(target);
  if (!targetStat || !targetStat.isDirectory()) {
    return blockedResult("active-release", "release_not_a_directory", {
      detail: { targetDir: target },
    });
  }

  // Belt-and-suspenders: the realpath must not escape the root's realpath.
  const rootReal = await fs.realpath(root);
  const targetReal = await fs.realpath(target);
  const relReal = path.relative(rootReal, targetReal);
  if (relReal === "" || relReal.startsWith("..") || path.isAbsolute(relReal)) {
    return blockedResult("active-release", "release_outside_root", {
      detail: { targetDir: target },
    });
  }

  // Sealed release only.
  const seal = await readReleaseSeal(target);
  if (!seal) {
    return blockedResult("active-release", "unsealed_release", {
      detail: { targetDir: target, sealFile: RELEASE_SEAL_FILE },
    });
  }
  const sealOk = await ports.sealVerifier.verifySeal(target, seal);
  if (!sealOk) {
    return blockedResult("active-release", "seal_verification_failed", {
      detail: { targetDir: target },
    });
  }

  // Immutable release only: any write bit on the release dir is a refusal.
  if ((targetStat.mode & 0o222) !== 0) {
    return blockedResult("active-release", "writable_release", {
      detail: { targetDir: target, mode: (targetStat.mode & 0o777).toString(8) },
    });
  }

  // Unknown digest is a refusal, not a warning.
  const known = await ports.digests.isKnownDigest(seal.manifestSha256);
  if (!known) {
    return blockedResult("active-release", "unknown_digest", {
      detail: { targetDir: target },
    });
  }

  // Same-filesystem temp + atomic rename; pointer stays 0600 owner-private.
  const pointerDir = path.dirname(pointerPath);
  await fs.mkdir(pointerDir, { recursive: true, mode: 0o700 });
  const tmpPath = path.join(
    pointerDir,
    `.${path.basename(pointerPath)}.tmp-${process.pid}-${Date.now()}`,
  );
  await fs.writeFile(tmpPath, `${target}\n`, { mode: ACTIVE_RELEASE_POINTER_MODE });
  await fs.chmod(tmpPath, ACTIVE_RELEASE_POINTER_MODE);
  await fs.rename(tmpPath, pointerPath);

  return okResult("active-release", {
    detail: { pointerPath, activeRelease: target, manifestSha256: seal.manifestSha256 },
  });
}
