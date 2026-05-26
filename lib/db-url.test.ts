import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MYSQL_DATABASE_URL,
  classifyResetTarget,
  getDatabaseNameFromUrl,
  isMysqlDatabaseUrl,
  withDatabaseName,
} from "@/lib/db-url";

describe("db url mysql helpers", () => {
  it("keeps a mysql default URL", () => {
    expect(isMysqlDatabaseUrl(DEFAULT_MYSQL_DATABASE_URL)).toBe(true);
  });

  it("extracts database name from a mysql URL", () => {
    expect(getDatabaseNameFromUrl(DEFAULT_MYSQL_DATABASE_URL)).toBe("helm2026");
  });

  it("replaces database name without changing host and auth", () => {
    const replaced = withDatabaseName(DEFAULT_MYSQL_DATABASE_URL, "helm2026_ci_temp");
    expect(getDatabaseNameFromUrl(replaced)).toBe("helm2026_ci_temp");
    expect(isMysqlDatabaseUrl(replaced)).toBe(true);
  });

  it("blocks shared database reset by default", () => {
    const decision = classifyResetTarget({
      databaseUrl: DEFAULT_MYSQL_DATABASE_URL,
      ci: false,
    });

    expect(decision.databaseName).toBe("helm2026");
    expect(decision.isBlockedShared).toBe(true);
    expect(decision.canReset).toBe(false);
  });

  it("allows CI temporary database reset", () => {
    const decision = classifyResetTarget({
      databaseUrl: withDatabaseName(DEFAULT_MYSQL_DATABASE_URL, "helm2026_ci_e2e"),
      ci: true,
    });

    expect(decision.isCiTempDatabase).toBe(true);
    expect(decision.canReset).toBe(true);
  });

  it("allows explicit allowlist reset target", () => {
    const decision = classifyResetTarget({
      databaseUrl: withDatabaseName(DEFAULT_MYSQL_DATABASE_URL, "helm2026_personal_dev"),
      ci: false,
      allowlistedDatabases: ["helm2026_personal_dev"],
    });

    expect(decision.isAllowlisted).toBe(true);
    expect(decision.canReset).toBe(true);
  });

  it("keeps blocked shared databases blocked even when allowlisted", () => {
    const decision = classifyResetTarget({
      databaseUrl: DEFAULT_MYSQL_DATABASE_URL,
      ci: false,
      allowlistedDatabases: ["helm2026"],
    });

    expect(decision.isBlockedShared).toBe(true);
    expect(decision.isAllowlisted).toBe(true);
    expect(decision.canReset).toBe(false);
  });

  it("keeps Playwright e2e from falling back to resetting base DATABASE_URL", () => {
    const source = readFileSync("scripts/run-playwright-e2e.ts", "utf8");

    expect(source).toContain("Refusing to fall back to resetting the base DATABASE_URL");
    expect(source).toContain("assertE2eResetTargetIsIsolated");
    expect(source).not.toContain("falling back to reset existing DATABASE_URL for e2e");
  });
});
