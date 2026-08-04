import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readActiveReleasePointer,
  setActiveRelease,
  type SetActiveReleaseInput,
} from "@/tools/caio-admin/active-release";
import { RELEASE_SEAL_FILE } from "@/tools/caio-admin/install";

const MANIFEST_SHA = "e".repeat(64);

async function makeSealedRelease(dir: string, sha: string = MANIFEST_SHA): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, RELEASE_SEAL_FILE),
    JSON.stringify({
      manifestSha256: sha,
      sealedAt: "2026-07-29T00:00:00Z",
      entryCount: 1,
      treeSha256: "f".repeat(64),
    }),
  );
  await fs.chmod(dir, 0o555); // sealed releases are read-only
}

async function makeTreeWritable(root: string): Promise<void> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  await fs.chmod(root, 0o700).catch(() => {});
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue; // chmod would follow the link
    const p = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await makeTreeWritable(p);
    } else {
      await fs.chmod(p, 0o600).catch(() => {});
    }
  }
}

describe("active-release pointer contract", () => {
  let sandbox: string;
  let releasesRoot: string;
  let pointerPath: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-admin-active-"));
    releasesRoot = path.join(sandbox, "releases");
    pointerPath = path.join(sandbox, "state", "active-release");
    await fs.mkdir(releasesRoot, { recursive: true });
  });

  afterEach(async () => {
    await makeTreeWritable(sandbox);
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  function input(targetDir: string, overrides: Partial<SetActiveReleaseInput> = {}): SetActiveReleaseInput {
    return {
      pointerPath,
      releasesRoot,
      targetDir,
      ports: {
        sealVerifier: { verifySeal: async () => true },
        digests: { isKnownDigest: async (sha) => sha === MANIFEST_SHA },
      },
      ...overrides,
    };
  }

  it("writes an absolute-path plain-text pointer, 0600, atomically", async () => {
    const releaseDir = path.join(releasesRoot, "caio-core-eeeeeeeeeeee");
    await makeSealedRelease(releaseDir);

    const result = await setActiveRelease(input(releaseDir));
    expect(result.status).toBe("ok");

    const raw = await fs.readFile(pointerPath, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    expect(path.isAbsolute(raw.trim())).toBe(true);
    expect((await fs.stat(pointerPath)).mode & 0o777).toBe(0o600);
    await expect(readActiveReleasePointer(pointerPath)).resolves.toBe(path.resolve(releaseDir));

    // No leftover temp files from the atomic rename.
    const stateEntries = await fs.readdir(path.dirname(pointerPath));
    expect(stateEntries).toEqual(["active-release"]);
  });

  it("is idempotent: re-pointing at the same release keeps the same terminal state", async () => {
    const releaseDir = path.join(releasesRoot, "caio-core-eeeeeeeeeeee");
    await makeSealedRelease(releaseDir);
    await setActiveRelease(input(releaseDir));
    const before = await fs.readFile(pointerPath, "utf8");
    const second = await setActiveRelease(input(releaseDir));
    expect(second.status).toBe("ok");
    await expect(fs.readFile(pointerPath, "utf8")).resolves.toBe(before);
  });

  it("refuses a target outside releasesRoot (path escape)", async () => {
    const outside = path.join(sandbox, "elsewhere");
    await makeSealedRelease(outside);
    const result = await setActiveRelease(input(path.join(releasesRoot, "..", "elsewhere")));
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:release_outside_root");
    await expect(fs.readFile(pointerPath, "utf8")).rejects.toThrow();
  });

  it("refuses a symlink attack anywhere below releasesRoot", async () => {
    const outside = path.join(sandbox, "outside-release");
    await makeSealedRelease(outside);
    const link = path.join(releasesRoot, "caio-core-symlinked");
    await fs.symlink(outside, link);

    const result = await setActiveRelease(input(link));
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:symlink_in_release_path");

    // Nested variant: symlinked intermediate directory.
    const nestedRoot = path.join(releasesRoot, "nest");
    await fs.mkdir(nestedRoot, { recursive: true });
    const midLink = path.join(nestedRoot, "mid");
    await fs.symlink(sandbox, midLink);
    const nested = await setActiveRelease(input(path.join(midLink, "outside-release")));
    expect(nested.status).toBe("blocked");
    expect(nested.blockedReason).toBe("blocked:symlink_in_release_path");
  });

  it("refuses an unsealed target", async () => {
    const releaseDir = path.join(releasesRoot, "caio-core-unsealed");
    await fs.mkdir(releaseDir, { recursive: true });
    await fs.chmod(releaseDir, 0o555);
    const result = await setActiveRelease(input(releaseDir));
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:unsealed_release");
  });

  it("refuses when the seal fails verification", async () => {
    const releaseDir = path.join(releasesRoot, "caio-core-badseal");
    await makeSealedRelease(releaseDir);
    const result = await setActiveRelease(
      input(releaseDir, {
        ports: {
          sealVerifier: { verifySeal: async () => false },
          digests: { isKnownDigest: async () => true },
        },
      }),
    );
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:seal_verification_failed");
  });

  it("refuses a writable release", async () => {
    const releaseDir = path.join(releasesRoot, "caio-core-writable");
    await makeSealedRelease(releaseDir);
    await fs.chmod(releaseDir, 0o755); // writable again
    const result = await setActiveRelease(input(releaseDir));
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:writable_release");
  });

  it("refuses an unknown digest", async () => {
    const releaseDir = path.join(releasesRoot, "caio-core-unknown");
    await makeSealedRelease(releaseDir);
    const result = await setActiveRelease(
      input(releaseDir, {
        ports: {
          sealVerifier: { verifySeal: async () => true },
          digests: { isKnownDigest: async () => false },
        },
      }),
    );
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:unknown_digest");
  });
});
