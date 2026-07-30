import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type CommandRunStep,
  type PackageVerifierPort,
} from "@/tools/caio-admin/contracts";
import {
  INSTALLED_STATE,
  INSTALL_CONTRACT_STEPS,
  RELEASE_SEAL_FILE,
  caioAdminInstall,
  readReleaseSeal,
  releaseDirName,
  type InstallPorts,
} from "@/tools/caio-admin/install";

const MANIFEST_SHA = "a".repeat(64);

/** Verifier that reports attacker-chosen package-supplied strings. */
function keyVerifier(
  packageKey: string,
  manifestSha256: string = MANIFEST_SHA,
): PackageVerifierPort {
  return {
    async verify() {
      return {
        ok: true,
        packageKey,
        manifestSha256,
        entryCount: 3,
        treeSha256: "b".repeat(64),
      };
    },
  };
}

function goodVerifier(): PackageVerifierPort {
  return keyVerifier("caio-core");
}

function makePorts(overrides: Partial<InstallPorts> = {}): {
  ports: InstallPorts;
  ranSteps: string[];
  sealedDirs: string[];
} {
  const ranSteps: string[] = [];
  const sealedDirs: string[] = [];
  const ports: InstallPorts = {
    verifier: goodVerifier(),
    extractor: {
      async extract(_packagePath, destDir) {
        await fs.writeFile(path.join(destDir, "app.js"), "// app\n");
      },
    },
    runner: {
      async run(step: CommandRunStep) {
        ranSteps.push(step.key);
        return { ok: true, exitCode: 0, stdoutTail: "", stderrTail: "" };
      },
    },
    sealer: {
      async chmodTreeReadOnly(dir) {
        sealedDirs.push(dir);
      },
    },
    now: () => 1_700_000_000_000,
    ...overrides,
  };
  return { ports, ranSteps, sealedDirs };
}

