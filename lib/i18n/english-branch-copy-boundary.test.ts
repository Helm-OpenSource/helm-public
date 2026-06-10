import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const TARGET_FILES = [
  "features/meetings/actions.ts",
  "features/meetings/meeting-v2-runtime-card.tsx",
  "features/internal-operating-workspace/runtime-operator-panel.tsx",
  "features/settings/actions.ts",
  "features/memory/memory-client.tsx",
] as const;

const ENGLISH_BRANCH_PATTERNS: readonly RegExp[] = [
  /\b(?:session\.)?english\s*\?\s*"([^"]*[\u3400-\u9fff][^"]*)"/g,
  /\b(?:workspace\.)?defaultLocale\s*===\s*"en-US"\s*\?\s*"([^"]*[\u3400-\u9fff][^"]*)"/g,
];

function collectEnglishBranchHanStrings(filePath: string): string[] {
  const source = readFileSync(path.join(REPO_ROOT, filePath), "utf8");
  const matches: string[] = [];

  for (const pattern of ENGLISH_BRANCH_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      matches.push(`${filePath}: ${match[1] ?? ""}`);
    }
  }

  return matches;
}

describe("English branch copy boundary", () => {
  it("keeps English locale branches free of Chinese visible copy", () => {
    const leaks = TARGET_FILES.flatMap(collectEnglishBranchHanStrings);

    expect(leaks).toEqual([]);
  });
});
