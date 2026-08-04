/**
 * caio-admin preflight — one command that checks the whole Studio host
 * contract before install/activation. Pure over injected ports; findings are
 * redacted and never include DATABASE_URL, certificate bodies, or secrets.
 */

import {
  type CaioAdminFinding,
  type CaioAdminResult,
  type FileInspectorPort,
  type PackageVerifierPort,
  failedResult,
  okResult,
} from "@/tools/caio-admin/contracts";

export const DEFAULT_SERVICE_ACCOUNT = "helmcaio";
export const DEFAULT_MIN_FREE_DISK_BYTES = 10 * 1024 * 1024 * 1024; // 10 GiB
export const RELEASES_ROOT_MODE = 0o755;
export const RUNTIME_ROOT_MODE = 0o700;

export interface ServiceAccountInfo {
  exists: boolean;
  uid?: number;
  isAdmin?: boolean;
  hasSudo?: boolean;
}

export interface CertificateInfo {
  /** ISO-8601 expiry; the inspector must never surface certificate bodies. */
  notAfter: string;
  subjectRef: string;
}

export interface PreflightPorts {
  packageVerifier: PackageVerifierPort;
  machine: {
    arch(): string;
    platform(): string;
    osVersion(): Promise<string>;
  };
  serviceAccount: {
    lookup(name: string): Promise<ServiceAccountInfo>;
  };
  files: FileInspectorPort;
  certificates: {
    /** Inspect an on-disk certificate reference; null when unreadable. */
    inspect(path: string): Promise<CertificateInfo | null>;
  };
  mysql: {
    /**
     * Identity/listen probe. The adapter connects using operator-held
     * credentials; only the listen address ever crosses this port —
     * DATABASE_URL never appears in findings.
     */
    describeListen(): Promise<{ reachable: boolean; listenAddress: string }>;
  };
  network: {
    isPortFree(port: number): Promise<boolean>;
  };
  disk: {
    freeBytes(path: string): Promise<number>;
  };
  operator: {
    /**
     * Probe of the controlled `sudo -u helmcaio` channel for the operator
     * account (the only sanctioned escalation path). Adapters implement this
     * with a harmless probe command; tests inject the outcome.
     */
    canRunAsServiceAccount(): Promise<boolean>;
  };
  now?: () => number;
}

export interface PreflightOptions {
  packagePath: string;
  releasesRoot: string;
  runtimeRoot: string;
  certificatePaths: readonly string[];
  requiredPorts: readonly number[];
  serviceAccountName?: string;
  minFreeDiskBytes?: number;
}

function finding(
  checkKey: string,
  status: CaioAdminFinding["status"],
  detail: string,
): CaioAdminFinding {
  return { checkKey, status, detail };
}

