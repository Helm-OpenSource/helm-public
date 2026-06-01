import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildPublicDockerignore,
  PUBLIC_DOCKERIGNORE_CONTENT,
} from "../scripts/build-public-dockerignore";

let fixtureRoot: string;

function readText(relativePath: string): string {
  return readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

describe("public dockerignore builder", () => {
  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "helm-public-dockerignore-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { force: true, recursive: true });
  });

  it("writes a generic public dockerignore without tenant-private anchors", () => {
    const privateTenantRoot = ["extensions", ["gua", "ngpu"].join("")].join("/");
    const privateAppRoot = [
      "app",
      "(workspace)",
      ["gua", "ngpu"].join(""),
      ["mi", "dun"].join(""),
    ].join("/");
    mkdirSync(fixtureRoot, { recursive: true });
    writeFileSync(
      path.join(fixtureRoot, ".dockerignore"),
      ["node_modules", privateTenantRoot, privateAppRoot].join("\n"),
      "utf8",
    );

    const result = buildPublicDockerignore({ repoRoot: fixtureRoot });

    expect(result.status).toBe("wrote-projection");
    expect(readText(".dockerignore")).toBe(PUBLIC_DOCKERIGNORE_CONTENT);
    const privateTermPattern = new RegExp(
      [
        ["gua", "ngpu"].join(""),
        ["mi", "dun"].join(""),
        ["米", "盾"].join(""),
        ["光", "[普谱]"].join(""),
      ].join("|"),
      "i",
    );
    expect(readText(".dockerignore")).not.toMatch(privateTermPattern);
  });

  it("fails check mode when the file is not projected", () => {
    const privateTenantRoot = ["extensions", ["gua", "ngpu"].join("")].join("/");
    writeFileSync(path.join(fixtureRoot, ".dockerignore"), `${privateTenantRoot}\n`, "utf8");

    const result = buildPublicDockerignore({
      repoRoot: fixtureRoot,
      checkMode: true,
    });

    expect(result).toMatchObject({
      status: "not-projected",
      exitCode: 1,
    });
  });
});
