import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readActiveReleasePointer } from "@/tools/caio-admin/active-release";
import { type PackageVerifierPort } from "@/tools/caio-admin/contracts";
import {
  caioAdminUpgrade,
  caioAdminUpgradeCheck,
  isSchemaCompatible,
  type UpgradeCheckPorts,
  type UpgradePorts,
} from "@/tools/caio-admin/upgrade";

const MANIFEST_SHA = "9".repeat(64);
const HELMCAIO_UID = 550;

function verifier(compatibleWith: string[]): PackageVerifierPort {
  return {
    async verify() {
      return {
        ok: true,
        packageKey: "caio-core",
        manifestSha256: MANIFEST_SHA,
        entryCount: 2,
        treeSha256: "8".repeat(64),
        compat: {
          appVersion: "2.1.0",
          configSchemaVersion: "3",
          dataSchemaCompatibleWith: compatibleWith,
        },
      };
    },
  };
}

async function snapshotTree(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(`${path.relative(root, p)}/`);
        await walk(p);
      } else {
        const body = await fs.readFile(p, "utf8").catch(() => "<unreadable>");
        out.push(`${path.relative(root, p)}:${body.length}`);
      }
    }
  }
  await walk(root);
  return out.sort();
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

describe("caioAdminUpgradeCheck", () => {
  let sandbox: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-admin-upcheck-"));
    await fs.mkdir(path.join(sandbox, "releases"), { recursive: true });
    await fs.writeFile(path.join(sandbox, "releases", "existing.txt"), "existing\n");
  });

  afterEach(async () => {
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  function checkPorts(overrides: Partial<UpgradeCheckPorts> = {}): UpgradeCheckPorts {
    return {
      verifier: verifier(["2.0.0"]),
      current: async () => ({ appVersion: "2.0.0", configSchemaVersion: "3" }),
      disk: { freeBytes: async () => 100 * 1024 * 1024 * 1024 },
      backupDir: { isWritable: async () => true },
      certificates: { daysUntilExpiry: async () => 120 },
      externalDeps: { check: async () => [] },
      ...overrides,
    };
  }

  it("passes read-only checks and changes no filesystem state", async () => {
    const before = await snapshotTree(sandbox);
    const result = await caioAdminUpgradeCheck({
      packagePath: "/pkg.tgz",
      releasesRoot: path.join(sandbox, "releases"),
      backupDir: path.join(sandbox, "backups"),
      certificatePaths: [path.join(sandbox, "cert.pem")],
      ports: checkPorts(),
    });
    expect(result.status).toBe("ok");
    expect(result.detail.readOnly).toBe(true);
    await expect(snapshotTree(sandbox)).resolves.toEqual(before);
  });

  it("reports incompatible schema, low disk, unwritable backup dir and expired certs as failures — still read-only", async () => {
    const before = await snapshotTree(sandbox);
    const result = await caioAdminUpgradeCheck({
      packagePath: "/pkg.tgz",
      releasesRoot: path.join(sandbox, "releases"),
      backupDir: path.join(sandbox, "backups"),
      certificatePaths: [path.join(sandbox, "cert.pem")],
      ports: checkPorts({
        verifier: verifier(["1.0.0"]),
        disk: { freeBytes: async () => 0 },
        backupDir: { isWritable: async () => false },
        certificates: { daysUntilExpiry: async () => null },
      }),
    });
    expect(result.status).toBe("failed");
    const byKey = new Map(result.findings.map((f) => [f.checkKey, f.status]));
    expect(byKey.get("schema_compatibility")).toBe("fail");
    expect(byKey.get("disk_space")).toBe("fail");
    expect(byKey.get("backup_capability")).toBe("fail");
    expect(byKey.get("certificate_0")).toBe("fail");
    await expect(snapshotTree(sandbox)).resolves.toEqual(before);
  });

  it("exposes the compatibility predicate", () => {
    expect(
      isSchemaCompatible(
        { appVersion: "2.1.0", configSchemaVersion: "3", dataSchemaCompatibleWith: ["2.0.0"] },
        { appVersion: "2.0.0", configSchemaVersion: "3" },
      ),
    ).toBe(true);
  });
});

