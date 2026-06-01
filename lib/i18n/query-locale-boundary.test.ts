import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..", "..");
const scanRoots = ["data", "features", "lib"] as const;
const sourceExtensions = new Set([".ts", ".tsx"]);

const forbiddenQueryLayerLocaleMarkers = [
  "next/headers",
  "cookies(",
  "headers(",
  "UI_LOCALE_COOKIE",
  '"helm-ui-locale"',
  "'helm-ui-locale'",
  "resolveUiLocale(",
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

function isQueryLayerFile(relativePath: string) {
  return (
    relativePath.startsWith("data/") ||
    relativePath.endsWith("/queries.ts") ||
    relativePath.endsWith("/queries.tsx") ||
    relativePath.endsWith("/query.ts") ||
    relativePath.endsWith("/query.tsx") ||
    relativePath.includes("/queries/")
  );
}

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("query locale boundary", () => {
  it("keeps request cookie locale reads out of data and query modules", () => {
    const queryFiles = scanRoots
      .flatMap((scanRoot) => listSourceFiles(scanRoot))
      .filter(isQueryLayerFile);

    const offenders = queryFiles
      .flatMap((file) => {
        const source = read(file);
        return forbiddenQueryLayerLocaleMarkers
          .filter((marker) => source.includes(marker))
          .map((marker) => `${file} :: ${marker}`);
      })
      .sort();

    expect(offenders).toEqual([]);
  });
});
