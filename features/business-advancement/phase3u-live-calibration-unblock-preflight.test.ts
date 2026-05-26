import { describe, expect, it } from "vitest";

import {
  PHASE3U_NEXT_STEP_NOT_READY,
  PHASE3U_NEXT_STEP_READY,
  PHASE3U_RULE_VERSION,
  PHASE3U_RUNTIME_ADOPTION_POSTURE,
  evaluatePhase3uLiveCalibrationUnblockPreflight,
} from "../../scripts/business-advancement-phase3u-live-calibration-unblock-preflight";

const MYSQL_URL = [
  "mysql://",
  "user",
  ":",
  "s3cr3t",
  "@db.example.com:3306/helm2026",
].join("");
const POSTGRESQL_URL = [
  "postgresql://",
  "user",
  ":",
  "not-a-real-password",
  "@host:5432/db",
].join("");
const REAL_WORKSPACE_ID = "ws-real-abc123";
const REF_CLOCK = "2026-04-26T00:00:00.000Z";

const READY_ARGV = [
  "--workspace-id",
  REAL_WORKSPACE_ID,
  "--reference-clock-iso",
  REF_CLOCK,
];
const READY_ENV = { DATABASE_URL: MYSQL_URL };

function makeReady(
  argvOverrides: string[] = [],
  envOverrides: Record<string, string | undefined> = {},
) {
  return evaluatePhase3uLiveCalibrationUnblockPreflight(
    [...READY_ARGV, ...argvOverrides],
    { ...READY_ENV, ...envOverrides },
  );
}

describe("Phase 3U constants", () => {
  it("PHASE3U_RULE_VERSION is correct", () => {
    expect(PHASE3U_RULE_VERSION).toBe(
      "phase3u-live-calibration-unblock-preflight/v1",
    );
  });

  it("PHASE3U_RUNTIME_ADOPTION_POSTURE is No-Go", () => {
    expect(PHASE3U_RUNTIME_ADOPTION_POSTURE).toBe("No-Go");
  });

  it("PHASE3U_NEXT_STEP_READY mentions manual review and forbids direct adoption", () => {
    const step = PHASE3U_NEXT_STEP_READY.toLowerCase();
    expect(step).toContain("manual production runtime adoption review");
    expect(step).toContain("no direct runtime adoption");
    expect(step).toContain("no auto-execution");
    expect(step).toContain("no auto-approve");
  });

  it("PHASE3U_NEXT_STEP_NOT_READY mentions blockers and re-run", () => {
    const step = PHASE3U_NEXT_STEP_NOT_READY.toLowerCase();
    expect(step).toContain("blockers");
    expect(step).toContain("re-run");
  });
});