export async function caioAdminPreflight(
  options: PreflightOptions,
  ports: PreflightPorts,
): Promise<CaioAdminResult> {
  const findings: CaioAdminFinding[] = [];
  const accountName = options.serviceAccountName ?? DEFAULT_SERVICE_ACCOUNT;
  const minFree = options.minFreeDiskBytes ?? DEFAULT_MIN_FREE_DISK_BYTES;
  const now = ports.now ? ports.now() : Date.now();

  // 1. Package digest/manifest.
  const verification = await ports.packageVerifier.verify(options.packagePath);
  findings.push(
    verification.ok
      ? finding(
          "package_manifest",
          "ok",
          `manifest verified (sha256 ${verification.manifestSha256.slice(0, 12)}..., ${verification.entryCount} entries)`,
        )
      : finding("package_manifest", "fail", `verification failed: ${verification.reason}`),
  );

  // 2. Machine.
  const arch = ports.machine.arch();
  const platform = ports.machine.platform();
  findings.push(
    platform === "darwin" && arch === "arm64"
      ? finding("machine_arch", "ok", "darwin-arm64")
      : finding("machine_arch", "fail", `expected darwin-arm64, got ${platform}-${arch}`),
  );
  const osVersion = await ports.machine.osVersion();
  findings.push(
    /^\d+/.test(osVersion)
      ? finding("machine_os", "ok", `os version ${osVersion}`)
      : finding("machine_os", "warn", "os version unavailable"),
  );

  // 3. Service account: must exist, must NOT be admin, must have NO sudo.
  const account = await ports.serviceAccount.lookup(accountName);
  if (!account.exists) {
    findings.push(finding("service_account_exists", "fail", `${accountName} not found`));
  } else {
    findings.push(finding("service_account_exists", "ok", `${accountName} present`));
    findings.push(
      account.isAdmin
        ? finding("service_account_not_admin", "fail", `${accountName} is in the admin group`)
        : finding("service_account_not_admin", "ok", `${accountName} is not admin`),
    );
    findings.push(
      account.hasSudo
        ? finding("service_account_no_sudo", "fail", `${accountName} has sudo rights`)
        : finding("service_account_no_sudo", "ok", `${accountName} has no sudo`),
    );
  }

  // 4. Run directories: owner + mode contract.
  const dirChecks: Array<{ key: string; path: string; mode: number }> = [
    { key: "releases_root", path: options.releasesRoot, mode: RELEASES_ROOT_MODE },
    { key: "runtime_root", path: options.runtimeRoot, mode: RUNTIME_ROOT_MODE },
  ];
  for (const check of dirChecks) {
    const info = await ports.files.inspect(check.path);
    if (!info || info.kind !== "dir") {
      findings.push(finding(check.key, "fail", "directory missing"));
      continue;
    }
    const problems: string[] = [];
    if ((info.mode & 0o777) !== check.mode) {
      problems.push(
        `mode ${(info.mode & 0o777).toString(8)} != ${check.mode.toString(8)}`,
      );
    }
    if (account.exists && account.uid !== undefined && info.uid !== account.uid) {
      problems.push(`owner uid ${info.uid} != ${accountName}`);
    }
    findings.push(
      problems.length === 0
        ? finding(check.key, "ok", `directory present, ${check.mode.toString(8)} ${accountName}-owned`)
        : finding(check.key, "fail", problems.join("; ")),
    );
  }

  // 5. Certificate references: present, 0600, not expired. Never print bodies.
  for (let i = 0; i < options.certificatePaths.length; i++) {
    const certPath = options.certificatePaths[i];
    const key = `certificate_${i}`;
    const info = await ports.files.inspect(certPath);
    if (!info || info.kind !== "file") {
      findings.push(finding(key, "fail", "certificate file missing"));
      continue;
    }
    if ((info.mode & 0o777) !== 0o600) {
      findings.push(
        finding(key, "fail", `certificate file mode ${(info.mode & 0o777).toString(8)} != 600`),
      );
      continue;
    }
    const cert = await ports.certificates.inspect(certPath);
    if (!cert) {
      findings.push(finding(key, "fail", "certificate unreadable"));
      continue;
    }
    const msLeft = Date.parse(cert.notAfter) - now;
    findings.push(
      msLeft > 0
        ? finding(key, "ok", `valid, expires in ${Math.floor(msLeft / 86_400_000)}d`)
        : finding(key, "fail", "certificate expired"),
    );
  }

  // 6. MySQL identity/listen: loopback only.
  const mysql = await ports.mysql.describeListen();
  if (!mysql.reachable) {
    findings.push(finding("mysql_listen", "fail", "mysql not reachable via operator probe"));
  } else if (mysql.listenAddress !== "127.0.0.1") {
    findings.push(
      finding("mysql_listen", "fail", `mysql listens on ${mysql.listenAddress}, expected 127.0.0.1`),
    );
  } else {
    findings.push(finding("mysql_listen", "ok", "mysql bound to 127.0.0.1"));
  }

  // 7. Port availability.
  for (const port of options.requiredPorts) {
    const free = await ports.network.isPortFree(port);
    findings.push(
      free
        ? finding(`port_${port}`, "ok", `port ${port} available`)
        : finding(`port_${port}`, "fail", `port ${port} already in use`),
    );
  }

  // 8. Disk space.
  const freeBytes = await ports.disk.freeBytes(options.releasesRoot);
  if (freeBytes < minFree) {
    findings.push(
      finding("disk_space", "fail", `${Math.floor(freeBytes / 1_073_741_824)} GiB free < threshold`),
    );
  } else if (freeBytes < 2 * minFree) {
    findings.push(finding("disk_space", "warn", "free space under 2x threshold"));
  } else {
    findings.push(finding("disk_space", "ok", "sufficient free space"));
  }

  // 9. Operator escalation channel (`sudo -u helmcaio`) works.
  const channelOk = await ports.operator.canRunAsServiceAccount();
  findings.push(
    channelOk
      ? finding("operator_sudo_channel", "ok", `operator can run as ${accountName}`)
      : finding("operator_sudo_channel", "fail", `operator cannot run as ${accountName}`),
  );

  const anyFail = findings.some((f) => f.status === "fail");
  const extras = {
    findings,
    detail: { checkedAt: new Date(now).toISOString() },
    privateInputPaths: [...options.certificatePaths],
  };
  return anyFail ? failedResult("preflight", extras) : okResult("preflight", extras);
}
