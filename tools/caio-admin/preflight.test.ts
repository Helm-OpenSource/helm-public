import { describe, expect, it } from "vitest";

import { renderCaioAdminResult } from "@/tools/caio-admin/contracts";
import {
  DEFAULT_SERVICE_ACCOUNT,
  caioAdminPreflight,
  type PreflightOptions,
  type PreflightPorts,
} from "@/tools/caio-admin/preflight";

const NOW = Date.parse("2026-07-29T00:00:00Z");
const HELMCAIO_UID = 550;

function baseOptions(): PreflightOptions {
  return {
    packagePath: "/tmp/pkg.tgz",
    releasesRoot: "/opt/caio/releases",
    runtimeRoot: "/opt/caio/runtime",
    certificatePaths: ["/opt/caio/certs/gateway.pem"],
    requiredPorts: [3200],
  };
}

function healthyPorts(overrides: Partial<PreflightPorts> = {}): PreflightPorts {
  return {
    packageVerifier: {
      async verify() {
        return {
          ok: true,
          packageKey: "caio-core",
          manifestSha256: "c".repeat(64),
          entryCount: 10,
          treeSha256: "d".repeat(64),
        };
      },
    },
    machine: {
      arch: () => "arm64",
      platform: () => "darwin",
      osVersion: async () => "15.5",
    },
    serviceAccount: {
      async lookup(name) {
        expect(name).toBe(DEFAULT_SERVICE_ACCOUNT);
        return { exists: true, uid: HELMCAIO_UID, isAdmin: false, hasSudo: false };
      },
    },
    files: {
      async inspect(p) {
        if (p === "/opt/caio/releases") {
          return { kind: "dir", mode: 0o755, uid: HELMCAIO_UID, nlink: 2, size: 0 };
        }
        if (p === "/opt/caio/runtime") {
          return { kind: "dir", mode: 0o700, uid: HELMCAIO_UID, nlink: 2, size: 0 };
        }
        if (p === "/opt/caio/certs/gateway.pem") {
          return { kind: "file", mode: 0o600, uid: HELMCAIO_UID, nlink: 1, size: 100 };
        }
        return null;
      },
    },
    certificates: {
      async inspect() {
        return { notAfter: "2027-01-01T00:00:00Z", subjectRef: "caio-gateway" };
      },
    },
    mysql: {
      async describeListen() {
        return { reachable: true, listenAddress: "127.0.0.1" };
      },
    },
    network: { isPortFree: async () => true },
    disk: { freeBytes: async () => 100 * 1024 * 1024 * 1024 },
    operator: { canRunAsServiceAccount: async () => true },
    now: () => NOW,
    ...overrides,
  };
}

describe("caioAdminPreflight", () => {
  it("passes on a healthy Studio host and reports one finding per check", async () => {
    const result = await caioAdminPreflight(baseOptions(), healthyPorts());
    expect(result.status).toBe("ok");
    expect(result.exitCode).toBe(0);
    const keys = result.findings.map((f) => f.checkKey);
    for (const expected of [
      "package_manifest",
      "machine_arch",
      "machine_os",
      "service_account_exists",
      "service_account_not_admin",
      "service_account_no_sudo",
      "releases_root",
      "runtime_root",
      "certificate_0",
      "mysql_listen",
      "port_3200",
      "disk_space",
      "operator_sudo_channel",
    ]) {
      expect(keys).toContain(expected);
    }
    expect(result.findings.every((f) => f.status === "ok")).toBe(true);
  });

  it("fails when the service account is admin or has sudo", async () => {
    const result = await caioAdminPreflight(
      baseOptions(),
      healthyPorts({
        serviceAccount: {
          async lookup() {
            return { exists: true, uid: HELMCAIO_UID, isAdmin: true, hasSudo: true };
          },
        },
      }),
    );
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(2);
    expect(result.findings.find((f) => f.checkKey === "service_account_not_admin")?.status).toBe(
      "fail",
    );
    expect(result.findings.find((f) => f.checkKey === "service_account_no_sudo")?.status).toBe(
      "fail",
    );
  });

  it("fails when mysql listens beyond loopback and never surfaces a connection URL", async () => {
    const result = await caioAdminPreflight(
      baseOptions(),
      healthyPorts({
        mysql: {
          async describeListen() {
            return { reachable: true, listenAddress: "0.0.0.0" };
          },
        },
      }),
    );
    expect(result.status).toBe("failed");
    const finding = result.findings.find((f) => f.checkKey === "mysql_listen");
    expect(finding?.status).toBe("fail");
    const rendered = renderCaioAdminResult(result, { json: true });
    expect(rendered).not.toContain("DATABASE_URL");
    expect(rendered).not.toContain("mysql://");
  });

  it("fails on wrong arch, expired cert, busy port, missing dirs and low disk", async () => {
    const result = await caioAdminPreflight(
      baseOptions(),
      healthyPorts({
        machine: { arch: () => "x64", platform: () => "linux", osVersion: async () => "" },
        certificates: {
          async inspect() {
            return { notAfter: "2020-01-01T00:00:00Z", subjectRef: "expired" };
          },
        },
        network: { isPortFree: async () => false },
        files: { inspect: async () => null },
        disk: { freeBytes: async () => 1024 },
      }),
    );
    expect(result.status).toBe("failed");
    const byKey = new Map(result.findings.map((f) => [f.checkKey, f.status]));
    expect(byKey.get("machine_arch")).toBe("fail");
    expect(byKey.get("machine_os")).toBe("warn");
    expect(byKey.get("certificate_0")).toBe("fail");
    expect(byKey.get("port_3200")).toBe("fail");
    expect(byKey.get("releases_root")).toBe("fail");
    expect(byKey.get("runtime_root")).toBe("fail");
    expect(byKey.get("disk_space")).toBe("fail");
  });

  it("fails when the wrong owner or mode is on the run directories", async () => {
    const ports = healthyPorts();
    const result = await caioAdminPreflight(
      baseOptions(),
      healthyPorts({
        files: {
          async inspect(p) {
            const base = await ports.files.inspect(p);
            if (!base) return null;
            if (p === "/opt/caio/releases") return { ...base, uid: 0 };
            if (p === "/opt/caio/runtime") return { ...base, mode: 0o755 };
            return base;
          },
        },
      }),
    );
    expect(result.findings.find((f) => f.checkKey === "releases_root")?.status).toBe("fail");
    expect(result.findings.find((f) => f.checkKey === "runtime_root")?.status).toBe("fail");
  });

  it("keeps certificate findings body-free (expiry only)", async () => {
    const result = await caioAdminPreflight(baseOptions(), healthyPorts());
    const finding = result.findings.find((f) => f.checkKey === "certificate_0");
    expect(finding?.detail).toMatch(/expires in \d+d/);
    expect(finding?.detail).not.toContain("BEGIN CERTIFICATE");
  });
});
