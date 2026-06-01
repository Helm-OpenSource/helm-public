import { analyzeSpawnEnvSupplyChainSources } from "@/lib/security/spawn-env-supply-chain-guard";
import { describe, expect, it } from "vitest";

describe("spawn env supply-chain guard", () => {
  it("warns for the approved legacy DingTalk MCP stdio route", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/connectors/dingtalk-mcp-client.ts",
        source: `
          import { spawn } from "node:child_process";
          function getMcpCommand() {
            return process.env.DINGTALK_MCP_COMMAND?.trim() || "npx";
          }
          function getMcpArgs() {
            return process.env.DINGTALK_MCP_ARGS?.split(",") ?? ["-y", "dingtalk-mcp@latest"];
          }
          function buildMcpChildEnv() {
            return {
              NODE_ENV: process.env.NODE_ENV ?? "development",
              DINGTALK_CLIENT_ID: process.env.DINGTALK_CLIENT_ID ?? "",
              DINGTALK_CLIENT_SECRET: process.env.DINGTALK_CLIENT_SECRET ?? "",
              DINGTALK_ROBOT_CODE: process.env.DINGTALK_ROBOT_CODE ?? "",
              DINGTALK_AGENT_ID: process.env.DINGTALK_AGENT_ID ?? "",
              ACTIVE_PROFILES: "dingtalk-calendar",
            };
          }
          spawn(getMcpCommand(), getMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
            env: buildMcpChildEnv(),
          });
        `,
      },
    ]);

    expect(result.failCount).toBe(0);
    expect(result.warnCount).toBe(1);
    expect(result.findings[0]).toMatchObject({
      id: "dingtalk-mcp-stdio",
      severity: "warn",
    });
  });

  it("warns for the approved legacy ODPS MCP stdio route", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/bi-report-skill/query-adapters/odps.ts",
        source: `
          import { spawn } from "node:child_process";
          const ODPS_MCP_CHILD_BASE_ENV_KEYS = ["PATH", "HOME", "NODE_ENV"] as const;
          function getOdpsMcpCommand() {
            return process.env.BI_REPORT_ODPS_MCP_COMMAND ?? "";
          }
          function getOdpsMcpArgs() {
            return process.env.BI_REPORT_ODPS_MCP_ARGS?.split(",") ?? [];
          }
          function copyEnvByPrefix(target: Record<string, string>, prefixes: readonly string[]) {
            for (const [key, value] of Object.entries(process.env)) {
              if (value && prefixes.some((prefix) => key.startsWith(prefix))) {
                target[key] = value;
              }
            }
          }
          function buildOdpsMcpChildEnv() {
            const sanitized: Record<string, string> = {};
            for (const key of ODPS_MCP_CHILD_BASE_ENV_KEYS) {
              const value = process.env[key];
              if (value) {
                sanitized[key] = value;
              }
            }
            copyEnvByPrefix(sanitized, ["BI_REPORT_ODPS_", "ODPS_"]);
            return sanitized;
          }
          spawn(getOdpsMcpCommand() || "npx", getOdpsMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
            env: buildOdpsMcpChildEnv(),
          });
        `,
      },
    ]);

    expect(result.failCount).toBe(0);
    expect(result.warnCount).toBe(1);
    expect(result.findings[0]).toMatchObject({
      id: "bi-report-odps-mcp-stdio",
      severity: "warn",
    });
    expect(result.findings[0]?.reason).toContain("buildOdpsMcpChildEnv");
  });

  it("fails closed when a known route lacks env allowlist evidence", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/bi-report-skill/query-adapters/odps.ts",
        source: `
          import { spawn } from "node:child_process";
          function getOdpsMcpCommand() {
            return process.env.BI_REPORT_ODPS_MCP_COMMAND ?? "";
          }
          function getOdpsMcpArgs() {
            return process.env.BI_REPORT_ODPS_MCP_ARGS?.split(",") ?? [];
          }
          spawn(getOdpsMcpCommand() || "npx", getOdpsMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
          });
        `,
      },
    ]);

    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.findings[0]).toMatchObject({
      id: "bi-report-odps-mcp-stdio:missing-env-evidence",
      severity: "fail",
    });
    expect(result.findings[0]?.reason).toContain("missing required env allowlist evidence");
  });

  it("fails closed for a second unsafe spawn in an otherwise approved known file", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/connectors/dingtalk-mcp-client.ts",
        source: `
          import { spawn } from "node:child_process";
          function getMcpCommand() {
            return process.env.DINGTALK_MCP_COMMAND?.trim() || "npx";
          }
          function getMcpArgs() {
            return process.env.DINGTALK_MCP_ARGS?.split(",") ?? ["-y", "dingtalk-mcp@latest"];
          }
          function buildMcpChildEnv() {
            return {
              NODE_ENV: process.env.NODE_ENV ?? "development",
              DINGTALK_CLIENT_ID: process.env.DINGTALK_CLIENT_ID ?? "",
              DINGTALK_CLIENT_SECRET: process.env.DINGTALK_CLIENT_SECRET ?? "",
              DINGTALK_ROBOT_CODE: process.env.DINGTALK_ROBOT_CODE ?? "",
              DINGTALK_AGENT_ID: process.env.DINGTALK_AGENT_ID ?? "",
              ACTIVE_PROFILES: "dingtalk-calendar",
            };
          }
          spawn(getMcpCommand(), getMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
            env: buildMcpChildEnv(),
          });
          spawn(getMcpCommand(), getMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
            env: process.env,
          });
        `,
      },
    ]);

    expect(result.warnCount).toBe(1);
    expect(result.failCount).toBe(1);
    expect(result.findings.map((finding) => finding.severity)).toEqual(["warn", "fail"]);
    expect(result.findings[1]).toMatchObject({
      id: "dingtalk-mcp-stdio:missing-env-evidence",
      severity: "fail",
    });
    expect(result.findings[1]?.reason).toContain("spawn options env calling buildMcpChildEnv");
  });

  it("fails closed when known route evidence only appears in comments", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/bi-report-skill/query-adapters/odps.ts",
        source: `
          import { spawn } from "node:child_process";
          // buildOdpsMcpChildEnv env: buildOdpsMcpChildEnv ODPS_MCP_CHILD_BASE_ENV_KEYS copyEnvByPrefix "BI_REPORT_ODPS_" "ODPS_"
          function getOdpsMcpCommand() {
            return process.env.BI_REPORT_ODPS_MCP_COMMAND ?? "";
          }
          function getOdpsMcpArgs() {
            return process.env.BI_REPORT_ODPS_MCP_ARGS?.split(",") ?? [];
          }
          spawn(getOdpsMcpCommand() || "npx", getOdpsMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
          });
        `,
      },
    ]);

    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.findings[0]).toMatchObject({
      id: "bi-report-odps-mcp-stdio:missing-env-evidence",
      severity: "fail",
    });
  });

  it("fails closed when the approved env builder forwards process.env wholesale", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/connectors/dingtalk-mcp-client.ts",
        source: `
          import { spawn } from "node:child_process";
          function getMcpCommand() {
            return process.env.DINGTALK_MCP_COMMAND?.trim() || "npx";
          }
          function getMcpArgs() {
            return process.env.DINGTALK_MCP_ARGS?.split(",") ?? ["-y", "dingtalk-mcp@latest"];
          }
          function buildMcpChildEnv() {
            return {
              ...process.env,
              NODE_ENV: process.env.NODE_ENV ?? "development",
              DINGTALK_CLIENT_ID: process.env.DINGTALK_CLIENT_ID ?? "",
              DINGTALK_CLIENT_SECRET: process.env.DINGTALK_CLIENT_SECRET ?? "",
              DINGTALK_ROBOT_CODE: process.env.DINGTALK_ROBOT_CODE ?? "",
              DINGTALK_AGENT_ID: process.env.DINGTALK_AGENT_ID ?? "",
              ACTIVE_PROFILES: "dingtalk-calendar",
            };
          }
          spawn(getMcpCommand(), getMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
            env: buildMcpChildEnv(),
          });
        `,
      },
    ]);

    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.findings[0]).toMatchObject({
      id: "dingtalk-mcp-stdio:missing-env-evidence",
      severity: "fail",
    });
    expect(result.findings[0]?.reason).toContain("must not spread process.env");
  });

  it("fails closed when the approved env builder returns a process.env alias", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/connectors/dingtalk-mcp-client.ts",
        source: `
          import { spawn } from "node:child_process";
          function getMcpCommand() {
            return process.env.DINGTALK_MCP_COMMAND?.trim() || "npx";
          }
          function getMcpArgs() {
            return process.env.DINGTALK_MCP_ARGS?.split(",") ?? ["-y", "dingtalk-mcp@latest"];
          }
          function buildMcpChildEnv() {
            const sanitized = process.env;
            sanitized.DINGTALK_CLIENT_ID = process.env.DINGTALK_CLIENT_ID ?? "";
            sanitized.DINGTALK_CLIENT_SECRET = process.env.DINGTALK_CLIENT_SECRET ?? "";
            sanitized.DINGTALK_ROBOT_CODE = process.env.DINGTALK_ROBOT_CODE ?? "";
            sanitized.DINGTALK_AGENT_ID = process.env.DINGTALK_AGENT_ID ?? "";
            sanitized.ACTIVE_PROFILES = "dingtalk-calendar";
            return sanitized;
          }
          spawn(getMcpCommand(), getMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
            env: buildMcpChildEnv(),
          });
        `,
      },
    ]);

    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.findings[0]).toMatchObject({
      id: "dingtalk-mcp-stdio:missing-env-evidence",
      severity: "fail",
    });
    expect(result.findings[0]?.reason).toContain("must not return process.env");
  });

  it("fails closed when the approved env builder forwards a non-allowlisted env key", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/connectors/dingtalk-mcp-client.ts",
        source: `
          import { spawn } from "node:child_process";
          function getMcpCommand() {
            return process.env.DINGTALK_MCP_COMMAND?.trim() || "npx";
          }
          function getMcpArgs() {
            return process.env.DINGTALK_MCP_ARGS?.split(",") ?? ["-y", "dingtalk-mcp@latest"];
          }
          function buildMcpChildEnv() {
            return {
              NODE_ENV: process.env.NODE_ENV ?? "development",
              DINGTALK_CLIENT_ID: process.env.DINGTALK_CLIENT_ID ?? "",
              DINGTALK_CLIENT_SECRET: process.env.DINGTALK_CLIENT_SECRET ?? "",
              DINGTALK_ROBOT_CODE: process.env.DINGTALK_ROBOT_CODE ?? "",
              DINGTALK_AGENT_ID: process.env.DINGTALK_AGENT_ID ?? "",
              ACTIVE_PROFILES: "dingtalk-calendar",
              OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
            };
          }
          spawn(getMcpCommand(), getMcpArgs(), {
            stdio: ["pipe", "pipe", "pipe"],
            env: buildMcpChildEnv(),
          });
        `,
      },
    ]);

    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.findings[0]).toMatchObject({
      id: "dingtalk-mcp-stdio:missing-env-evidence",
      severity: "fail",
    });
    expect(result.findings[0]?.reason).toContain("reads non-allowlisted process.env key OPENAI_API_KEY");
  });

  it("fails closed for a new env-derived spawn route", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "lib/connectors/new-mcp-client.ts",
        source: `
          import { spawn } from "node:child_process";
          function getCommand() {
            return process.env.NEW_MCP_COMMAND ?? "npx";
          }
          function getArgs() {
            return process.env.NEW_MCP_ARGS?.split(",") ?? [];
          }
          spawn(getCommand(), getArgs(), { stdio: ["pipe", "pipe", "pipe"] });
        `,
      },
    ]);

    expect(result.warnCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.findings[0]?.id).toContain("unknown-env-derived-spawn");
  });

  it("ignores fixed local process launches without env-derived command or args", () => {
    const result = analyzeSpawnEnvSupplyChainSources([
      {
        file: "scripts/run-playwright-e2e.ts",
        source: `
          import { spawn } from "node:child_process";
          spawn("npm", ["run", "start"], { stdio: "inherit" });
        `,
      },
    ]);

    expect(result.findings).toEqual([]);
  });
});
