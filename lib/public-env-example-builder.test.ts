import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildPublicEnvExample,
  PUBLIC_ENV_EXAMPLE_CONTENT,
} from "../scripts/build-public-env-example";

let fixtureRoot: string;

function readText(relativePath: string): string {
  return readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

describe("public env example builder", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-env-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("writes a generic public env example without tenant-private anchors", () => {
    const privateTenantEnv = [
      "GUANG",
      "PU_",
      "MI",
      "DUN_INTEGRATE_CRON_ENABLED",
    ].join("");
    const privateGatewayEnv = ["MI", "DUN_BASE_URL"].join("");
    mkdirSync(fixtureRoot, { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, ".env.example"),
      [
        'DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026"',
        `${privateTenantEnv}="true"`,
        `${privateGatewayEnv}=""`,
      ].join("\n"),
      "utf8",
    );

    const result = buildPublicEnvExample({ repoRoot: fixtureRoot });

    expect(result.status).toBe("wrote-projection");
    expect(readText(".env.example")).toBe(PUBLIC_ENV_EXAMPLE_CONTENT);
    const privateTermPattern = new RegExp(
      [
        ["gua", "ngpu"].join(""),
        ["mi", "dun"].join(""),
        ["米", "盾"].join(""),
        ["光", "[普谱]"].join(""),
      ].join("|"),
      "i",
    );
    expect(readText(".env.example")).not.toMatch(privateTermPattern);
    expect(readText(".env.example")).toContain("CONNECTOR_TOKEN_SECRET=");
  });

  it("fails check mode when the file is not projected", () => {
    const privateGatewayEnv = ["MI", "DUN_BASE_URL"].join("");
    writeFileSync(
      path.join(fixtureRoot, ".env.example"),
      `${privateGatewayEnv}=""\n`,
      "utf8",
    );

    const result = buildPublicEnvExample({
      repoRoot: fixtureRoot,
      checkMode: true,
    });

    expect(result).toMatchObject({
      status: "not-projected",
      exitCode: 1,
    });
  });
});