describe("ready result — all requirements met", () => {
  it("liveCalibrationReady is true", () => {
    expect(makeReady().liveCalibrationReady).toBe(true);
  });

  it("blockers is empty when ready", () => {
    expect(makeReady().blockers).toHaveLength(0);
  });

  it("ruleVersion is correct", () => {
    expect(makeReady().ruleVersion).toBe(
      "phase3u-live-calibration-unblock-preflight/v1",
    );
  });

  it("runtimeAdoptionPosture is No-Go", () => {
    expect(makeReady().runtimeAdoptionPosture).toBe("No-Go");
  });

  it("productionAdoptionAllowed is false when ready", () => {
    expect(makeReady().productionAdoptionAllowed).toBe(false);
  });

  it("runtimeIntegrationAllowed is false when ready", () => {
    expect(makeReady().runtimeIntegrationAllowed).toBe(false);
  });

  it("dbAccessAttempted is false", () => {
    expect(makeReady().dbAccessAttempted).toBe(false);
  });

  it("filesWritten is false", () => {
    expect(makeReady().filesWritten).toBe(false);
  });

  it("resolvedWorkspaceIdPresence is true", () => {
    expect(makeReady().resolvedWorkspaceIdPresence).toBe(true);
  });

  it("referenceClockIso matches input", () => {
    expect(makeReady().referenceClockIso).toBe(REF_CLOCK);
  });

  it("take defaults to 200", () => {
    expect(makeReady().take).toBe(200);
  });

  it("safeCommandChain has exactly 4 commands", () => {
    const result = makeReady();
    expect(result.safeCommandChain).not.toBeNull();
    expect(result.safeCommandChain).toHaveLength(4);
  });

  it("safeCommandChain[0] invokes Phase 3P collector", () => {
    const result = makeReady();
    expect(result.safeCommandChain![0]).toContain(
      "business-advancement-phase3p-redacted-snapshot-collector.ts",
    );
  });

  it("safeCommandChain[1] invokes Phase 3Q intake", () => {
    const result = makeReady();
    expect(result.safeCommandChain![1]).toContain(
      "business-advancement-phase3q-snapshot-intake-review.ts",
    );
  });

  it("safeCommandChain[2] invokes Phase 3R preflight", () => {
    const result = makeReady();
    expect(result.safeCommandChain![2]).toContain(
      "business-advancement-phase3r-runtime-adoption-preflight.ts",
    );
  });

  it("safeCommandChain[3] invokes Phase 3S review packet", () => {
    const result = makeReady();
    expect(result.safeCommandChain![3]).toContain(
      "business-advancement-phase3s-runtime-adoption-review-packet.ts",
    );
  });

  it("safeCommandChain[0] includes --print-json and output redirect", () => {
    const result = makeReady();
    expect(result.safeCommandChain![0]).toContain("--print-json");
    expect(result.safeCommandChain![0]).toContain("/tmp/phase3p-snapshot.json");
  });

  it("safeCommandChain[1..3] use --input /tmp/phase3p-snapshot.json", () => {
    const result = makeReady();
    for (const cmd of result.safeCommandChain!.slice(1)) {
      expect(cmd).toContain("--input /tmp/phase3p-snapshot.json");
    }
  });

  it("safeCommandChain[0] includes referenceClockIso literally", () => {
    const result = makeReady();
    expect(result.safeCommandChain![0]).toContain(REF_CLOCK);
  });

  it("safeCommandChain[0] includes take value", () => {
    const result = makeReady(["--take", "50"]);
    expect(result.safeCommandChain![0]).toContain("--take 50");
  });

  it("allowedNextStep mentions safe command chain and manual review", () => {
    const step = makeReady().allowedNextStep.toLowerCase();
    expect(step).toContain("manual production runtime adoption review");
    expect(step).toContain("no direct runtime adoption");
  });
});

describe("URL redaction — never exposes password or full connection string", () => {
  it("redactedDatabaseTarget has protocol mysql", () => {
    expect(makeReady().redactedDatabaseTarget?.protocol).toBe("mysql");
  });

  it("redactedDatabaseTarget has host", () => {
    expect(makeReady().redactedDatabaseTarget?.host).toBe(
      "db.example.com:3306",
    );
  });

  it("redactedDatabaseTarget has database", () => {
    expect(makeReady().redactedDatabaseTarget?.database).toBe("helm2026");
  });

  it("JSON output does not contain the raw password", () => {
    const result = makeReady();
    const json = JSON.stringify(result);
    expect(json).not.toContain("s3cr3t");
  });

  it("JSON output does not contain the full connection string", () => {
    const result = makeReady();
    const json = JSON.stringify(result);
    expect(json).not.toContain(MYSQL_URL);
  });

  it("JSON output does not contain the username from the URL", () => {
    const result = makeReady();
    const json = JSON.stringify(result);
    // username "user" is too generic to assert, but the full URL with credentials must not appear
    expect(json).not.toContain("user:s3cr3t");
  });

  it("safeCommandChain uses ${DATABASE_URL} placeholder, not the actual URL", () => {
    const result = makeReady();
    const cmd = result.safeCommandChain![0];
    expect(cmd).toContain("${DATABASE_URL}");
    expect(cmd).not.toContain("s3cr3t");
    expect(cmd).not.toContain(MYSQL_URL);
  });

  it("safeCommandChain uses ${WORKSPACE_ID} placeholder, not the actual workspaceId", () => {
    const result = makeReady();
    const cmd = result.safeCommandChain![0];
    expect(cmd).toContain("${WORKSPACE_ID}");
    expect(cmd).not.toContain(REAL_WORKSPACE_ID);
  });

  it("resolvedWorkspaceIdPresence is boolean — actual workspaceId value not in output", () => {
    const result = makeReady();
    const json = JSON.stringify(result);
    expect(typeof result.resolvedWorkspaceIdPresence).toBe("boolean");
    // workspaceId value must not appear directly in the serialized output
    expect(json).not.toContain(REAL_WORKSPACE_ID);
  });
});

