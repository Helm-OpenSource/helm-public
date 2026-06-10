import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const scanRoot = "app/api";
const sourceExtensions = new Set([".ts", ".tsx"]);

const rawLocaleResolverApiAllowList = new Set([
  "app/api/auth/dingtalk/callback/route.ts",
  "app/api/auth/feishu/callback/route.ts",
  "app/api/auth/wecom/callback/route.ts",
  "app/api/connectors/google/callback/route.ts",
  "app/api/connectors/hubspot/callback/route.ts",
  "app/api/connectors/salesforce/callback/route.ts",
  "app/api/public-auth/wecom/callback/route.ts",
]);

const requestLocaleCookieApiAllowList = new Set([
  "app/api/auth/dingtalk/callback/route.ts",
  "app/api/auth/feishu/callback/route.ts",
  "app/api/auth/wecom/callback/route.ts",
  "app/api/connectors/google/callback/route.ts",
  "app/api/connectors/hubspot/callback/route.ts",
  "app/api/connectors/salesforce/callback/route.ts",
]);

const connectorOauthCallbackRoutes = [
  "app/api/connectors/google/callback/route.ts",
  "app/api/connectors/hubspot/callback/route.ts",
  "app/api/connectors/salesforce/callback/route.ts",
] as const;

const requestLocaleCookieMarkers = [
  "UI_LOCALE_COOKIE",
  '"helm-ui-locale"',
  "'helm-ui-locale'",
] as const;

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

describe("api locale boundary", () => {
  it("keeps request locale cookie reads out of API routes", () => {
    const offenders = listSourceFiles(scanRoot)
      .filter((file) => {
        const source = read(file);
        return requestLocaleCookieMarkers.some((marker) => source.includes(marker));
      })
      .filter((file) => !requestLocaleCookieApiAllowList.has(file))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("keeps raw locale resolving limited to reviewed API state parsing", () => {
    const offenders = listSourceFiles(scanRoot)
      .filter((file) => read(file).includes("resolveUiLocale("))
      .filter((file) => !rawLocaleResolverApiAllowList.has(file))
      .sort();

    expect(offenders).toEqual([]);
  });

  it("keeps every API locale allowlist entry pointing at an existing source file", () => {
    const sourceFiles = new Set(listSourceFiles(scanRoot));
    const missing = [
      ...rawLocaleResolverApiAllowList,
      ...requestLocaleCookieApiAllowList,
    ]
      .filter((file) => !sourceFiles.has(file))
      .sort();

    expect(missing).toEqual([]);
  });

  it("keeps connector OAuth callbacks on request-locale governance messages", () => {
    for (const file of connectorOauthCallbackRoutes) {
      const source = read(file);

      expect(source).toContain("UI_LOCALE_COOKIE");
      expect(source).toContain("resolveUiLocale(");
      expect(source).toContain("english: requestEnglish");
      expect(source).not.toContain("english: true");
    }
  });
});
