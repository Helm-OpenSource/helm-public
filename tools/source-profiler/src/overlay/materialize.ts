/**
 * Source Profiler — overlay materialize guard + writer.
 *
 * Writes an OverlayPatchDraft to disk under an explicit overlay root, but only
 * after guard checks pass. It never commits, never pushes, and never enables a
 * connector. (Auto-commit/push would require shelling out to git, which the
 * tool's boundary guard SP-A forbids in tool source.)
 *
 * Guards:
 *   - target must be OUTSIDE the source repo (cannot write into the shared
 *     working tree, e.g. helm-public);
 *   - target must look like an overlay root (AGENTS.md or a tenants/ dir);
 *   - every file path must resolve INSIDE the overlay root (no path escape);
 *   - existing non-empty target dir requires `force` (no silent clobber).
 *
 * Worktree-cleanliness beyond "outside the source repo" is delegated to the
 * overlay repo's own gates (validate:overlay / audit:staging) and the operator.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { OverlayPatchDraft } from "../contract/overlay";

export type MaterializeInput = {
  draft: OverlayPatchDraft;
  /** Absolute or cwd-relative overlay root. */
  overlayRoot: string;
  /** Repo root that must NOT contain the overlay root (the shared working tree). */
  sourceRepoRoot: string;
  cwd: string;
  force?: boolean;
};

export type MaterializeResult = {
  overlayRoot: string;
  writtenFiles: string[];
};

const SAFE_SLUG = /^[A-Za-z0-9_-]+$/;

export function materializeOverlayDraft(input: MaterializeInput): MaterializeResult {
  const { draft, cwd, sourceRepoRoot, force } = input;
  const overlayRootAbs = path.resolve(cwd, input.overlayRoot);
  const sourceRepoAbs = path.resolve(cwd, sourceRepoRoot);

  if (!existsSync(overlayRootAbs)) {
    throw new Error(`overlay root does not exist: ${overlayRootAbs}`);
  }
  if (isInside(overlayRootAbs, sourceRepoAbs) || overlayRootAbs === sourceRepoAbs) {
    throw new Error(
      "refusing to materialize into the source repo working tree; use a separate overlay worktree",
    );
  }
  if (!looksLikeOverlayRoot(overlayRootAbs)) {
    throw new Error(
      "target does not look like an overlay root (missing AGENTS.md or tenants/)",
    );
  }

  // Reject unsafe slugs and verify the normalized target stays inside the
  // overlay root (defense-in-depth against tenant/slug path traversal).
  if (!SAFE_SLUG.test(draft.tenantKey) || !SAFE_SLUG.test(draft.extensionSlug)) {
    throw new Error("overlay tenantKey/extensionSlug must match ^[A-Za-z0-9_-]+$");
  }
  const targetDir = path.join(
    overlayRootAbs,
    "tenants",
    draft.tenantKey,
    "extensions",
    draft.extensionSlug,
  );
  if (!isInside(targetDir, overlayRootAbs)) {
    throw new Error(`overlay target dir escapes overlay root: ${targetDir}`);
  }
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0 && !force) {
    throw new Error(
      `overlay target already exists and is non-empty: ${targetDir} (pass force to overwrite)`,
    );
  }

  const writtenFiles: string[] = [];
  for (const file of draft.files) {
    const fileAbs = path.resolve(overlayRootAbs, file.path);
    // Confine writes to THIS extension's target dir, not just the overlay root,
    // so a draft can never write into another tenant/extension tree.
    if (!isInside(fileAbs, targetDir)) {
      throw new Error(`overlay file path escapes the extension target dir: ${file.path}`);
    }
    mkdirSync(path.dirname(fileAbs), { recursive: true });
    writeFileSync(fileAbs, file.content, "utf8");
    writtenFiles.push(path.relative(overlayRootAbs, fileAbs));
  }

  return { overlayRoot: overlayRootAbs, writtenFiles: writtenFiles.sort() };
}

function looksLikeOverlayRoot(rootAbs: string): boolean {
  return (
    existsSync(path.join(rootAbs, "AGENTS.md")) ||
    existsSync(path.join(rootAbs, "tenants"))
  );
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
