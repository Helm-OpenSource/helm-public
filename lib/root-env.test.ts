import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readEnvVarFromRootFiles } from "@/lib/root-env";

const tempRoots: string[] = [];

describe("readEnvVarFromRootFiles", () => {
  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop();
      if (root) {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("prefers .env.local over .env", () => {
    const root = createTempRoot();

    writeFileSync(path.join(root, ".env"), 'DATABASE_URL="file:./from-env.db"\n');
    writeFileSync(path.join(root, ".env.local"), 'DATABASE_URL="file:./from-local.db"\n');

    expect(
      readEnvVarFromRootFiles("DATABASE_URL", {
        projectRoot: root,
      }),
    ).toBe("file:./from-local.db");
  });

  it("strips quotes and ignores comments", () => {
    const root = createTempRoot();

    writeFileSync(
      path.join(root, ".env"),
      ['# comment', '', 'DATABASE_URL="file:./dev.db"', 'APP_URL="http://localhost:3000"'].join("\n"),
    );

    expect(
      readEnvVarFromRootFiles("DATABASE_URL", {
        projectRoot: root,
      }),
    ).toBe("file:./dev.db");
  });

  it("returns undefined when the variable is missing", () => {
    const root = createTempRoot();

    writeFileSync(path.join(root, ".env"), 'APP_URL="http://localhost:3000"\n');

    expect(
      readEnvVarFromRootFiles("DATABASE_URL", {
        projectRoot: root,
      }),
    ).toBeUndefined();
  });
});

function createTempRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), "helm-root-env-"));
  mkdirSync(root, { recursive: true });
  tempRoots.push(root);
  return root;
}