describe("blocker — missing DATABASE_URL", () => {
  it("liveCalibrationReady is false", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      READY_ARGV,
      {},
    );
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("blockers contains DATABASE_URL message", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      READY_ARGV,
      {},
    );
    expect(result.blockers.some((b) => b.includes("DATABASE_URL"))).toBe(true);
  });

  it("redactedDatabaseTarget is null", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      READY_ARGV,
      {},
    );
    expect(result.redactedDatabaseTarget).toBeNull();
  });

  it("safeCommandChain is null", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      READY_ARGV,
      {},
    );
    expect(result.safeCommandChain).toBeNull();
  });

  it("productionAdoptionAllowed remains false", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      READY_ARGV,
      {},
    );
    expect(result.productionAdoptionAllowed).toBe(false);
  });

  it("dbAccessAttempted is false even when DATABASE_URL missing", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      READY_ARGV,
      {},
    );
    expect(result.dbAccessAttempted).toBe(false);
  });
});

describe("blocker — non-mysql DATABASE_URL protocol", () => {
  it("liveCalibrationReady is false for postgresql URL", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: POSTGRESQL_URL,
    });
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("blockers mentions protocol requirement for postgresql URL", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: POSTGRESQL_URL,
    });
    expect(
      result.blockers.some(
        (b) => b.includes("postgresql") || b.includes("protocol"),
      ),
    ).toBe(true);
  });

  it("liveCalibrationReady is false for https URL", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: "https://host/db",
    });
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("redactedDatabaseTarget still populated for parseable non-mysql URL", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: POSTGRESQL_URL.replace("/db", "/mydb"),
    });
    expect(result.redactedDatabaseTarget).not.toBeNull();
    expect(result.redactedDatabaseTarget?.protocol).toBe("postgresql");
  });

  it("safeCommandChain is null for non-mysql URL", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: POSTGRESQL_URL,
    });
    expect(result.safeCommandChain).toBeNull();
  });
});

describe("blocker — local DB cannot unlock live calibration", () => {
  it("liveCalibrationReady is false for localhost MySQL", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: [
        "mysql://",
        "local",
        ":",
        "dev-only",
        "@localhost:3306/helm2026_ba_phase3_verify",
      ].join(""),
    });
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("liveCalibrationReady is false for 127.0.0.1 MySQL", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: [
        "mysql://",
        "local",
        ":",
        "dev-only",
        "@127.0.0.1:3306/helm2026_ba_phase3_verify",
      ].join(""),
    });
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("liveCalibrationReady is false for IPv6 localhost MySQL", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: [
        "mysql://",
        "local",
        ":",
        "dev-only",
        "@[::1]:3306/helm2026_ba_phase3_verify",
      ].join(""),
    });
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("blockers describe local DB as development validation only", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: [
        "mysql://",
        "local",
        ":",
        "dev-only",
        "@127.0.0.1:3306/helm2026_ba_phase3_verify",
      ].join(""),
    });
    expect(
      result.blockers.some(
        (b) =>
          b.toLowerCase().includes("local database") &&
          b.toLowerCase().includes("development validation"),
      ),
    ).toBe(true);
  });

  it("safeCommandChain is null for local DB", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(READY_ARGV, {
      DATABASE_URL: [
        "mysql://",
        "local",
        ":",
        "dev-only",
        "@localhost:3306/helm2026_ba_phase3_verify",
      ].join(""),
    });
    expect(result.safeCommandChain).toBeNull();
  });
});

describe("blocker — missing workspaceId", () => {
  it("liveCalibrationReady is false", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--reference-clock-iso", REF_CLOCK],
      READY_ENV,
    );
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("blockers mentions workspaceId", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--reference-clock-iso", REF_CLOCK],
      READY_ENV,
    );
    expect(result.blockers.some((b) => b.toLowerCase().includes("workspaceid"))).toBe(true);
  });

  it("resolvedWorkspaceIdPresence is false", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--reference-clock-iso", REF_CLOCK],
      READY_ENV,
    );
    expect(result.resolvedWorkspaceIdPresence).toBe(false);
  });
});

