import { promises as fs } from "node:fs";
import * as path from "node:path";

const ROOTS = ["app", "features", "components"];
const SKIP = /(node_modules|\.next|\.test\.|\.spec\.|__snapshots__|\.snap$)/;
const EXTENSIONS = new Set([".tsx", ".ts"]);

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "It tells you (元说明)", re: /\bIt tells you\b/i },
  {
    name: "This is not...It (元说明对比)",
    re: /\bThis is not\b[^.]{0,80}\b(It is|It tells|It surfaces|It reads)\b/i,
  },
  { name: "Every X has this shape (教学元说明)", re: /\bEvery [^.]{0,40}has this shape\b/i },
  { name: "Read this section like (教学指令)", re: /\bRead this section like\b/i },
  { name: "This section tells you (教学元说明)", re: /\bThis section tells you\b/i },
  { name: "把这里当成 (教学比喻)", re: /把这里当成/ },
  { name: "这里不是…而是 (对比解释)", re: /这里不是[^。]{0,50}而是/ },
  { name: "这是 X 不是 Y (对比解释)", re: /这[是不][^。]{0,30}而是/ },
  { name: "本节将/本章介绍/这一节会 (教学开场)", re: /(本节将|本章介绍|这一节会)/ },
  { name: "让我们来/让你知道/帮你了解 (教学话术)", re: /(让我们来|让你知道|帮你了解)/ },
];

const ALLOWLIST_FILE = path.join("scripts", "lint-teaching-copy.allowlist.json");

type Violation = {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
};

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (SKIP.test(full)) continue;
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

async function readAllowlist(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(ALLOWLIST_FILE, "utf8");
    const list = JSON.parse(raw) as string[];
    return new Set(list);
  } catch {
    return new Set();
  }
}

async function main() {
  const files: string[] = [];
  for (const root of ROOTS) {
    files.push(...(await walk(root)));
  }

  const allowlist = await readAllowlist();
  const violations: Violation[] = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const { name, re } of PATTERNS) {
        if (!re.test(lines[i])) continue;
        const key = `${file}:${i + 1}`;
        if (allowlist.has(key)) continue;
        violations.push({
          file,
          line: i + 1,
          pattern: name,
          snippet: lines[i].trim().slice(0, 160),
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log("✓ lint:teaching-copy — no D4 teaching-style violations found");
    return;
  }

  console.error(
    `✗ lint:teaching-copy — found ${violations.length} D4 teaching-style violation(s):\n`,
  );
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}  [${violation.pattern}]`);
    console.error(`    > ${violation.snippet}`);
  }
  console.error(
    "\nDESIGN.md §4.1: Helm 是服务系统，不是教育系统。",
  );
  console.error("直接给判断 / 动作 / 边界，不在 UI 解释自己是什么。");
  console.error(
    `如确属误判，可加入 ${ALLOWLIST_FILE}（"file:line" 形式数组），并在 PR 描述说明原因。`,
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("lint:teaching-copy failed:", error);
  process.exit(2);
});
