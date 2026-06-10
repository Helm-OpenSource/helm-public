#!/usr/bin/env tsx
/**
 * lint-bilingual-mixing — fail-closed guard against zh/en "mixed copy" in
 * user-facing string literals.
 *
 * Helm's bilingual convention is "中文主文本 + English reference" as two
 * SEPARATE segments. The failure this guard catches is the opposite: an
 * untranslated latin fragment glued directly onto Chinese characters inside a
 * single user-facing string (e.g. `ai排序`, `llm决策`, `显式ly`, `正式write`).
 *
 * Design (calibrated against the real tree — wide matching had ~99% false
 * positives, so the rules are deliberately narrow):
 *   - Only string-literal CONTENTS are scanned. Code identifiers, comments,
 *     and import paths are never examined (they are not string literals).
 *   - Brand / technical tokens (Helm, GitHub, API, CRM, HSI, Stripe, …) are
 *     stripped before matching, so `你的Helm组织` and `objectId 不能为空` do
 *     not trip the rule. The dual-segment form `中文 / English reference` has
 *     whitespace around the slash, so it never produces gluing adjacency.
 *   - Block rule:
 *       mixed-glue   汉字 directly adjacent to a lowercase latin run
 *                    (len >= 2), after brand/tech tokens are stripped.
 *   - A `date-token` rule was prototyped and dropped: every real hit was a
 *     legitimate date-fns pattern (`format(date, "yyyy年M月d日", {locale})`),
 *     i.e. 100% false positive — exactly the proper localized formatting.
 *
 * Transition strategy ("freeze, then block"): existing hits are frozen in
 * lint-bilingual-mixing.baseline.json. The guard PASSES on the frozen set and
 * FAILS only on NEW (non-baseline) hits. Run with --update-baseline to
 * re-freeze after an intentional sweep; remove a line from the baseline to
 * tighten coverage as the backlog is cleared.
 *
 * Wire into:
 *   - .github/workflows/preflight.yml (fast PR feedback)
 *   - .github/workflows/ci.yml repo-guards job
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";

const ROOTS = ["app", "features", "components", "lib"];
const SKIP =
  /(node_modules|\.next|\.test\.|\.spec\.|__snapshots__|\.snap$|__fixtures__|\.stories\.|\/i18n\/.*-boundary)/;
const EXTENSIONS = new Set([".tsx", ".ts"]);

const BASELINE_FILE = path.join("scripts", "lint-bilingual-mixing.baseline.json");
const TOKENS_FILE = path.join("scripts", "lint-bilingual-mixing.tokens.json");

// Default brand / technical tokens stripped before matching. Extended by
// scripts/lint-bilingual-mixing.tokens.json (merged, case-insensitive).
const DEFAULT_TOKENS: ReadonlyArray<string> = [
  "Helm",
  "GitHub",
  "Apache",
  "Stripe",
  "Slack",
  "Docker",
  "Webhook",
  "Overlay",
  "Node",
  "Coze",
  "Cloud",
  "API",
  "CRM",
  "HSI",
  "SaaS",
  "B2B",
  "SLA",
  "OPC",
  "MVP",
  "ROI",
  "KPI",
  "OAuth",
  "WCAG",
  "JSON",
  "HTTP",
  "HTTPS",
  "SQL",
  "URL",
  "SDK",
  "CSV",
  "PDF",
  "MCP",
  "IMAP",
  "SMTP",
  "npm",
  "tsx",
  "env",
  "id",
];

const CJK = "\\u4e00-\\u9fff";
// 汉字 directly adjacent to a lowercase latin run (>= 2 chars), in either
// order. The lowercase requirement skips capitalized proper nouns (`中文English`).
const MIXED_GLUE_RE = new RegExp(`[${CJK}][a-z]{2,}|[a-z]{2,}[${CJK}]`);

type Violation = {
  file: string;
  line: number;
  rule: string;
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

async function readJsonArray(file: string): Promise<string[]> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as string[];
  } catch {
    return [];
  }
}

const LITERAL_RE = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;

// Extract user-facing string-literal contents from one line. Template
// `${...}` expressions are blanked so embedded code never reaches the rules.
function extractLiterals(line: string): string[] {
  const trimmed = line.trimStart();
  if (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    /^\s*(import|export)\b[^=]*\bfrom\b/.test(line)
  ) {
    return [];
  }
  const out: string[] = [];
  let match: RegExpExecArray | null;
  LITERAL_RE.lastIndex = 0;
  while ((match = LITERAL_RE.exec(line)) !== null) {
    const raw = match[1] ?? match[2] ?? match[3] ?? "";
    out.push(raw.replace(/\$\{[^}]*\}/g, " "));
  }
  return out;
}

function stripTokens(text: string, tokens: ReadonlyArray<string>): string {
  let out = text;
  for (const token of tokens) {
    out = out.replace(new RegExp(escapeRegExp(token), "gi"), " ");
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function classify(text: string, tokens: ReadonlyArray<string>): string | null {
  const stripped = stripTokens(text, tokens);
  if (MIXED_GLUE_RE.test(stripped)) return "mixed-glue";
  return null;
}

async function main() {
  const updateBaseline = process.argv.includes("--update-baseline");
  const tokens = [...DEFAULT_TOKENS, ...(await readJsonArray(TOKENS_FILE))];
  const baseline = new Set(await readJsonArray(BASELINE_FILE));

  const files: string[] = [];
  for (const root of ROOTS) files.push(...(await walk(root)));

  const all: Violation[] = [];
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const literal of extractLiterals(lines[i])) {
        const rule = classify(literal, tokens);
        if (!rule) continue;
        all.push({
          file,
          line: i + 1,
          rule,
          snippet: lines[i].trim().slice(0, 160),
        });
        break;
      }
    }
  }

  if (updateBaseline) {
    const keys = all.map((v) => `${v.file}:${v.line}`).sort();
    await fs.writeFile(BASELINE_FILE, `${JSON.stringify(keys, null, 2)}\n`);
    console.log(
      `lint:bilingual-mixing — wrote ${keys.length} baseline entr(ies) to ${BASELINE_FILE}`,
    );
    return;
  }

  const fresh = all.filter((v) => !baseline.has(`${v.file}:${v.line}`));

  if (fresh.length === 0) {
    console.log(
      `✓ lint:bilingual-mixing — no NEW zh/en mixed-copy violations ` +
        `(${all.length} total, ${baseline.size} frozen in baseline).`,
    );
    return;
  }

  console.error(
    `✗ lint:bilingual-mixing — found ${fresh.length} NEW zh/en mixed-copy violation(s):\n`,
  );
  for (const v of fresh) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]`);
    console.error(`    > ${v.snippet}`);
  }
  console.error(
    "\nHelm 双语约定：中文主文本 + English reference 为两个独立段落，" +
      "不要把未翻译的小写英文片段或日期格式 token 直接粘在汉字上。",
  );
  console.error(
    `如确属误判，可把品牌/术语加入 ${TOKENS_FILE}，` +
      `或在有意清理后运行 \`npm run check:bilingual-mixing:update\` 重建 baseline。`,
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("lint:bilingual-mixing failed:", error);
  process.exit(2);
});