describe("blocker — dummy workspaceId explicitly rejected", () => {
  it("liveCalibrationReady is false for dummy workspaceId", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        "db-reachability-probe-only",
        "--reference-clock-iso",
        REF_CLOCK,
      ],
      READY_ENV,
    );
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("blockers mentions dummy sentinel value", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        "db-reachability-probe-only",
        "--reference-clock-iso",
        REF_CLOCK,
      ],
      READY_ENV,
    );
    expect(
      result.blockers.some((b) =>
        b.includes("db-reachability-probe-only"),
      ),
    ).toBe(true);
  });

  it("resolvedWorkspaceIdPresence is true (value is present, just invalid)", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        "db-reachability-probe-only",
        "--reference-clock-iso",
        REF_CLOCK,
      ],
      READY_ENV,
    );
    expect(result.resolvedWorkspaceIdPresence).toBe(true);
  });

  it("safeCommandChain is null for dummy workspaceId", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        "db-reachability-probe-only",
        "--reference-clock-iso",
        REF_CLOCK,
      ],
      READY_ENV,
    );
    expect(result.safeCommandChain).toBeNull();
  });

  it("dummy workspaceId in env is also rejected", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--reference-clock-iso", REF_CLOCK],
      { ...READY_ENV, WORKSPACE_ID: "db-reachability-probe-only" },
    );
    expect(result.liveCalibrationReady).toBe(false);
    expect(
      result.blockers.some((b) => b.includes("db-reachability-probe-only")),
    ).toBe(true);
  });
});

describe("blocker — missing referenceClockIso", () => {
  it("liveCalibrationReady is false", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--workspace-id", REAL_WORKSPACE_ID],
      READY_ENV,
    );
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("blockers mentions referenceClockIso / REFERENCE_CLOCK_ISO", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--workspace-id", REAL_WORKSPACE_ID],
      READY_ENV,
    );
    expect(
      result.blockers.some(
        (b) =>
          b.toLowerCase().includes("referenceclock") ||
          b.includes("REFERENCE_CLOCK_ISO"),
      ),
    ).toBe(true);
  });

  it("referenceClockIso is null", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--workspace-id", REAL_WORKSPACE_ID],
      READY_ENV,
    );
    expect(result.referenceClockIso).toBeNull();
  });
});

describe("blocker — invalid referenceClockIso", () => {
  it("liveCalibrationReady is false for non-ISO string", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        REAL_WORKSPACE_ID,
        "--reference-clock-iso",
        "not-a-date",
      ],
      READY_ENV,
    );
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("blockers mentions invalid datetime", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        REAL_WORKSPACE_ID,
        "--reference-clock-iso",
        "not-a-date",
      ],
      READY_ENV,
    );
    expect(result.blockers.some((b) => b.includes("not-a-date"))).toBe(true);
  });

  it("referenceClockIso is null for invalid input", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        REAL_WORKSPACE_ID,
        "--reference-clock-iso",
        "not-a-date",
      ],
      READY_ENV,
    );
    expect(result.referenceClockIso).toBeNull();
  });

  it("liveCalibrationReady is false for ISO date without time", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        REAL_WORKSPACE_ID,
        "--reference-clock-iso",
        "2026-04-26",
      ],
      READY_ENV,
    );
    expect(result.liveCalibrationReady).toBe(false);
  });
});