describe("caioAdminInstall", () => {
  let sandbox: string;
  let releasesRoot: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-admin-install-"));
    releasesRoot = path.join(sandbox, "releases");
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  it("blocks on package digest mismatch before touching the filesystem", async () => {
    const { ports } = makePorts({
      verifier: {
        async verify() {
          return { ok: false, reason: "digest mismatch" };
        },
      },
    });
    const result = await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:package_digest_mismatch");
    expect(result.exitCode).toBe(3);
    await expect(fs.readdir(releasesRoot)).rejects.toThrow();
  });

  it("installs into a new immutable release dir, runs contract steps, and seals", async () => {
    const { ports, ranSteps, sealedDirs } = makePorts();
    const result = await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports });
    expect(result.status).toBe("ok");
    expect(result.detail.state).toBe(INSTALLED_STATE);

    const dirName = releaseDirName("caio-core", MANIFEST_SHA);
    const releaseDir = path.join(releasesRoot, dirName);
    expect(result.detail.releaseDir).toBe(releaseDir);
    expect(ranSteps).toEqual(INSTALL_CONTRACT_STEPS.map((s) => s.key));
    expect(sealedDirs).toHaveLength(1);

    const seal = await readReleaseSeal(releaseDir);
    expect(seal?.manifestSha256).toBe(MANIFEST_SHA);
    expect(seal?.entryCount).toBe(3);
    expect(seal?.treeSha256).toBe("b".repeat(64));
    await expect(fs.readFile(path.join(releaseDir, "app.js"), "utf8")).resolves.toContain("app");
  });

  it("is idempotent: re-running reports already_installed with the same terminal state", async () => {
    const { ports } = makePorts();
    const first = await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports });
    expect(first.status).toBe("ok");
    const before = await fs.readdir(releasesRoot);

    const { ports: ports2, ranSteps: ranSteps2 } = makePorts();
    const second = await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports: ports2 });
    expect(second.status).toBe("ok");
    expect(second.detail.alreadyInstalled).toBe(true);
    expect(ranSteps2).toEqual([]);
    await expect(fs.readdir(releasesRoot)).resolves.toEqual(before);
  });

  it("refuses to overwrite an existing dir with different content under the same name", async () => {
    const dirName = releaseDirName("caio-core", MANIFEST_SHA);
    const conflictDir = path.join(releasesRoot, dirName);
    await fs.mkdir(conflictDir, { recursive: true });
    await fs.writeFile(path.join(conflictDir, RELEASE_SEAL_FILE), "not json at all");

    const { ports } = makePorts();
    const result = await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports });
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(2);
    await expect(fs.readFile(path.join(conflictDir, RELEASE_SEAL_FILE), "utf8")).resolves.toBe(
      "not json at all",
    );
  });

  it("quarantines a partial dir when a step throws and stays safe to re-run", async () => {
    let calls = 0;
    const { ports } = makePorts({
      runner: {
        async run() {
          calls += 1;
          if (calls === 2) throw new Error("runner crashed midway");
          return { ok: true, exitCode: 0, stdoutTail: "", stderrTail: "" };
        },
      },
    });
    const result = await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports });
    expect(result.status).toBe("failed");
    expect(typeof result.detail.quarantinedDir).toBe("string");
    const entries = await fs.readdir(releasesRoot);
    expect(entries.some((e) => e.includes(".partial-"))).toBe(true);
    expect(entries.some((e) => e === releaseDirName("caio-core", MANIFEST_SHA))).toBe(false);

    // Re-run with healthy ports completes the install.
    const { ports: healthy } = makePorts();
    const retry = await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports: healthy });
    expect(retry.status).toBe("ok");
    expect(retry.detail.alreadyInstalled).toBe(false);
  });

  it("marks a failing contract step as failed and quarantines the staging tree", async () => {
    const { ports } = makePorts({
      runner: {
        async run(step) {
          const ok = step.key !== "typecheck";
          return { ok, exitCode: ok ? 0 : 1, stdoutTail: "", stderrTail: "" };
        },
      },
    });
    const result = await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports });
    expect(result.status).toBe("failed");
    expect(
      result.findings.find((f) => f.checkKey === "step_typecheck")?.status,
    ).toBe("fail");
  });

  // -------------------------------------------------------------------------
  // Package-supplied strings that reach a filesystem path.
  // -------------------------------------------------------------------------

  describe("package-supplied path components", () => {
    const UNSAFE_PACKAGE_KEYS: ReadonlyArray<readonly [string, string]> = [
      ["parent traversal", "../escaped"],
      ["deep traversal", "../../../../Users/victim/Library/LaunchAgents/evil"],
      ["absolute path", "/tmp/evil"],
      ["backslash separator", "..\\escaped"],
      ["nul byte", "caio-core\u0000/etc/evil"],
      ["newline", "caio-core\n../escaped"],
      ["single dot", "."],
      ["double dot", ".."],
      ["dotted key", "caio.core"],
      ["empty", ""],
      ["percent-encoded separator", "..%2f..%2fescaped"],
      ["uppercase", "Caio-Core"],
      ["leading dash", "-caio-core"],
      ["too long", `${"a".repeat(65)}`],
    ];

    for (const [name, packageKey] of UNSAFE_PACKAGE_KEYS) {
      it(`blocks an unsafe packageKey (${name}) before creating anything`, async () => {
        const { ports, ranSteps, sealedDirs } = makePorts({
          verifier: keyVerifier(packageKey),
        });
        const result = await caioAdminInstall({
          packagePath: "/pkg.tgz",
          releasesRoot,
          ports,
        });
        expect(result.status).toBe("blocked");
        expect(result.blockedReason).toBe("blocked:package_key_invalid");
        expect(ranSteps).toEqual([]);
        expect(sealedDirs).toEqual([]);
        // Nothing was created anywhere in the sandbox — neither inside the
        // releases root (which does not even exist) nor beside it.
        await expect(fs.readdir(sandbox)).resolves.toEqual([]);
      });
    }

    it("does not create the escape target for a traversal packageKey", async () => {
      const { ports } = makePorts({ verifier: keyVerifier("../escaped") });
      await caioAdminInstall({ packagePath: "/pkg.tgz", releasesRoot, ports });
      await expect(
        fs.lstat(path.join(sandbox, `escaped-${MANIFEST_SHA.slice(0, 12)}`)),
      ).rejects.toThrow();
      await expect(fs.readdir(sandbox)).resolves.toEqual([]);
    });

    it("blocks a manifest digest that is not plain sha256 hex before composing a path", async () => {
      const { ports, ranSteps } = makePorts({
        verifier: keyVerifier("caio-core", "../../../../escaped/x"),
      });
      const result = await caioAdminInstall({
        packagePath: "/pkg.tgz",
        releasesRoot,
        ports,
      });
      expect(result.status).toBe("blocked");
      expect(result.blockedReason).toBe("blocked:manifest_digest_invalid");
      expect(ranSteps).toEqual([]);
      await expect(fs.readdir(sandbox)).resolves.toEqual([]);
    });

    it("blocks when the release path is a symlink and leaves the link target untouched", async () => {
      const outside = path.join(sandbox, "outside");
      await fs.mkdir(outside, { recursive: true });
      await fs.mkdir(releasesRoot, { recursive: true });
      const linkPath = path.join(releasesRoot, releaseDirName("caio-core", MANIFEST_SHA));
      await fs.symlink(outside, linkPath);

      const { ports, ranSteps, sealedDirs } = makePorts();
      const result = await caioAdminInstall({
        packagePath: "/pkg.tgz",
        releasesRoot,
        ports,
      });
      expect(result.status).toBe("blocked");
      expect(result.blockedReason).toBe("blocked:symlink_in_release_path");
      expect(ranSteps).toEqual([]);
      expect(sealedDirs).toEqual([]);
      // The symlink is intact and nothing was written through it.
      expect((await fs.lstat(linkPath)).isSymbolicLink()).toBe(true);
      await expect(fs.readdir(outside)).resolves.toEqual([]);
      await expect(fs.readdir(releasesRoot)).resolves.toEqual([
        releaseDirName("caio-core", MANIFEST_SHA),
      ]);
    });

    it("blocks when an ancestor of the release path below the root is a symlink", async () => {
      const outside = path.join(sandbox, "outside");
      await fs.mkdir(outside, { recursive: true });
      await fs.mkdir(releasesRoot, { recursive: true });
      // A nested release layout: the package key's first path component is a
      // symlink out of the root. The grammar forbids separators outright, so
      // this must be refused as an invalid key (defense in depth: even if the
      // grammar changed, the containment walk would refuse it).
      await fs.symlink(outside, path.join(releasesRoot, "nested"));
      const { ports } = makePorts({ verifier: keyVerifier("nested/caio-core") });
      const result = await caioAdminInstall({
        packagePath: "/pkg.tgz",
        releasesRoot,
        ports,
      });
      expect(result.status).toBe("blocked");
      expect(result.blockedReason).toBe("blocked:package_key_invalid");
      await expect(fs.readdir(outside)).resolves.toEqual([]);
    });

    it("releaseDirName refuses to compose a path component from unsafe inputs", () => {
      expect(() => releaseDirName("../escaped", MANIFEST_SHA)).toThrow();
      expect(() => releaseDirName("caio-core", "../../etc")).toThrow();
      expect(releaseDirName("caio-core", MANIFEST_SHA)).toBe(
        `caio-core-${MANIFEST_SHA.slice(0, 12)}`,
      );
    });

    it("still installs a legitimate packageKey", async () => {
      const { ports, ranSteps } = makePorts({ verifier: keyVerifier("caio-core-2") });
      const result = await caioAdminInstall({
        packagePath: "/pkg.tgz",
        releasesRoot,
        ports,
      });
      expect(result.status).toBe("ok");
      expect(result.detail.releaseDir).toBe(
        path.join(releasesRoot, `caio-core-2-${MANIFEST_SHA.slice(0, 12)}`),
      );
      expect(ranSteps).toEqual(INSTALL_CONTRACT_STEPS.map((s) => s.key));
      await expect(fs.readdir(sandbox)).resolves.toEqual(["releases"]);
    });
  });
});
