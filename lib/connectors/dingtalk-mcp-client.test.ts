import { afterEach, describe, expect, it } from "vitest";
import {
  buildMcpChildEnv,
  formatMcpStderrForError,
  getDingTalkMcpActiveProfiles,
} from "@/lib/connectors/dingtalk-mcp-client";

describe("dingtalk mcp client config", () => {
  const originalProfiles = process.env.DINGTALK_MCP_ACTIVE_PROFILES;
  const originalNoticeToggle = process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS;

  afterEach(() => {
    if (originalProfiles === undefined) {
      delete process.env.DINGTALK_MCP_ACTIVE_PROFILES;
    } else {
      process.env.DINGTALK_MCP_ACTIVE_PROFILES = originalProfiles;
    }
    if (originalNoticeToggle === undefined) {
      delete process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS;
    } else {
      process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS = originalNoticeToggle;
    }
  });

  it("returns default profiles when env is unset", () => {
    delete process.env.DINGTALK_MCP_ACTIVE_PROFILES;

    expect(getDingTalkMcpActiveProfiles()).toEqual([
      "dingtalk-contacts",
      "dingtalk-department",
      "dingtalk-calendar",
      "dingtalk-tasks",
      "dingtalk-teambition",
      "dingtalk-report",
    ]);
  });

  it("respects configured comma-separated profiles", () => {
    process.env.DINGTALK_MCP_ACTIVE_PROFILES = "dingtalk-calendar,dingtalk-tasks";

    expect(getDingTalkMcpActiveProfiles()).toEqual([
      "dingtalk-calendar",
      "dingtalk-tasks",
    ]);
  });

  it("expands ALL into default profiles", () => {
    process.env.DINGTALK_MCP_ACTIVE_PROFILES = "ALL";

    expect(getDingTalkMcpActiveProfiles()).toEqual([
      "dingtalk-contacts",
      "dingtalk-department",
      "dingtalk-calendar",
      "dingtalk-tasks",
      "dingtalk-teambition",
      "dingtalk-report",
    ]);
  });

  it("includes notice profile when message notification readback is enabled", () => {
    delete process.env.DINGTALK_MCP_ACTIVE_PROFILES;
    process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS = "1";

    expect(getDingTalkMcpActiveProfiles()).toEqual([
      "dingtalk-contacts",
      "dingtalk-department",
      "dingtalk-calendar",
      "dingtalk-tasks",
      "dingtalk-teambition",
      "dingtalk-report",
      "dingtalk-notice",
    ]);
  });

  it("only forwards minimal runtime and DingTalk variables to the MCP child", () => {
    const previous = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      DATABASE_URL: process.env.DATABASE_URL,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      DINGTALK_CLIENT_ID: process.env.DINGTALK_CLIENT_ID,
      DINGTALK_CLIENT_SECRET: process.env.DINGTALK_CLIENT_SECRET,
      DINGTALK_ROBOT_CODE: process.env.DINGTALK_ROBOT_CODE,
      DINGTALK_AGENT_ID: process.env.DINGTALK_AGENT_ID,
      DINGTALK_CORP_ID: process.env.DINGTALK_CORP_ID,
      DINGTALK_CORPID: process.env.DINGTALK_CORPID,
    };
    try {
      process.env.PATH = "/usr/bin";
      process.env.HOME = "/tmp/home";
      process.env.DATABASE_URL = "mysql://root:secret@example/helm";
      process.env.GITHUB_TOKEN = "github-secret";
      process.env.ANTHROPIC_API_KEY = "anthropic-secret";
      process.env.DINGTALK_CLIENT_ID = "client-id";
      process.env.DINGTALK_CLIENT_SECRET = "client-secret";
      process.env.DINGTALK_ROBOT_CODE = "robot-code";
      process.env.DINGTALK_AGENT_ID = "agent-id";
      process.env.DINGTALK_CORP_ID = "corp-id";
      delete process.env.DINGTALK_CORPID;

      const childEnv = buildMcpChildEnv();

      expect(childEnv.PATH).toBe("/usr/bin");
      expect(childEnv.HOME).toBe("/tmp/home");
      expect(childEnv.DATABASE_URL).toBeUndefined();
      expect(childEnv.GITHUB_TOKEN).toBeUndefined();
      expect(childEnv.ANTHROPIC_API_KEY).toBeUndefined();
      expect(childEnv.DINGTALK_CLIENT_ID).toBe("client-id");
      expect(childEnv.DINGTALK_CLIENT_SECRET).toBe("client-secret");
      expect(childEnv.DINGTALK_Client_ID).toBe("client-id");
      expect(childEnv.DINGTALK_Client_Secret).toBe("client-secret");
      expect(childEnv.ROBOT_CODE).toBe("robot-code");
      expect(childEnv.DINGTALK_AGENT_ID).toBe("agent-id");
      expect(childEnv.DINGTALK_CORP_ID).toBe("corp-id");
      expect(childEnv.DINGTALK_CORPID).toBe("corp-id");
      expect(childEnv.ACTIVE_PROFILES).toContain("dingtalk-contacts");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it("redacts secret-shaped stderr before it reaches UI-visible errors", () => {
    const stderr =
      "failed request clientSecret=client-secret access_token=token-value corpsecret=corp-secret Authorization: Bearer abcdef1234567890ghij";

    const out = formatMcpStderrForError(stderr);

    expect(out).not.toContain("client-secret");
    expect(out).not.toContain("token-value");
    expect(out).not.toContain("corp-secret");
    expect(out).not.toContain("abcdef1234567890ghij");
    expect(out).toContain("[redacted]");
  });
});