describe("blocker — invalid take", () => {
  it("liveCalibrationReady is false for take 0", () => {
    const result = makeReady(["--take", "0"]);
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("blockers mentions take for value 0", () => {
    const result = makeReady(["--take", "0"]);
    expect(result.blockers.some((b) => b.includes("--take"))).toBe(true);
  });

  it("liveCalibrationReady is false for take 501", () => {
    const result = makeReady(["--take", "501"]);
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("liveCalibrationReady is false for non-integer take", () => {
    const result = makeReady(["--take", "3.5"]);
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("liveCalibrationReady is false for NaN take", () => {
    const result = makeReady(["--take", "abc"]);
    expect(result.liveCalibrationReady).toBe(false);
  });

  it("take boundary 1 is accepted", () => {
    const result = makeReady(["--take", "1"]);
    expect(result.liveCalibrationReady).toBe(true);
    expect(result.take).toBe(1);
  });

  it("take boundary 500 is accepted", () => {
    const result = makeReady(["--take", "500"]);
    expect(result.liveCalibrationReady).toBe(true);
    expect(result.take).toBe(500);
  });
});

describe("workspaceId resolution priority", () => {
  it("--workspace-id takes precedence over env.WORKSPACE_ID", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--workspace-id", REAL_WORKSPACE_ID, "--reference-clock-iso", REF_CLOCK],
      { ...READY_ENV, WORKSPACE_ID: "other-workspace" },
    );
    expect(result.liveCalibrationReady).toBe(true);
    expect(result.resolvedWorkspaceIdPresence).toBe(true);
  });

  it("env.WORKSPACE_ID is used when no --workspace-id arg", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--reference-clock-iso", REF_CLOCK],
      { ...READY_ENV, WORKSPACE_ID: REAL_WORKSPACE_ID },
    );
    expect(result.liveCalibrationReady).toBe(true);
  });

  it("env.HELM_PHASE3P_WORKSPACE_ID is used as fallback", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--reference-clock-iso", REF_CLOCK],
      { ...READY_ENV, HELM_PHASE3P_WORKSPACE_ID: REAL_WORKSPACE_ID },
    );
    expect(result.liveCalibrationReady).toBe(true);
  });
});

describe("referenceClockIso resolution from env", () => {
  it("REFERENCE_CLOCK_ISO env is used when no --reference-clock-iso arg", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      ["--workspace-id", REAL_WORKSPACE_ID],
      { ...READY_ENV, REFERENCE_CLOCK_ISO: REF_CLOCK },
    );
    expect(result.liveCalibrationReady).toBe(true);
    expect(result.referenceClockIso).toBe(REF_CLOCK);
  });

  it("--reference-clock-iso arg takes precedence over env", () => {
    const overrideIso = "2026-01-01T00:00:00.000Z";
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight(
      [
        "--workspace-id",
        REAL_WORKSPACE_ID,
        "--reference-clock-iso",
        overrideIso,
      ],
      { ...READY_ENV, REFERENCE_CLOCK_ISO: REF_CLOCK },
    );
    expect(result.referenceClockIso).toBe(overrideIso);
  });
});

describe("fixed governance invariants", () => {
  it("productionAdoptionAllowed is always false regardless of readiness", () => {
    const blocked = evaluatePhase3uLiveCalibrationUnblockPreflight([], {});
    expect(blocked.productionAdoptionAllowed).toBe(false);

    const ready = makeReady();
    expect(ready.productionAdoptionAllowed).toBe(false);
  });

  it("runtimeIntegrationAllowed is always false regardless of readiness", () => {
    const blocked = evaluatePhase3uLiveCalibrationUnblockPreflight([], {});
    expect(blocked.runtimeIntegrationAllowed).toBe(false);

    const ready = makeReady();
    expect(ready.runtimeIntegrationAllowed).toBe(false);
  });

  it("dbAccessAttempted is always false", () => {
    expect(evaluatePhase3uLiveCalibrationUnblockPreflight([], {}).dbAccessAttempted).toBe(false);
    expect(makeReady().dbAccessAttempted).toBe(false);
  });

  it("filesWritten is always false", () => {
    expect(evaluatePhase3uLiveCalibrationUnblockPreflight([], {}).filesWritten).toBe(false);
    expect(makeReady().filesWritten).toBe(false);
  });

  it("safeCommandChain is null when not ready", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight([], {});
    expect(result.safeCommandChain).toBeNull();
  });

  it("allowedNextStep for not-ready does not grant productionAdoptionAllowed", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight([], {});
    expect(result.allowedNextStep.toLowerCase()).not.toContain(
      "productionadoptionallowed=true",
    );
    expect(result.allowedNextStep.toLowerCase()).not.toContain(
      "runtimeintegrationallowed=true",
    );
  });

  it("allowedNextStep for ready does not grant productionAdoptionAllowed", () => {
    const result = makeReady();
    expect(result.allowedNextStep.toLowerCase()).not.toContain(
      "productionadoptionallowed=true",
    );
    expect(result.allowedNextStep.toLowerCase()).not.toContain(
      "runtimeintegrationallowed=true",
    );
  });
});