describe("caioAdminUpgrade", () => {
  let sandbox: string;
  let releasesRoot: string;
  let pointerPath: string;

  beforeEach(async () => {
    sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "caio-admin-upgrade-"));
    releasesRoot = path.join(sandbox, "releases");
    pointerPath = path.join(sandbox, "state", "active-release");
    await fs.mkdir(releasesRoot, { recursive: true });
  });

  afterEach(async () => {
    await makeTreeWritable(sandbox);
    await fs.rm(sandbox, { recursive: true, force: true });
  });

  function upgradePorts(overrides: Partial<UpgradePorts> = {}): UpgradePorts {
    return {
      verifier: verifier(["2.0.0"]),
      extractor: {
        async extract(_pkg, destDir) {
          await fs.writeFile(path.join(destDir, "app.js"), "// app\n");
        },
      },
      runner: {
        run: async () => ({ ok: true, exitCode: 0, stdoutTail: "", stderrTail: "" }),
      },
      sealer: {
        async chmodTreeReadOnly(dir) {
          await fs.chmod(dir, 0o555);
        },
      },
      current: async () => ({ appVersion: "2.0.0", configSchemaVersion: "3" }),
      backup: {
        createEncryptedBackup: async () => ({ ok: true, receiptRef: "backup-receipt-1" }),
      },
      migrations: { run: async () => ({ ok: true, applied: ["001_add_table"] }) },
      smoke: { run: async () => ({ ok: true, detail: "smoke passed" }) },
      sealVerifier: { verifySeal: async () => true },
      digests: { isKnownDigest: async (sha) => sha === MANIFEST_SHA },
      service: {
        restart: async () => {},
        health: async () => ({
          uid: HELMCAIO_UID,
          listenAddress: "127.0.0.1",
          flags: ["--service"],
        }),
      },
      expected: { serviceUid: HELMCAIO_UID, listenAddress: "127.0.0.1", flags: ["--service"] },
      ...overrides,
    };
  }

  it("runs backup -> install -> migrations -> smoke -> switch -> health and records the backup receipt", async () => {
    const result = await caioAdminUpgrade({
      packagePath: "/pkg.tgz",
      releasesRoot,
      pointerPath,
      ports: upgradePorts(),
    });
    expect(result.status).toBe("ok");
    expect(result.receipts.map((r) => r.receiptKey)).toContain("backup");
    expect(result.receipts.find((r) => r.receiptKey === "backup")?.ref).toBe("backup-receipt-1");

    const active = await readActiveReleasePointer(pointerPath);
    expect(active).toBe(result.detail.releaseDir);
    const byKey = new Map(result.findings.map((f) => [f.checkKey, f.status]));
    expect(byKey.get("migrations")).toBe("ok");
    expect(byKey.get("smoke")).toBe("ok");
    expect(byKey.get("active_release_switch")).toBe("ok");
    expect(byKey.get("service_health")).toBe("ok");
  });

  it("is idempotent: a re-run converges on the same terminal state", async () => {
    const inputArgs = {
      packagePath: "/pkg.tgz",
      releasesRoot,
      pointerPath,
      ports: upgradePorts(),
    };
    const first = await caioAdminUpgrade(inputArgs);
    expect(first.status).toBe("ok");
    const pointerBefore = await fs.readFile(pointerPath, "utf8");

    const second = await caioAdminUpgrade({ ...inputArgs, ports: upgradePorts() });
    expect(second.status).toBe("ok");
    await expect(fs.readFile(pointerPath, "utf8")).resolves.toBe(pointerBefore);
  });

  it("blocks with backup_failed before any state changes", async () => {
    const before = await snapshotTree(sandbox);
    const result = await caioAdminUpgrade({
      packagePath: "/pkg.tgz",
      releasesRoot,
      pointerPath,
      ports: upgradePorts({
        backup: { createEncryptedBackup: async () => ({ ok: false, reason: "disk full" }) },
      }),
    });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:backup_failed");
    await expect(snapshotTree(sandbox)).resolves.toEqual(before);
    await expect(fs.readFile(pointerPath, "utf8")).rejects.toThrow();
  });

  it("refuses an incompatible manifest on the normal path without promising rollback", async () => {
    const before = await snapshotTree(sandbox);
    const result = await caioAdminUpgrade({
      packagePath: "/pkg.tgz",
      releasesRoot,
      pointerPath,
      ports: upgradePorts({ verifier: verifier(["1.0.0"]) }),
    });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:maintenance_upgrade_required");
    expect(result.findings[0].detail).toContain("no automatic rollback");
    await expect(snapshotTree(sandbox)).resolves.toEqual(before);
  });

  it("proceeds on an incompatible manifest only with the explicit maintenanceUpgrade flag", async () => {
    const result = await caioAdminUpgrade({
      packagePath: "/pkg.tgz",
      releasesRoot,
      pointerPath,
      maintenanceUpgrade: true,
      ports: upgradePorts({ verifier: verifier(["1.0.0"]) }),
    });
    expect(result.status).toBe("ok");
    expect(
      result.findings.find((f) => f.checkKey === "schema_compatibility")?.status,
    ).toBe("warn");
  });

  it("fails on health mismatch (wrong uid / listen address / flags)", async () => {
    const result = await caioAdminUpgrade({
      packagePath: "/pkg.tgz",
      releasesRoot,
      pointerPath,
      ports: upgradePorts({
        service: {
          restart: async () => {},
          health: async () => ({ uid: 0, listenAddress: "0.0.0.0", flags: [] }),
        },
      }),
    });
    expect(result.status).toBe("failed");
    const health = result.findings.find((f) => f.checkKey === "service_health");
    expect(health?.status).toBe("fail");
    expect(health?.detail).toContain("uid");
    expect(health?.detail).toContain("0.0.0.0");
  });
});
