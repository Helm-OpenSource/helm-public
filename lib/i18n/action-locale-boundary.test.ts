import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const scanRoot = "features";
const sourceExtensions = new Set([".ts", ".tsx"]);

const requestLocaleCookieMarkerActionAllowList = new Set([
  "features/auth/actions.ts",
  "features/settings/actions.ts",
]);

const rawLocaleResolverActionAllowList = new Set([
  "features/auth/actions.ts",
  "features/imports/actions.ts",
  "features/participant-portal/actions.ts",
  "features/programs/actions.ts",
  "features/settings/actions.ts",
  "features/trial/actions.ts",
]);

const requestLocaleCookieMarkers = [
  "UI_LOCALE_COOKIE",
  '"helm-ui-locale"',
  "'helm-ui-locale'",
] as const;

const requestLocaleCookieReadPattern =
  /(?:^|[^\w])get\(\s*(?:UI_LOCALE_COOKIE|["']helm-ui-locale["'])\s*\)/;

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

function isActionFile(relativePath: string) {
  return (
    relativePath.startsWith("features/") &&
    (relativePath.endsWith("/actions.ts") ||
      relativePath.endsWith("-actions.ts") ||
      relativePath.endsWith("/crm-actions.ts") ||
      relativePath.endsWith("/gtm-actions.ts"))
  );
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("action locale boundary", () => {
  it("keeps request locale cookie markers limited to explicitly reviewed action files", () => {
    const actionFiles = listSourceFiles(scanRoot).filter(isActionFile);
    const offenders = actionFiles
      .filter((file) => {
        const source = read(file);
        return requestLocaleCookieMarkers.some((marker) => source.includes(marker));
      })
      .filter((file) => !requestLocaleCookieMarkerActionAllowList.has(file))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("keeps action locale resolution off request cookie reads", () => {
    const actionFiles = listSourceFiles(scanRoot).filter(isActionFile);
    const offenders = actionFiles
      .filter((file) => requestLocaleCookieReadPattern.test(read(file)))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("keeps raw locale resolving limited to explicitly reviewed action files", () => {
    const actionFiles = listSourceFiles(scanRoot).filter(isActionFile);
    const offenders = actionFiles
      .filter((file) => read(file).includes("resolveUiLocale("))
      .filter((file) => !rawLocaleResolverActionAllowList.has(file))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("keeps every action locale allowlist entry pointing at an existing action file", () => {
    const actionFiles = new Set(listSourceFiles(scanRoot).filter(isActionFile));
    const allowListedFiles = new Set([
      ...requestLocaleCookieMarkerActionAllowList,
      ...rawLocaleResolverActionAllowList,
    ]);
    const missing = [...allowListedFiles]
      .filter((file) => !actionFiles.has(file))
      .sort();

    expect(missing).toEqual([]);
  });
});
