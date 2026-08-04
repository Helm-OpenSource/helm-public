import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { verifyWorkerManifestAgainstFiles } from "@/lib/caio-multimodal-worker/manifest-verification";
import {
  CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION,
  type CaioMultimodalComponent,
  type CaioMultimodalWorkerManifest,
} from "@/lib/caio-multimodal-worker/worker-manifest-contracts";

function sha256Hex(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

describe("worker manifest verification", () => {
  let rootDir = "";

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "caio-worker-bundle-"));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  async function writeComponent(
    name: string,
    kind: CaioMultimodalComponent["kind"],
    licenseKey: string,
    content: Buffer,
  ): Promise<CaioMultimodalComponent> {
    await fs.writeFile(path.join(rootDir, name), content);
    return {
      name,
      version: "1.0.0-pinned",
      platform: "darwin-arm64",
      kind,
      sha256: sha256Hex(content),
      sizeBytes: content.length,
      licenseKey,
      sourceNote: "test fixture pinned artifact",
    };
  }

  async function buildValidBundle(): Promise<CaioMultimodalWorkerManifest> {
    const components = [
      await writeComponent(
        "whisper.cpp",
        "binary",
        "whisper-license",
        Buffer.from("pinned whisper.cpp binary bytes"),
      ),
      await writeComponent(
        "whisper-model-bilingual.bin",
        "model",
        "whisper-license",
        Buffer.from("pinned bilingual model bytes"),
      ),
      await writeComponent(
        "whisper-license",
        "license",
        "whisper-license",
        Buffer.from("MIT license text"),
      ),
    ];
    const manifest: CaioMultimodalWorkerManifest = {
      schemaVersion: CAIO_MULTIMODAL_WORKER_MANIFEST_SCHEMA_VERSION,
      workerKind: "asr",
      components,
      runtimeDownloadAllowed: false,
      cloudFallbackAllowed: false,
      vlmIncluded: false,
      semanticClaimsLimited: true,
    };
    await fs.writeFile(
      path.join(rootDir, "manifest.json"),
      JSON.stringify(manifest),
    );
    return manifest;
  }

  it("accepts a complete, hash-matching, licensed bundle", async () => {
    const manifest = await buildValidBundle();
    const verification = await verifyWorkerManifestAgainstFiles({
      manifest,
      rootDir,
    });
    expect(verification).toEqual({ releasable: true, blockers: [] });
  });

  it("one bad hash blocks the release — never swap in a newer version on site", async () => {
    const manifest = await buildValidBundle();
    await fs.writeFile(
      path.join(rootDir, "whisper.cpp"),
      // Same size, different bytes — a "helpfully" replaced local build.
      Buffer.from("tampered whisper.cpp binary byte"),
    );
    const verification = await verifyWorkerManifestAgainstFiles({
      manifest,
      rootDir,
    });
    expect(verification.releasable).toBe(false);
    const hashBlocker = verification.blockers.find(
      (blocker) => blocker.code === "component_hash_mismatch",
    );
    expect(hashBlocker?.componentName).toBe("whisper.cpp");
    expect(hashBlocker?.detail).toContain("阻止发布");
  });

  it("blocks when a component file is missing or is a symlink", async () => {
    const manifest = await buildValidBundle();
    await fs.rm(path.join(rootDir, "whisper-model-bilingual.bin"));
    const missing = await verifyWorkerManifestAgainstFiles({
      manifest,
      rootDir,
    });
    expect(missing.releasable).toBe(false);
    expect(missing.blockers.map((blocker) => blocker.code)).toContain(
      "component_missing",
    );

    await fs.symlink(
      path.join(rootDir, "whisper.cpp"),
      path.join(rootDir, "whisper-model-bilingual.bin"),
    );
    const symlinked = await verifyWorkerManifestAgainstFiles({
      manifest,
      rootDir,
    });
    expect(symlinked.releasable).toBe(false);
    expect(symlinked.blockers.map((blocker) => blocker.code)).toContain(
      "component_not_regular_file",
    );
  });

  it("blocks stray files: AppleDouble ._*, .DS_Store and __MACOSX are violations", async () => {
    const manifest = await buildValidBundle();
    await fs.writeFile(path.join(rootDir, "._whisper.cpp"), "apple double");
    await fs.writeFile(path.join(rootDir, ".DS_Store"), "finder junk");
    await fs.mkdir(path.join(rootDir, "__MACOSX"));
    const verification = await verifyWorkerManifestAgainstFiles({
      manifest,
      rootDir,
    });
    expect(verification.releasable).toBe(false);
    const strays = verification.blockers
      .filter((blocker) => blocker.code === "unexpected_file_in_bundle")
      .map((blocker) => blocker.detail);
    expect(strays.some((detail) => detail.includes("._whisper.cpp"))).toBe(true);
    expect(strays.some((detail) => detail.includes(".DS_Store"))).toBe(true);
    expect(strays.some((detail) => detail.includes("__MACOSX"))).toBe(true);
  });

  it("blocks a wheel/binary/model without a shipped license component", async () => {
    const manifest = await buildValidBundle();
    const withoutLicense: CaioMultimodalWorkerManifest = {
      ...manifest,
      components: manifest.components.filter(
        (component) => component.kind !== "license",
      ),
    };
    // The license file is now undeclared AND the licenseKey dangles.
    const verification = await verifyWorkerManifestAgainstFiles({
      manifest: withoutLicense,
      rootDir,
    });
    expect(verification.releasable).toBe(false);
    expect(verification.blockers.map((blocker) => blocker.code)).toContain(
      "component_license_missing",
    );
  });

  it("fails closed on a manifest that does not parse", async () => {
    const manifest = await buildValidBundle();
    const verification = await verifyWorkerManifestAgainstFiles({
      manifest: {
        ...manifest,
        runtimeDownloadAllowed: true,
      } as unknown as CaioMultimodalWorkerManifest,
      rootDir,
    });
    expect(verification.releasable).toBe(false);
    expect(verification.blockers[0]?.code).toBe("manifest_invalid");
  });

  it("blocks a size mismatch even when the declared hash matches the file", async () => {
    const manifest = await buildValidBundle();
    const tampered: CaioMultimodalWorkerManifest = {
      ...manifest,
      components: manifest.components.map((component) =>
        component.name === "whisper.cpp"
          ? { ...component, sizeBytes: component.sizeBytes + 1 }
          : component,
      ),
    };
    const verification = await verifyWorkerManifestAgainstFiles({
      manifest: tampered,
      rootDir,
    });
    expect(verification.releasable).toBe(false);
    expect(verification.blockers.map((blocker) => blocker.code)).toContain(
      "component_size_mismatch",
    );
  });
});