describe("--print-json serializable output shape", () => {
  it("ready result has all required fields", () => {
    const result = makeReady();
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized).toHaveProperty("ruleVersion");
    expect(serialized).toHaveProperty("runtimeAdoptionPosture");
    expect(serialized).toHaveProperty("liveCalibrationReady");
    expect(serialized).toHaveProperty("productionAdoptionAllowed");
    expect(serialized).toHaveProperty("runtimeIntegrationAllowed");
    expect(serialized).toHaveProperty("dbAccessAttempted");
    expect(serialized).toHaveProperty("filesWritten");
    expect(serialized).toHaveProperty("blockers");
    expect(serialized).toHaveProperty("redactedDatabaseTarget");
    expect(serialized).toHaveProperty("resolvedWorkspaceIdPresence");
    expect(serialized).toHaveProperty("referenceClockIso");
    expect(serialized).toHaveProperty("take");
    expect(serialized).toHaveProperty("safeCommandChain");
    expect(serialized).toHaveProperty("allowedNextStep");
  });

  it("blocked result has all required fields", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight([], {});
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(serialized).toHaveProperty("ruleVersion");
    expect(serialized).toHaveProperty("runtimeAdoptionPosture");
    expect(serialized).toHaveProperty("liveCalibrationReady");
    expect(serialized).toHaveProperty("productionAdoptionAllowed");
    expect(serialized).toHaveProperty("runtimeIntegrationAllowed");
    expect(serialized).toHaveProperty("dbAccessAttempted");
    expect(serialized).toHaveProperty("filesWritten");
    expect(serialized).toHaveProperty("blockers");
    expect(serialized).toHaveProperty("redactedDatabaseTarget");
    expect(serialized).toHaveProperty("resolvedWorkspaceIdPresence");
    expect(serialized).toHaveProperty("referenceClockIso");
    expect(serialized).toHaveProperty("take");
    expect(serialized).toHaveProperty("safeCommandChain");
    expect(serialized).toHaveProperty("allowedNextStep");
  });

  it("serialized blockers is an array", () => {
    const result = evaluatePhase3uLiveCalibrationUnblockPreflight([], {});
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(serialized.blockers)).toBe(true);
  });

  it("serialized safeCommandChain is an array of 4 for ready result", () => {
    const result = makeReady();
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    expect(Array.isArray(serialized.safeCommandChain)).toBe(true);
    expect((serialized.safeCommandChain as unknown[]).length).toBe(4);
  });

  it("serialized redactedDatabaseTarget has protocol/host/database only", () => {
    const result = makeReady();
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    const target = serialized.redactedDatabaseTarget as Record<string, unknown>;
    expect(target).toHaveProperty("protocol");
    expect(target).toHaveProperty("host");
    expect(target).toHaveProperty("database");
    expect(Object.keys(target)).toHaveLength(3);
  });

  it("serialized redactedDatabaseTarget does not have username or password fields", () => {
    const result = makeReady();
    const serialized = JSON.parse(JSON.stringify(result)) as Record<
      string,
      unknown
    >;
    const target = serialized.redactedDatabaseTarget as Record<string, unknown>;
    expect(target).not.toHaveProperty("username");
    expect(target).not.toHaveProperty("password");
    expect(target).not.toHaveProperty("user");
    expect(target).not.toHaveProperty("credentials");
  });
});

describe("safeCommandChain phase ordering", () => {
  it("Phase 3P comes before Phase 3Q in the chain", () => {
    const result = makeReady();
    const chain = result.safeCommandChain!;
    const p3pIndex = chain.findIndex((c) => c.includes("phase3p"));
    const p3qIndex = chain.findIndex((c) => c.includes("phase3q"));
    expect(p3pIndex).toBeLessThan(p3qIndex);
  });

  it("Phase 3Q comes before Phase 3R in the chain", () => {
    const result = makeReady();
    const chain = result.safeCommandChain!;
    const p3qIndex = chain.findIndex((c) => c.includes("phase3q"));
    const p3rIndex = chain.findIndex((c) => c.includes("phase3r"));
    expect(p3qIndex).toBeLessThan(p3rIndex);
  });

  it("Phase 3R comes before Phase 3S in the chain", () => {
    const result = makeReady();
    const chain = result.safeCommandChain!;
    const p3rIndex = chain.findIndex((c) => c.includes("phase3r"));
    const p3sIndex = chain.findIndex((c) => c.includes("phase3s"));
    expect(p3rIndex).toBeLessThan(p3sIndex);
  });
});
