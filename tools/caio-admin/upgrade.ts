/**
 * caio-admin upgrade — read-only upgrade-check plus the guarded upgrade path:
 * encrypted backup (with receipt) → install new release → migrations →
 * isolated smoke → atomic active-release switch → restart + health verify.
 *
 * A manifest that declares itself schema-incompatible with the currently
 * running app version blocks the normal path (blocked:maintenance_upgrade_required)
 * and explicitly does NOT promise automatic rollback; the operator must pass
 * maintenanceUpgrade to take that path deliberately.
 */

import {
  type CaioAdminFinding,
  type CaioAdminReceipt,
  type CaioAdminResult,
  type PackageManifestCompat,
  blockedResult,
  failedResult,
  okResult,
} from "@/tools/caio-admin/contracts";
import {
  type InstallPorts,
  caioAdminInstall,
} from "@/tools/caio-admin/install";
import {
  type DigestRegistryPort,
  type SealVerifierPort,
  setActiveRelease,
} from "@/tools/caio-admin/active-release";

export interface CurrentDeploymentInfo {
  appVersion: string;
  configSchemaVersion: string;
}

export interface UpgradeCheckPorts {
  verifier: InstallPorts["verifier"];
  current(): Promise<CurrentDeploymentInfo>;
  disk: { freeBytes(path: string): Promise<number> };
  backupDir: {
    /** Read-only writability probe (access check), no writes performed. */
    isWritable(path: string): Promise<boolean>;
  };
  certificates: { daysUntilExpiry(path: string): Promise<number | null> };
  externalDeps: { check(): Promise<CaioAdminFinding[]> };
}

export interface UpgradeCheckInput {
  packagePath: string;
  releasesRoot: string;
  backupDir: string;
  certificatePaths: readonly string[];
  minFreeDiskBytes?: number;
  ports: UpgradeCheckPorts;
}

function compatOf(compat: PackageManifestCompat | undefined): PackageManifestCompat | null {
  if (!compat) return null;
  return compat;
}

export function isSchemaCompatible(
  compat: PackageManifestCompat,
  current: CurrentDeploymentInfo,
): boolean {
  return compat.dataSchemaCompatibleWith.includes(current.appVersion);
}

