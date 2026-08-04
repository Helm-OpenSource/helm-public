import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  caioMultimodalWorkerManifestSchema,
  type CaioMultimodalWorkerManifest,
} from "@/lib/caio-multimodal-worker/worker-manifest-contracts";

/**
 * Offline release verification for a multimodal worker bundle.
 *
 * Fail-closed policy: ANY component failing offline/hash/license
 * verification makes the bundle non-releasable. The remedy is to fix the
 * pinned artifact and re-verify — never to substitute a newer version on
 * site (阻止发布，不现场改用最新版).
 *
 * On-disk convention: each component is a regular file named exactly
 * component.name directly under rootDir; an optional manifest.json may sit
 * next to them. Anything else in rootDir (including AppleDouble ._* files,
 * .DS_Store, __MACOSX) is a violation — stray files are how unpinned
 * artifacts sneak into an "offline" bundle.
 */
export interface CaioWorkerManifestVerification {
  releasable: boolean;
  blockers: Array<{
    code:
      | "manifest_invalid"
      | "component_missing"
      | "component_not_regular_file"
      | "component_hash_mismatch"
      | "component_size_mismatch"
      | "component_license_missing"
      | "unexpected_file_in_bundle";
    componentName?: string;
    detail: string;
  }>;
}

const MANIFEST_FILE_NAME = "manifest.json";

export async function verifyWorkerManifestAgainstFiles(input: {
  manifest: CaioMultimodalWorkerManifest;
  rootDir: string;
}): Promise<CaioWorkerManifestVerification> {
  const blockers: CaioWorkerManifestVerification["blockers"] = [];

  const parsed = caioMultimodalWorkerManifestSchema.safeParse(input.manifest);
  if (!parsed.success) {
    return {
      releasable: false,
      blockers: [
        {
          code: "manifest_invalid",
          detail: parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("; "),
        },
      ],
    };
  }
  const manifest = parsed.data;
  const rootDir = path.resolve(input.rootDir);

  // License coverage: every wheel/binary/model must reference a license
  // component that itself ships in the bundle.
  const licenseNames = new Set(
    manifest.components
      .filter((component) => component.kind === "license")
      .map((component) => component.name),
  );
  for (const component of manifest.components) {
    if (component.kind === "license") {
      continue;
    }
    if (!licenseNames.has(component.licenseKey)) {
      blockers.push({
        code: "component_license_missing",
        componentName: component.name,
        detail: `licenseKey "${component.licenseKey}" has no matching license component`,
      });
    }
  }

  // Per-component file verification.
  for (const component of manifest.components) {
    const filePath = path.join(rootDir, component.name);
    let stat;
    try {
      stat = await fs.lstat(filePath);
    } catch {
      blockers.push({
        code: "component_missing",
        componentName: component.name,
        detail: `expected file ${component.name} is absent from the bundle`,
      });
      continue;
    }
    if (stat.isSymbolicLink() || !stat.isFile()) {
      blockers.push({
        code: "component_not_regular_file",
        componentName: component.name,
        detail: `${component.name} must be a regular non-symlink file`,
      });
      continue;
    }
    if (stat.size !== component.sizeBytes) {
      blockers.push({
        code: "component_size_mismatch",
        componentName: component.name,
        detail: `declared ${component.sizeBytes} bytes, found ${stat.size}`,
      });
    }
    const digest = createHash("sha256")
      .update(await fs.readFile(filePath))
      .digest("hex");
    if (digest !== component.sha256) {
      blockers.push({
        code: "component_hash_mismatch",
        componentName: component.name,
        detail: `sha256 mismatch: release blocked (阻止发布，不现场改用最新版)`,
      });
    }
  }

  // No extra files beyond the manifest + declared components.
  const declaredNames = new Set(
    manifest.components.map((component) => component.name),
  );
  let actualNames: string[] = [];
  try {
    actualNames = await fs.readdir(rootDir);
  } catch {
    blockers.push({
      code: "component_missing",
      detail: `bundle root ${rootDir} is not readable`,
    });
  }
  for (const name of actualNames) {
    if (name === MANIFEST_FILE_NAME || declaredNames.has(name)) {
      continue;
    }
    blockers.push({
      code: "unexpected_file_in_bundle",
      detail: `undeclared file "${name}" in bundle root`,
    });
  }

  return { releasable: blockers.length === 0, blockers };
}
