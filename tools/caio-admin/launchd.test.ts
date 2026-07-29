import { describe, expect, it } from "vitest";

import {
  caioAdminProvisionService,
  validateLaunchdPlistTemplate,
  type LaunchdPorts,
  type ServiceContract,
} from "@/tools/caio-admin/launchd";

const CLEAN_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>com.example.caio</string>
  <key>ProgramArguments</key><array><string>/opt/caio/bin/serve</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>`;

// Synthetic credential-shaped fixture built by concatenation so the
// public-release static line scan never matches a URL-embedded credential.
const FAKE_PLIST_DB_URL = [
  "mysql:",
  "//",
  "svc:",
  "Sup3rS3cretPw@",
  "127.0.0.1",
  "/db",
].join("");

const SECRET_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>com.example.caio</string>
  <key>EnvironmentVariables</key><dict>
    <key>DATABASE_URL</key><string>${FAKE_PLIST_DB_URL}</string>
  </dict>
</dict></plist>`;

const SECRET_VALUE_PLIST = `<plist version="1.0"><dict>
  <key>EnvironmentVariables</key><dict>
    <key>EXTRA</key><string>sk-A1b2C3d4E5f6G7h8I9j0K1l2M3n4</string>
  </dict>
</dict></plist>`;

function makePorts(contract: ServiceContract | null, smokeOk = true): {
  ports: LaunchdPorts;
  written: Array<{ label: string; plistText: string }>;
  smokeRuns: string[];
} {
  const written: Array<{ label: string; plistText: string }> = [];
  const smokeRuns: string[] = [];
  const ports: LaunchdPorts = {
    readServiceContract: async () => contract,
    writePlist: async (label, plistText) => {
      written.push({ label, plistText });
      return { path: `/Library/LaunchDaemons/${label}.plist` };
    },
    runner: {
      run: async (step) => {
        smokeRuns.push(step.key);
        return { ok: smokeOk, exitCode: smokeOk ? 0 : 1, stdoutTail: "", stderrTail: "" };
      },
    },
  };
  return { ports, written, smokeRuns };
}

describe("validateLaunchdPlistTemplate", () => {
  it("accepts a clean plist", () => {
    expect(validateLaunchdPlistTemplate(CLEAN_PLIST)).toEqual({ ok: true });
  });

  it("rejects a plist carrying DATABASE_URL or secret env values", () => {
    const dbUrl = validateLaunchdPlistTemplate(SECRET_PLIST);
    expect(dbUrl.ok).toBe(false);
    const secretValue = validateLaunchdPlistTemplate(SECRET_VALUE_PLIST);
    expect(secretValue.ok).toBe(false);
    const secretKey = validateLaunchdPlistTemplate(
      "<plist><dict><key>API_TOKEN</key><string>short</string></dict></plist>",
    );
    expect(secretKey.ok).toBe(false);
  });
});

describe("caioAdminProvisionService", () => {
  it("provisions launchd from a tested, secret-free packaged contract", async () => {
    const { ports, written } = makePorts({
      label: "com.example.caio",
      plistTemplate: CLEAN_PLIST,
      contractTested: true,
    });
    const result = await caioAdminProvisionService({ releaseDir: "/rel", ports });
    expect(result.status).toBe("ok");
    expect(result.detail.persistentService).toBe("provisioned");
    expect(written).toHaveLength(1);
  });

  it("blocks an untested contract from creating any plist", async () => {
    const { ports, written } = makePorts({
      label: "com.example.caio",
      plistTemplate: CLEAN_PLIST,
      contractTested: false,
    });
    const result = await caioAdminProvisionService({ releaseDir: "/rel", ports });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:untested_service_contract");
    expect(written).toHaveLength(0);
  });

  it("rejects a plist with env secrets", async () => {
    const { ports, written } = makePorts({
      label: "com.example.caio",
      plistTemplate: SECRET_PLIST,
      contractTested: true,
    });
    const result = await caioAdminProvisionService({ releaseDir: "/rel", ports });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:plist_contains_secrets");
    expect(written).toHaveLength(0);
  });

  it("falls back to foreground smoke and reports persistent_service_not_provisioned without a contract", async () => {
    const { ports, written, smokeRuns } = makePorts(null);
    const result = await caioAdminProvisionService({ releaseDir: "/rel", ports });
    expect(result.status).toBe("ok");
    expect(result.detail.persistentService).toBe("not_provisioned");
    expect(smokeRuns).toEqual(["foreground_smoke"]);
    expect(written).toHaveLength(0);
    expect(
      result.findings.some((f) => f.checkKey === "persistent_service_not_provisioned"),
    ).toBe(true);
  });

  it("fails when the foreground smoke fails", async () => {
    const { ports } = makePorts(null, false);
    const result = await caioAdminProvisionService({ releaseDir: "/rel", ports });
    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(2);
  });
});