/** Read-only: verifies preconditions for an upgrade, changes no state. */
export async function caioAdminUpgradeCheck(
  input: UpgradeCheckInput,
): Promise<CaioAdminResult> {
  const { ports } = input;
  const findings: CaioAdminFinding[] = [];
  const minFree = input.minFreeDiskBytes ?? 10 * 1024 * 1024 * 1024;

  const verification = await ports.verifier.verify(input.packagePath);
  if (!verification.ok) {
    return blockedResult("upgrade-check", "package_digest_mismatch", {
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

  const compat = compatOf(verification.compat);
  const current = await ports.current();
  if (!compat) {
    findings.push({
      checkKey: "schema_compatibility",
      status: "fail",
      detail: "manifest declares no schema compatibility block",
    });
  } else if (!isSchemaCompatible(compat, current)) {
    findings.push({
      checkKey: "schema_compatibility",
      status: "fail",
      detail: `manifest is not data-schema compatible with running app ${current.appVersion}; maintenance upgrade required`,
    });
  } else {
    findings.push({
      checkKey: "schema_compatibility",
      status: "ok",
      detail: `compatible with running app ${current.appVersion} (config schema ${compat.configSchemaVersion})`,
    });
  }

  const freeBytes = await ports.disk.freeBytes(input.releasesRoot);
  findings.push(
    freeBytes >= minFree
      ? { checkKey: "disk_space", status: "ok", detail: "sufficient free space" }
      : { checkKey: "disk_space", status: "fail", detail: "insufficient free space" },
  );

  const backupWritable = await ports.backupDir.isWritable(input.backupDir);
  findings.push(
    backupWritable
      ? { checkKey: "backup_capability", status: "ok", detail: "backup directory writable" }
      : { checkKey: "backup_capability", status: "fail", detail: "backup directory not writable" },
  );

  for (let i = 0; i < input.certificatePaths.length; i++) {
    const days = await ports.certificates.daysUntilExpiry(input.certificatePaths[i]);
    findings.push(
      days !== null && days > 0
        ? { checkKey: `certificate_${i}`, status: "ok", detail: `valid for ${days}d` }
        : { checkKey: `certificate_${i}`, status: "fail", detail: "certificate missing or expired" },
    );
  }

  findings.push(...(await ports.externalDeps.check()));

  const anyFail = findings.some((f) => f.status === "fail");
  const extras = {
    findings,
    detail: { readOnly: true },
    privateInputPaths: [...input.certificatePaths],
  };
  return anyFail
    ? failedResult("upgrade-check", extras)
    : okResult("upgrade-check", extras);
}

export interface UpgradePorts extends InstallPorts {
  current(): Promise<CurrentDeploymentInfo>;
  backup: {
    /** Pre-migration encrypted backup; must yield a receipt on success. */
    createEncryptedBackup(): Promise<
      { ok: true; receiptRef: string } | { ok: false; reason: string }
    >;
  };
  migrations: {
    run(releaseDir: string): Promise<{ ok: boolean; applied: string[] }>;
  };
  smoke: {
    /** Isolated smoke run against the new release before switching. */
    run(releaseDir: string): Promise<{ ok: boolean; detail: string }>;
  };
  sealVerifier: SealVerifierPort;
  digests: DigestRegistryPort;
  service: {
    restart(): Promise<void>;
    health(): Promise<{ uid: number; listenAddress: string; flags: string[] }>;
  };
  expected: {
    serviceUid: number;
    listenAddress: string;
    flags: readonly string[];
  };
}

export interface UpgradeInput {
  packagePath: string;
  releasesRoot: string;
  pointerPath: string;
  /** Explicit opt-in for the schema-incompatible maintenance path. */
  maintenanceUpgrade?: boolean;
  ports: UpgradePorts;
}

export async function caioAdminUpgrade(input: UpgradeInput): Promise<CaioAdminResult> {
  const { ports } = input;
  const findings: CaioAdminFinding[] = [];
  const receipts: CaioAdminReceipt[] = [];

  const verification = await ports.verifier.verify(input.packagePath);
  if (!verification.ok) {
    return blockedResult("upgrade", "package_digest_mismatch", {
      findings: [
        { checkKey: "package_manifest", status: "fail", detail: verification.reason },
      ],
    });
  }

  // Compatibility gate BEFORE any state change. The normal path refuses
  // incompatible manifests and does not promise automatic rollback.
  const compat = compatOf(verification.compat);
  const current = await ports.current();
  if (!compat || !isSchemaCompatible(compat, current)) {
    if (!input.maintenanceUpgrade) {
      return blockedResult("upgrade", "maintenance_upgrade_required", {
        findings: [
          {
            checkKey: "schema_compatibility",
            status: "fail",
            detail: `manifest incompatible with running app ${current.appVersion}; re-run with the explicit maintenanceUpgrade flag (no automatic rollback is promised)`,
          },
        ],
      });
    }
    findings.push({
      checkKey: "schema_compatibility",
      status: "warn",
      detail: "maintenance upgrade explicitly requested for incompatible schema",
    });
  }

  // 1. Pre-migration encrypted backup. Failure blocks before any change.
  const backup = await ports.backup.createEncryptedBackup();
  if (!backup.ok) {
    return blockedResult("upgrade", "backup_failed", {
      findings: [
        ...findings,
        { checkKey: "backup", status: "fail", detail: backup.reason },
      ],
    });
  }
  const backupAt = new Date().toISOString();
  receipts.push({ receiptKey: "backup", ref: backup.receiptRef, recordedAt: backupAt });
  findings.push({ checkKey: "backup", status: "ok", detail: "encrypted backup completed" });

  // 2. Install the new release (reuses the immutable-release install path).
  const install = await caioAdminInstall({
    packagePath: input.packagePath,
    releasesRoot: input.releasesRoot,
    ports,
  });
  findings.push(...install.findings);
  if (install.status !== "ok") {
    return { ...install, command: "upgrade", findings, receipts };
  }
  const releaseDir = install.detail.releaseDir as string;

  // 3. Migrations.
  const migration = await ports.migrations.run(releaseDir);
  findings.push({
    checkKey: "migrations",
    status: migration.ok ? "ok" : "fail",
    detail: migration.ok
      ? `${migration.applied.length} migrations applied`
      : "migration run failed",
  });
  if (!migration.ok) {
    return failedResult("upgrade", { findings, receipts });
  }

  // 4. Isolated smoke against the new release.
  const smoke = await ports.smoke.run(releaseDir);
  findings.push({
    checkKey: "smoke",
    status: smoke.ok ? "ok" : "fail",
    detail: smoke.detail,
  });
  if (!smoke.ok) {
    return failedResult("upgrade", { findings, receipts });
  }

  // 5. Atomic active-release switch (full pointer-contract validation).
  const switchResult = await setActiveRelease({
    pointerPath: input.pointerPath,
    releasesRoot: input.releasesRoot,
    targetDir: releaseDir,
    ports: { sealVerifier: ports.sealVerifier, digests: ports.digests },
  });
  if (switchResult.status !== "ok") {
    return { ...switchResult, command: "upgrade", findings, receipts };
  }
  findings.push({ checkKey: "active_release_switch", status: "ok", detail: "pointer switched" });

  // 6. Restart + health verify: uid, listen address, actual flags.
  await ports.service.restart();
  const health = await ports.service.health();
  const problems: string[] = [];
  if (health.uid !== ports.expected.serviceUid) problems.push("unexpected service uid");
  if (health.listenAddress !== ports.expected.listenAddress) {
    problems.push(`listening on ${health.listenAddress}, expected ${ports.expected.listenAddress}`);
  }
  for (const flag of ports.expected.flags) {
    if (!health.flags.includes(flag)) problems.push(`missing flag ${flag}`);
  }
  findings.push({
    checkKey: "service_health",
    status: problems.length === 0 ? "ok" : "fail",
    detail: problems.length === 0 ? "service healthy under expected identity" : problems.join("; "),
  });
  if (problems.length > 0) {
    return failedResult("upgrade", { findings, receipts });
  }

  return okResult("upgrade", {
    findings,
    receipts,
    detail: { releaseDir, activeRelease: releaseDir },
  });
}
