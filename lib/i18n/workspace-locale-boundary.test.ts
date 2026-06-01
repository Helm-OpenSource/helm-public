import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");

const scanRoots = ["app/(workspace)", "features"] as const;

const rawResolveUiLocaleAllowList = new Set([
  "features/auth/actions.ts",
  "features/imports/actions.ts",
  "features/participant-portal/actions.ts",
  "features/programs/actions.ts",
  "features/settings/actions.ts",
  "features/trial/actions.ts",
]);

const sourceExtensions = new Set([".ts", ".tsx"]);

function isSourceFile(entry: string) {
  return (
    sourceExtensions.has(path.extname(entry)) &&
    !entry.endsWith(".test.ts") &&
    !entry.endsWith(".test.tsx")
  );
}

function listSourceFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(root, relativeDir);
  const entries = readdirSync(absoluteDir);
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry);
    const relativePath = path
      .relative(root, absolutePath)
      .replaceAll(path.sep, "/");
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...listSourceFiles(relativePath));
      continue;
    }

    if (stats.isFile() && isSourceFile(entry)) {
      files.push(relativePath);
    }
  }

  return files;
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("workspace locale fallback boundary", () => {
  it("keeps raw resolveUiLocale out of workspace pages and page loaders", () => {
    const files = scanRoots.flatMap((scanRoot) => listSourceFiles(scanRoot));
    const offenders = files
      .filter((file) => read(file).includes("resolveUiLocale("))
      .filter((file) => !rawResolveUiLocaleAllowList.has(file))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("keeps direct request-locale cookie reads on the same allowlist", () => {
    const files = scanRoots.flatMap((scanRoot) => listSourceFiles(scanRoot));
    const offenders = files
      .filter((file) => {
        const source = read(file);
        return (
          source.includes('"helm-ui-locale"') ||
          source.includes("UI_LOCALE_COOKIE")
        );
      })
      .filter((file) => !rawResolveUiLocaleAllowList.has(file))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("keeps deployment profile locale env reads centralized in the request helper", () => {
    const files = scanRoots.flatMap((scanRoot) => listSourceFiles(scanRoot));
    const offenders = files
      .filter((file) => read(file).includes("process.env.HELM_DEFAULT_LOCALE"))
      .sort();

    expect(offenders).toEqual([]);
  });
});
