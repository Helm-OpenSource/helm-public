import { describe, expect, it } from "vitest";

import {
  ALLOWED_PLIST_ENV_KEYS,
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

const SECRET_VALUE = ["sk-", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4"].join("");
const SECRET_VALUE_PLIST = `<plist version="1.0"><dict>
  <key>EnvironmentVariables</key><dict>
    <key>EXTRA</key><string>${SECRET_VALUE}</string>
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

function envPlist(entries: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>Label</key><string>com.example.caio</string>
  <key>EnvironmentVariables</key><dict>
${entries}
  </dict>
</dict></plist>`;
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

  // Structural, key-name based rules: entropy/length of the VALUE is never
  // what makes a plist acceptable.
  it("rejects a short credential-named env value that no entropy heuristic catches", () => {
    // 8 characters, contains punctuation, no whitespace — the previous
    // length >= 20 entropy cut let this through into a world-readable plist.
    const shortPassword = ["hunter", "2", "!"].join("");
    const result = validateLaunchdPlistTemplate(
      envPlist(`    <key>DB_PASS</key><string>${shortPassword}</string>`),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toContain("DB_PASS");
  });

  it("rejects a short token env value", () => {
    const result = validateLaunchdPlistTemplate(
      envPlist("    <key>API_TOKEN</key><string>t0k</string>"),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a spaced passphrase env value", () => {
    const result = validateLaunchdPlistTemplate(
      envPlist(
        "    <key>SERVICE_PASSPHRASE</key><string>correct horse battery staple</string>",
      ),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects an env key that is not on the non-secret allowlist (fail closed)", () => {
    const result = validateLaunchdPlistTemplate(
      envPlist("    <key>SOME_NEW_THING</key><string>plain</string>"),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toContain("SOME_NEW_THING");
  });

  it("rejects a value embedding URL credentials even under an allowlisted key", () => {
    // Assembled at runtime so the public-release static line scan never sees a
    // URL-embedded credential literal.
    const dsn = ["mysql:", "//", "svc:", "Pw1@", "127.0.0.1", "/db"].join("");
    const result = validateLaunchdPlistTemplate(
      envPlist(`    <key>CAIO_LISTEN_ADDRESS</key><string>${dsn}</string>`),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a nested structure inside EnvironmentVariables", () => {
    const result = validateLaunchdPlistTemplate(
      envPlist("    <key>NODE_ENV</key><dict><key>x</key><string>y</string></dict>"),
    );
    expect(result.ok).toBe(false);
  });

  it("accepts every allowlisted env key individually (allowlist is not dead weight)", () => {
    for (const key of ALLOWED_PLIST_ENV_KEYS) {
      const result = validateLaunchdPlistTemplate(
        envPlist(`    <key>${key}</key><string>plain-value</string>`),
      );
      expect(result, `env key ${key}`).toEqual({ ok: true });
    }
  });

  it("still accepts legitimate non-secret environment variables", () => {
    const result = validateLaunchdPlistTemplate(
      envPlist(
        [
          "    <key>NODE_ENV</key><string>production</string>",
          "    <key>PATH</key><string>/usr/bin:/bin</string>",
          "    <key>CAIO_CONFIG_ROOT</key><string>/etc/caio</string>",
        ].join("\n"),
      ),
    );
    expect(result).toEqual({ ok: true });
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

  it("blocks a package-supplied service label that is not a safe path component", async () => {
    const { ports, written } = makePorts({
      label: "../../../../Users/victim/Library/LaunchAgents/evil",
      plistTemplate: CLEAN_PLIST,
      contractTested: true,
    });
    const result = await caioAdminProvisionService({ releaseDir: "/rel", ports });
    expect(result.status).toBe("blocked");
    expect(result.blockedReason).toBe("blocked:service_label_invalid");
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
