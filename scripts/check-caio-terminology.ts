#!/usr/bin/env tsx
// check-caio-terminology — terminology gate for the Helm CAIO product and
// governance ADR (docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md).
//
// Two jobs, both fail-closed:
//   1. Freeze the ADR: the frozen brand strings, governance invariants, the
//      maturity-axis (not permission-axis) statement, and the one-way legacy
//      display mapping must stay present in the ADR, STATUS baseline, docs
//      index, manifest allowlist, and package.json wiring. The package.json
//      gate command is frozen by exact equality, not marker substrings.
//   2. Ratchet legacy wording: helm-public has zero legacy `AI COO` /
//      `数字 COO` / `aicoo` occurrences outside the frozen budgets below, so
//      any new occurrence fails. Files that document the mapping itself (the
//      ADR pair and this checker pair) are not exempted wholesale: each
//      carries an exact per-term occurrence budget over BOTH the raw text and
//      its rendered projection, so adding one more legacy mention — plain or
//      markup-assembled — fails there too. The CAIO acronym is never
//      expanded.
//
// Scan scope: every source file except known-binary extensions and
// generated/build-output directories (.git, node_modules, .next, dist,
// build, coverage, ...). File paths themselves are scanned for the aicoo
// machine token. Every file is scanned twice: raw, and after a
// renderable-text normalization (strip HTML/JSX tags, decode entities and
// static JSX string expressions, drop markdown emphasis and Unicode format
// characters), so wording that only reassembles when rendered
// (AI&nbsp;COO, AI&#32;COO, AI{" "}COO, <span>AI</span><span>COO</span>,
// AI **COO**, A[U+200B]I COO) is still caught. A NUL byte inside ANY
// non-binary-extension file — budget files and extensionless files included
// — is itself a violation instead of a silent binary skip.
//
// This checker changes no permission, route, API, database, or execution
// state machine; passing it is a terminology statement, not a readiness or
// activation claim.

import { execFileSync } from "node:child_process";
import ts from "typescript";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

type Violation = {
  file: string;
  reason: string;
};

const ADR_FILE = "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md";
const ADR_EN_FILE = "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.en.md";

const REQUIRED_FILES = [
  ADR_FILE,
  ADR_EN_FILE,
  "scripts/check-caio-terminology.ts",
  "scripts/check-caio-terminology.test.ts",
] as const;

export type ForbiddenTermRule = {
  term: string;
  pattern: RegExp;
  reason: string;
};

// Separator between the words of a legacy term: ANY character that is not
// an ASCII letter/digit and not a CJK ideograph counts — whitespace,
// punctuation, brackets, dashes, quotes, entities decoded to symbols, and
// everything else. A negated class closes the whole "missing punctuation
// variant" family instead of enumerating separators one by one. CJK
// ideographs are excluded so ordinary prose like 数字化转型 cannot bridge
// into a false match.
const SEP = "[^A-Za-z0-9\\u4e00-\\u9fff]*";
const SEP_ONE = "[^A-Za-z0-9\\u4e00-\\u9fff]+";

export const FORBIDDEN_TERM_RULES: readonly ForbiddenTermRule[] = [
  {
    term: "AI COO",
    pattern: new RegExp(`(?<![A-Za-z0-9])AI${SEP}COOs?(?![A-Za-z])`, "giu"),
    reason: "legacy customer-visible wording: use Helm CAIO instead",
  },
  {
    // Embedded form with a real separator (brandHelmAI-COO): the leading
    // word boundary above would miss it, so require at least one separator
    // here and anchor on the preceding word character instead.
    term: "embedded AI COO",
    pattern: new RegExp(`(?<=[A-Za-z0-9])AI${SEP_ONE}COOs?(?![A-Za-z])`, "giu"),
    reason: "legacy wording embedded inside an identifier",
  },
  {
    term: "数字 COO",
    pattern: new RegExp(`数字${SEP}COOs?(?![A-Za-z])`, "giu"),
    reason: "legacy customer-visible wording: use Helm CAIO instead",
  },
  {
    // Deliberately unanchored: the machine token must have zero occurrences
    // in public Core, including embedded forms like brandHelmAICOO.
    term: "aicoo",
    pattern: /aicoo/giu,
    reason:
      "the historical aicoo machine namespace is owned by the private planes; public Core must not introduce it",
  },
  {
    term: "chief ai officer",
    pattern: new RegExp(
      `(?<![A-Za-z0-9])chief${SEP}(?:ai|artificial${SEP}intelligence)${SEP}officers?(?![A-Za-z])`,
      "giu",
    ),
    reason: "CAIO is never expanded as an English acronym",
  },
] as const;

export function countTermOccurrences(
  content: string,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const rule of FORBIDDEN_TERM_RULES) {
    rule.pattern.lastIndex = 0;
    const matches = content.match(rule.pattern);
    counts.set(rule.term, matches === null ? 0 : matches.length);
  }
  return counts;
}

export function findForbiddenTerms(content: string): string[] {
  const hits: string[] = [];
  const counts = countTermOccurrences(content);
  for (const rule of FORBIDDEN_TERM_RULES) {
    if ((counts.get(rule.term) ?? 0) > 0) {
      hits.push(`${rule.term} (${rule.reason})`);
    }
  }
  return hits;
}

// HTML named entities that render as whitespace or invisible characters.
// Entity names are case-sensitive in the HTML spec, so the lookup is exact.
// Invisible values are expressed as escapes; the later \p{Cf} pass erases
// the zero-width family after decoding.
export const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  Tab: "\t",
  NewLine: "\n",
  nbsp: "\u00a0",
  NonBreakingSpace: "\u00a0",
  ensp: "\u2002",
  emsp: "\u2003",
  emsp13: "\u2004",
  emsp14: "\u2005",
  numsp: "\u2007",
  puncsp: "\u2008",
  thinsp: "\u2009",
  ThinSpace: "\u2009",
  hairsp: "\u200a",
  VeryThinSpace: "\u200a",
  MediumSpace: "\u205f",
  ThickSpace: "\u205f\u200a",
  NegativeThinSpace: "\u200b",
  NegativeMediumSpace: "\u200b",
  NegativeThickSpace: "\u200b",
  NegativeVeryThinSpace: "\u200b",
  ApplyFunction: "\u2061",
  af: "\u2061",
  InvisibleTimes: "\u2062",
  it: "\u2062",
  InvisibleComma: "\u2063",
  ic: "\u2063",
  ZeroWidthSpace: "\u200b",
  zwnj: "\u200c",
  zwj: "\u200d",
  lrm: "\u200e",
  rlm: "\u200f",
  shy: "\u00ad",
  NoBreak: "\u2060",
  // Entities that decode to visible separator characters already covered by
  // the SEP class (dashes, dots, slashes, quotes, punctuation glue).
  ndash: "\u2013",
  mdash: "\u2014",
  hyphen: "\u2010",
  dash: "\u2010",
  horbar: "\u2015",
  minus: "\u2212",
  middot: "\u00b7",
  centerdot: "\u00b7",
  CenterDot: "\u00b7",
  bull: "\u2022",
  bullet: "\u2022",
  sol: "/",
  bsol: "\\",
  verbar: "|",
  vert: "|",
  VerticalLine: "|",
  quot: '"',
  QUOT: '"',
  apos: "'",
  grave: "`",
  DiacriticalGrave: "`",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  OpenCurlyQuote: "\u2018",
  CloseCurlyQuote: "\u2019",
  OpenCurlyDoubleQuote: "\u201c",
  CloseCurlyDoubleQuote: "\u201d",
  rdquor: "\u201d",
  rsquor: "\u2019",
  lowbar: "_",
  UnderBar: "_",
  comma: ",",
  period: ".",
  colon: ":",
  semi: ";",
  plus: "+",
  equals: "=",
  ast: "*",
  midast: "*",
};

function decodeStringEscapes(literal: string): string {
  return literal
    .replace(/\\u\{([0-9a-fA-F]+)\}/gu, (whole, code: string) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isNaN(parsed) || parsed > 0x10ffff
        ? whole
        : String.fromCodePoint(parsed);
    })
    .replace(/\\u([0-9a-fA-F]{4})/gu, (_whole, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/\\x([0-9a-fA-F]{2})/gu, (_whole, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    )
    .replace(/\\[ntr]/gu, " ");
}


// Minimal CommonMark inline-link collapser: keeps the label, drops the
// destination and title. Understands <angle> destinations, balanced
// parentheses in destinations, backslash escapes, and quoted titles that
// may themselves contain ")".
export function collapseInlineLinks(content: string): string {
  let out = "";
  let i = 0;
  while (i < content.length) {
    const open = content.indexOf("[", i);
    if (open === -1) {
      out += content.slice(i);
      break;
    }
    const close = content.indexOf("]", open);
    if (close === -1) {
      out += content.slice(i);
      break;
    }
    if (content[close + 1] !== "(") {
      out += content.slice(i, close + 1);
      i = close + 1;
      continue;
    }
    let j = close + 2;
    // CommonMark permits whitespace (including one newline) before the
    // destination
    while (j < content.length && /\s/u.test(content[j])) {
      j += 1;
    }
    if (content[j] === "<") {
      const end = content.indexOf(">", j);
      j = end === -1 ? content.length : end + 1;
    } else {
      // Bare destination: runs to whitespace (the title boundary) or the
      // closing ")" at balance zero. Quotes are ordinary destination
      // characters here (https://example.com/what's-new); titles only start
      // after whitespace and are handled below.
      let depth = 0;
      while (j < content.length) {
        const ch = content[j];
        if (ch === "\\") {
          j += 2;
          continue;
        }
        if (/\s/u.test(ch)) break;
        if (ch === "(") {
          depth += 1;
        } else if (ch === ")") {
          if (depth === 0) break;
          depth -= 1;
        }
        j += 1;
      }
    }
    while (j < content.length && content[j] !== ")") {
      const ch = content[j];
      if (ch === '"' || ch === "'") {
        const endQuote = content.indexOf(ch, j + 1);
        if (endQuote === -1) {
          j = content.length;
          break;
        }
        j = endQuote + 1;
      } else {
        j += 1;
      }
    }
    if (j < content.length && content[j] === ")") {
      out += content.slice(i, open) + content.slice(open + 1, close);
      i = j + 1;
    } else {
      out += content.slice(i, close + 1);
      i = close + 1;
    }
  }
  return out;
}

// Approximates how markup renders to a reader: JSX comments and HTML/JSX
// tags (including quoted attributes that contain ">") disappear, numeric
// and named whitespace entities decode, static JSX string expressions
// ({" "}, {" "}) collapse to their decoded literal value, markdown
// emphasis characters and all Unicode format characters (category Cf:
// zero-width space, invisible operators, directional marks, ...) drop out.
// Scanning this projection catches legacy wording that only reassembles at
// render time.
export function normalizeRenderableText(content: string): string {
  return collapseInlineLinks(
    content
      // markdown: footnote markers vanish, reference links keep their label
      .replace(/\[\^[^\]]*\]/gu, "")
      .replace(/\[([^\]]*)\]\[[^\]]*\]/gu, "$1"),
  )
    .replace(/\{\s*\/\*[^]*?\*\/\s*\}/gu, "")
    .replace(/<[^>"']*(?:"[^"]*"[^>"']*|'[^']*'[^>"']*)*>/gu, "")
    .replace(/\{\s*["'`]([^"'`{}]*)["'`]\s*\}/gu, (_whole, literal: string) =>
      decodeStringEscapes(literal),
    )
    // Out-of-range values decode to U+FFFD exactly like an HTML parser,
    // never back to the raw digits (which would bridge the SEP class).
    .replace(/&#(\d+);?/gu, (_whole, code: string) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isNaN(parsed) || parsed > 0x10ffff
        ? "\ufffd"
        : String.fromCodePoint(parsed);
    })
    .replace(/&#x([0-9a-f]+);?/giu, (_whole, code: string) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isNaN(parsed) || parsed > 0x10ffff
        ? "\ufffd"
        : String.fromCodePoint(parsed);
    })
    .replace(
      /&([A-Za-z][A-Za-z0-9]*);/gu,
      (_whole, name: string) => NAMED_ENTITIES[name] ?? "\ufffd",
    )
    // HTML5 legacy named references that parse WITHOUT a trailing semicolon
    // (the finite spec-defined set, symbol-valued members only). All decode
    // to non-alphanumeric characters, so a separator placeholder suffices.
    .replace(
      /&(?:AMP|amp|COPY|copy|GT|gt|LT|lt|QUOT|quot|REG|reg|nbsp|iexcl|cent|pound|curren|yen|brvbar|sect|uml|ordf|laquo|not|shy|macr|deg|plusmn|sup[123]|acute|micro|para|middot|cedil|ordm|raquo|frac1[24]|frac34|iquest|times|divide)/gu,
      "\ufffd",
    )
    .replace(/\p{Cf}/gu, "")
    .replace(/[*_`~]/gu, "");
}

export function findForbiddenTermsInAnyForm(content: string): string[] {
  const hits = new Set<string>(findForbiddenTerms(content));
  for (const hit of findForbiddenTerms(normalizeRenderableText(content))) {
    hits.add(hit);
  }
  return [...hits];
}

type TermBudget = Readonly<Record<string, { raw: number; rendered: number }>>;

// Exact frozen occurrence counts for the only files that may mention legacy
// wording (they document the compatibility mapping itself). Counts are exact
// over both the raw text and its rendered projection: adding OR removing a
// legacy mention — plain or markup-assembled — requires updating this budget
// in the same review.
const LEGACY_TERM_BUDGETS: ReadonlyArray<{
  file: string;
  budget: TermBudget;
}> = [
  {
    file: ADR_FILE,
    budget: {
      "AI COO": { raw: 9, rendered: 9 },
      "embedded AI COO": { raw: 0, rendered: 0 },
      "数字 COO": { raw: 3, rendered: 3 },
      aicoo: { raw: 5, rendered: 5 },
      "chief ai officer": { raw: 0, rendered: 0 },
    },
  },
  {
    file: ADR_EN_FILE,
    budget: {
      "AI COO": { raw: 5, rendered: 5 },
      "embedded AI COO": { raw: 0, rendered: 0 },
      "数字 COO": { raw: 1, rendered: 1 },
      aicoo: { raw: 4, rendered: 4 },
      "chief ai officer": { raw: 0, rendered: 0 },
    },
  },
  {
    // This checker names the legacy terms in order to forbid them.
    file: "scripts/check-caio-terminology.ts",
    budget: {
      "AI COO": { raw: 24, rendered: 11 },
      "embedded AI COO": { raw: 1, rendered: 0 },
      "数字 COO": { raw: 6, rendered: 1 },
      aicoo: { raw: 12, rendered: 5 },
      "chief ai officer": { raw: 5, rendered: 0 },
    },
  },
  {
    // Negative-path fixtures exercising the forbidden patterns.
    file: "scripts/check-caio-terminology.test.ts",
    budget: {
      "AI COO": { raw: 37, rendered: 87 },
      "embedded AI COO": { raw: 1, rendered: 1 },
      "数字 COO": { raw: 12, rendered: 14 },
      aicoo: { raw: 21, rendered: 37 },
      "chief ai officer": { raw: 4, rendered: 7 },
    },
  },
];

const LEGACY_BUDGET_FILES: ReadonlySet<string> = new Set(
  LEGACY_TERM_BUDGETS.map((entry) => entry.file),
);

// Known-binary extensions are skipped; everything else is scanned.
const BINARY_EXTENSIONS: ReadonlySet<string> = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".icns",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".node",
  ".wasm",
  ".jar",
  ".class",
]);

const SKIP_DIRECTORIES: ReadonlySet<string> = new Set([
  ".git",
  ".claude",
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "playwright-report",
  "test-results",
  ".vercel",
]);

// OS junk files that legitimately contain NUL bytes and carry no content.
const SKIP_FILES: ReadonlySet<string> = new Set([".DS_Store", "Thumbs.db"]);

// Collects EVERY file (binary included) so path-level rules see the full
// tree; content-type filtering happens at the consumer.
function walkFiles(repoRoot: string, relativeDir: string, out: string[]): void {
  const absoluteDir = path.join(repoRoot, relativeDir);
  for (const entry of readdirSync(absoluteDir)) {
    const relativePath = relativeDir === "" ? entry : `${relativeDir}/${entry}`;
    const absolutePath = path.join(repoRoot, relativePath);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      if (!SKIP_DIRECTORIES.has(entry)) {
        walkFiles(repoRoot, relativePath, out);
      }
      continue;
    }
    if (!SKIP_FILES.has(entry)) {
      out.push(relativePath);
    }
  }
}

// The scan surface is what the repository actually delivers: tracked plus
// untracked-but-not-ignored files, as Git defines them. This keeps ignored
// working directories (.claude worktrees, node_modules, build output) out
// of the gate. Fixture sandboxes without a .git directory fall back to a
// filesystem walk with the same skip rules.
function listDeliverableFiles(repoRoot: string): string[] {
  try {
    const output = execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      {
        cwd: repoRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    return output
      .split("\0")
      .filter((file) => file !== "")
      .filter((file) => !SKIP_FILES.has(path.basename(file)))
      .filter((file) => existsSync(path.join(repoRoot, file)));
  } catch {
    const files: string[] = [];
    walkFiles(repoRoot, "", files);
    return files;
  }
}

// The exact gate and boundary-chain commands. Frozen by equality so quoting
// tricks, shell comments, or an `echo` that merely contains the marker
// substrings cannot satisfy the wiring self-check. Extending
// check:boundaries requires updating this constant in the same review.
const EXPECTED_GATE_COMMAND =
  "node --import tsx scripts/check-caio-terminology.ts && vitest run scripts/check-caio-terminology.test.ts --config vitest.public.config.ts";

const EXPECTED_BOUNDARIES_COMMAND =
  "npm run public:smoke:static && npm run check:golden-path-docs && npm run check:source-profiler-boundaries && npm run check:diagnostics-risk && npm run check:llm-candidate-boundaries && npm run check:recoverable-agent-runtime && npm run check:agentic-sarp && npm run check:work-unit-governance && npm run check:ai-shelf-trust-center-contract && npm run check:stage1-owner-loop && npm run check:caio-terminology";

// The ADR's frozen sentences. Tokens are kept short enough to survive manual
// re-wrapping but specific enough that weakening the governance meaning
// requires touching this gate in the same review.
const REQUIRED_TOKENS: ReadonlyArray<{
  file: string;
  tokens: readonly string[];
}> = [
  {
    file: ADR_FILE,
    tokens: [
      "Helm CAIO｜一号位 AI 经营中枢",
      "企业首席 AI 高管，直属并只向 CEO 汇报",
      "Helm CAIO — the AI executive reporting to the CEO",
      "不作英文缩写展开",
      "汇报关系不等于授权关系",
      "法律与政策约束、人员同意、监护急停 > CEO 指令 > CAIO 建议",
      "不从既有 owner approval 继承",
      "建议不等于承诺",
      "成熟度轴，不是权限轴",
      "formed | next_layer | roadmap_disabled",
      "不构成执行许可",
      "监护角色可以紧急停止 CAIO，但不能恢复；恢复权仅属于 CEO",
      "结构化拒绝、暂停和申诉",
      "任务暂停，只升级 CEO 裁决",
      "不是公司法意义上的自然人高管",
      "不授予任何系统写权限或外部副作用权限",
      "不是权限令牌",
      "单向展示映射",
      "机器标识保持不变",
      "`WorkspaceRole.OWNER` 不等价",
      "纯类型与确定性验证器切片已交付",
      "禁止依赖它",
    ],
  },
  {
    file: ADR_EN_FILE,
    tokens: [
      "Helm CAIO — the AI executive reporting to the CEO",
      "never expanded as an English acronym",
      "a reporting line is not an authority grant",
      "never a commitment",
      "not a permission enum",
      "roadmap, unauthorized, disabled by default",
      "must fail validation, never be rewritten",
      "metadata registration only",
    ],
  },
  {
    file: "docs/STATUS.md",
    tokens: [
      "Helm CAIO 术语与治理 ADR",
      "已成形但仍需下一层：品牌冻结为「Helm CAIO｜一号位 AI 经营中枢」",
      "纯类型与确定性验证器契约切片已成形",
      "产品面与运行层仍由后续切片交付",
      "成熟度轴而非权限轴",
      "Orchestrate 与 Authorized Execute 为路线图且默认关闭",
      "不改变任何权限、路由、API、数据库、执行状态机或既有机器标识",
    ],
  },
  {
    file: "docs/README.md",
    tokens: ["product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md"],
  },
];


// ---------------------------------------------------------------------------
// Authority firewall: static import-graph reachability.
// ---------------------------------------------------------------------------

const RESTRICTED_IMPORT_PREFIXES = [
  "lib/auth/",
  "lib/policies/",
  "lib/llm/",
  "app/api/",
] as const;

// Beyond the directory roots, every server action, route handler,
// permission module, and the middleware are permission / side-effect
// surfaces and equally firewalled.
function isRestrictedSurface(file: string): boolean {
  if (RESTRICTED_IMPORT_PREFIXES.some((prefix) => file.startsWith(prefix))) {
    return true;
  }
  // allowJs is on, so the .js/.jsx/.mjs/.cjs twins of every surface are
  // firewalled too.
  const base = path.posix.basename(file);
  const stem = base.replace(/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/u, "");
  const hasSourceExtension = stem !== base;
  if (!hasSourceExtension) {
    return false;
  }
  if (stem === "actions" || stem === "action") {
    return true;
  }
  // Any module in the permission family (permissions.ts,
  // permission-access.ts, permission-manifest.ts, ...) is a permission
  // execution surface.
  if (stem.includes("permission")) {
    return true;
  }
  if (file.startsWith("app/") && stem === "route") {
    return true;
  }
  return stem === "middleware" && !file.includes("/");
}

const FIREWALL_TARGET_PREFIX = "lib/caio-governance";

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

// Extracts import / export-from / require / dynamic-import specifiers via
// the TypeScript AST: comments in any position, unicode escapes inside the
// literal (\u006e), and template-literal specifiers are all handled by the
// real parser instead of a regex. Specifiers with ${ } interpolation are
// runtime construction (declared residual risk) and yield no static value.
type ModuleFacts = {
  specifiers: string[];
  // true when the module (or any function in it) carries a "use server"
  // directive — i.e. it defines Server Actions regardless of its filename.
  usesServerDirective: boolean;
};

function collectModuleFacts(file: string, content: string): ModuleFacts {
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") || file.endsWith(".jsx")
      ? ts.ScriptKind.TSX
      : ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  let usesServerDirective = false;
  // Unwraps every compile-time-transparent wrapper (parentheses, as-
  // expressions, old-style type assertions, satisfies, non-null "!") — they
  // all erase at emit, so require("x" as const) is a plain static load.
  const unwrapTransparent = (node: ts.Node): ts.Node => {
    let current: ts.Node = node;
    while (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
      current = current.expression;
    }
    return current;
  };
  // Reads any static string value — string literals and no-substitution
  // template literals alike — through transparent wrappers, so
  // require(("x")), import((`x`)), and m[`require`] all resolve.
  const literalText = (node: ts.Node): string | null => {
    const unwrapped = unwrapTransparent(node);
    return ts.isStringLiteral(unwrapped) ||
      ts.isNoSubstitutionTemplateLiteral(unwrapped)
      ? unwrapped.text
      : null;
  };
  const visit = (node: ts.Node): void => {
    // JSDoc trees are not visited by forEachChild; walk them explicitly so
    // /** @type {import("x").T} */ dependencies enter the graph too.
    const jsDocs = (node as { jsDoc?: readonly ts.Node[] }).jsDoc;
    if (jsDocs !== undefined) {
      for (const doc of jsDocs) {
        ts.forEachChild(doc, visit);
      }
    }
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined
    ) {
      const text = literalText(node.moduleSpecifier);
      if (text !== null) {
        specifiers.push(text);
      }
    } else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      // `new require("x")` is a legal Node.js static load too.
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const callee = unwrapTransparent(node.expression);
      const isRequire =
        (ts.isIdentifier(callee) && callee.text === "require") ||
        (ts.isPropertyAccessExpression(callee) &&
          callee.name.text === "require") ||
        (ts.isElementAccessExpression(callee) &&
          literalText(callee.argumentExpression) === "require");
      const firstArgument = node.arguments?.[0];
      if ((isDynamicImport || isRequire) && firstArgument !== undefined) {
        const text = literalText(firstArgument);
        if (text !== null) {
          specifiers.push(text);
        }
      }
    } else if (ts.isJSDocImportTag(node)) {
      // TS 5.9 native JSDoc form: /** @import { T } from "x" */
      const text = literalText(node.moduleSpecifier);
      if (text !== null) {
        specifiers.push(text);
      }
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (
        ts.isLiteralTypeNode(argument) &&
        ts.isStringLiteral(argument.literal)
      ) {
        specifiers.push(argument.literal.text);
      }
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const text = literalText(node.moduleReference.expression);
      if (text !== null) {
        specifiers.push(text);
      }
    } else if (
      ts.isExpressionStatement(node) &&
      ts.isStringLiteral(node.expression) &&
      node.expression.text === "use server"
    ) {
      // Directive-position statements only ever appear at prologue slots;
      // matching any string-literal expression statement is a safe
      // over-approximation.
      usesServerDirective = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  // Triple-slash path references are static file dependencies as well.
  for (const reference of sourceFile.referencedFiles) {
    const fileName = reference.fileName;
    specifiers.push(
      fileName.startsWith(".") || fileName.startsWith("@/")
        ? fileName
        : `./${fileName}`,
    );
  }
  return { specifiers, usesServerDirective };
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.includes("${")) {
    return null; // runtime-constructed specifier (residual risk)
  }
  if (specifier.startsWith("@/")) {
    // Tolerate redundant slashes: @//lib/x resolves like @/lib/x.
    return path.posix.normalize(specifier.slice(2)).replace(/^\/+/u, "");
  }
  if (specifier.startsWith(".")) {
    return path.posix.normalize(
      path.posix.join(path.posix.dirname(fromFile), specifier),
    );
  }
  return null; // external package
}

// Extension-aware candidate order mirroring TypeScript bundler
// resolution: a JS-flavored specifier maps to its TS twin first
// (.js->.ts/.tsx, .jsx->.tsx, .mjs->.mts, .cjs->.cts), and extensionless
// specifiers try the TS family, declarations, then JS.
const EXTENSION_TWINS: Readonly<Record<string, readonly string[]>> = {
  ".js": [".ts", ".tsx", ".js"],
  ".jsx": [".tsx", ".jsx"],
  ".mjs": [".mts", ".mjs"],
  ".cjs": [".cts", ".cjs"],
};

const BARE_EXTENSION_ORDER = [
  ".ts",
  ".tsx",
  ".d.ts",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const;

function moduleCandidates(normalized: string): string[] {
  const extension = path.posix.extname(normalized).toLowerCase();
  const twins = EXTENSION_TWINS[extension];
  if (twins !== undefined) {
    const stripped = normalized.slice(0, -extension.length);
    return twins.map((twin) => `${stripped}${twin}`);
  }
  const candidates: string[] = [normalized];
  for (const ext of BARE_EXTENSION_ORDER) {
    candidates.push(`${normalized}${ext}`);
  }
  for (const ext of BARE_EXTENSION_ORDER) {
    candidates.push(`${normalized}/index${ext}`);
  }
  return candidates;
}

// Prefer the repo's real TypeScript resolver (moduleResolution: bundler,
// paths) when a tsconfig is available; fixture sandboxes without one fall
// back to the manual candidate order above.
function createModuleResolver(
  repoRoot: string,
): (fromFile: string, specifier: string) => string | null {
  let options: ts.CompilerOptions | null = null;
  try {
    const configPath = path.join(repoRoot, "tsconfig.json");
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error === undefined && config.config !== undefined) {
      options = ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        repoRoot,
      ).options;
    }
  } catch {
    options = null;
  }
  if (options === null) {
    return () => null;
  }
  const compilerOptions = options;
  return (fromFile, specifier) => {
    const resolution = ts.resolveModuleName(
      specifier,
      path.join(repoRoot, fromFile),
      compilerOptions,
      ts.sys,
    ).resolvedModule;
    if (resolution === undefined) {
      return null;
    }
    const relative = path
      .relative(repoRoot, resolution.resolvedFileName)
      .split(path.sep)
      .join("/");
    return relative.startsWith("..") ? null : relative;
  };
}

// BFS from every file under a restricted root: if the static import graph
// can reach lib/caio-governance, the firewall is breached — no matter how
// many barrel re-export hops sit in between.
function findAuthorityFirewallViolations(
  repoRoot: string,
  files: readonly string[],
): Violation[] {
  const fileSet = new Set(files);
  const sourceFiles = files.filter((file) =>
    SOURCE_EXTENSIONS.includes(path.extname(file).toLowerCase()),
  );

  const resolveWithTs = createModuleResolver(repoRoot);
  const isTarget = (candidate: string): boolean =>
    candidate === FIREWALL_TARGET_PREFIX ||
    candidate.startsWith(`${FIREWALL_TARGET_PREFIX}/`);
  const edges = new Map<
    string,
    { targets: string[]; hitsTarget: boolean; usesServerDirective: boolean }
  >();
  for (const file of sourceFiles) {
    const content = read(repoRoot, file);
    if (content === null) {
      continue;
    }
    const facts = collectModuleFacts(file, content);
    const targets: string[] = [];
    let hitsTarget = false;
    for (const specifier of facts.specifiers) {
      const normalized = resolveSpecifier(file, specifier);
      if (normalized !== null && isTarget(normalized)) {
        hitsTarget = true;
        continue;
      }
      // The repo's real TypeScript resolver decides shadow pairs and
      // package.json entries; the manual candidate order is the fixture
      // fallback.
      const resolved = resolveWithTs(file, specifier);
      if (resolved !== null) {
        if (isTarget(resolved)) {
          hitsTarget = true;
        } else if (fileSet.has(resolved)) {
          targets.push(resolved);
        }
        continue;
      }
      if (normalized === null) {
        continue;
      }
      for (const candidate of moduleCandidates(normalized)) {
        if (fileSet.has(candidate)) {
          targets.push(candidate);
          break;
        }
      }
    }
    edges.set(file, {
      targets,
      hitsTarget,
      usesServerDirective: facts.usesServerDirective,
    });
  }

  const violations: Violation[] = [];
  for (const file of sourceFiles) {
    if (
      !isRestrictedSurface(file) &&
      edges.get(file)?.usesServerDirective !== true
    ) {
      continue;
    }
    const queue = [file];
    const seen = new Set<string>(queue);
    let reachesTarget = false;
    while (queue.length > 0 && !reachesTarget) {
      const current = queue.pop() as string;
      const node = edges.get(current);
      if (node === undefined) {
        continue;
      }
      if (node.hitsTarget) {
        reachesTarget = true;
        break;
      }
      for (const next of node.targets) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    if (reachesTarget) {
      violations.push({
        file,
        reason:
          "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance",
      });
    }
  }
  return violations;
}

function read(repoRoot: string, file: string): string | null {
  const absolutePath = path.join(repoRoot, file);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : null;
}

export function checkCaioTerminology(repoRoot = process.cwd()): Violation[] {
  const violations: Violation[] = [];

  for (const file of REQUIRED_FILES) {
    if (!existsSync(path.join(repoRoot, file))) {
      violations.push({ file, reason: "required file is missing" });
    }
  }

  for (const requirement of REQUIRED_TOKENS) {
    const content = read(repoRoot, requirement.file);
    if (content === null) {
      violations.push({
        file: requirement.file,
        reason: "required evidence file is missing",
      });
      continue;
    }
    for (const token of requirement.tokens) {
      if (!content.includes(token)) {
        violations.push({
          file: requirement.file,
          reason: `required evidence token is missing: ${token}`,
        });
      }
    }
  }

  const files = listDeliverableFiles(repoRoot);
  for (const file of files) {
    // Path rule runs on every file, binary payloads included.
    if (/aicoo/iu.test(file)) {
      violations.push({
        file,
        reason:
          "forbidden legacy term in file path: the aicoo machine namespace must not appear in public Core paths",
      });
    }
    if (BINARY_EXTENSIONS.has(path.extname(file).toLowerCase())) {
      continue;
    }
    const raw = readFileSync(path.join(repoRoot, file));
    if (raw.includes(0)) {
      // Everything reaching this point claims to be text (binary extensions
      // are excluded above), so a NUL byte is always a violation — known
      // text extension, unknown extension, or no extension at all.
      violations.push({
        file,
        reason: "text file contains a NUL byte; refusing to skip it as binary",
      });
      continue;
    }
    if (LEGACY_BUDGET_FILES.has(file)) {
      continue; // scanned against its exact budget below
    }
    for (const hit of findForbiddenTermsInAnyForm(raw.toString("utf8"))) {
      violations.push({
        file,
        reason: `forbidden legacy term: ${hit}`,
      });
    }
  }

  // Authority firewall (ADR §3): the permission/policy engine, governed
  // LLM runtime, and API surface must never depend on the CAIO governance
  // contract — a CaioMandate is not an authorization token. Checked as
  // static import-graph reachability, so barrel files and multi-hop
  // re-exports cannot launder the dependency.
  for (const violation of findAuthorityFirewallViolations(repoRoot, files)) {
    violations.push(violation);
  }

  for (const entry of LEGACY_TERM_BUDGETS) {
    const content = read(repoRoot, entry.file);
    if (content === null) {
      continue; // already reported as a missing required file
    }
    const rawCounts = countTermOccurrences(content);
    const renderedCounts = countTermOccurrences(
      normalizeRenderableText(content),
    );
    for (const rule of FORBIDDEN_TERM_RULES) {
      const budget = entry.budget[rule.term] ?? { raw: 0, rendered: 0 };
      const raw = rawCounts.get(rule.term) ?? 0;
      const rendered = renderedCounts.get(rule.term) ?? 0;
      if (raw !== budget.raw || rendered !== budget.rendered) {
        violations.push({
          file: entry.file,
          reason: `legacy term budget mismatch for "${rule.term}": expected raw ${budget.raw} / rendered ${budget.rendered}, found raw ${raw} / rendered ${rendered}`,
        });
      }
    }
  }

  const manifestContent = read(repoRoot, "docs/public-docs-manifest.json");
  if (manifestContent === null) {
    violations.push({
      file: "docs/public-docs-manifest.json",
      reason: "required evidence file is missing",
    });
  } else {
    try {
      const manifest = JSON.parse(manifestContent) as { allowedDocs?: unknown };
      const allowedDocs = Array.isArray(manifest.allowedDocs)
        ? manifest.allowedDocs
        : [];
      for (const file of [ADR_FILE, ADR_EN_FILE]) {
        if (!allowedDocs.includes(file)) {
          violations.push({
            file: "docs/public-docs-manifest.json",
            reason: `public document is not allowlisted: ${file}`,
          });
        }
      }
    } catch {
      violations.push({
        file: "docs/public-docs-manifest.json",
        reason: "manifest is not valid JSON",
      });
    }
  }

  const packageContent = read(repoRoot, "package.json");
  if (packageContent === null) {
    violations.push({
      file: "package.json",
      reason: "required evidence file is missing",
    });
  } else {
    try {
      const packageJson = JSON.parse(packageContent) as {
        scripts?: Record<string, string>;
      };
      const scripts = packageJson.scripts ?? {};
      if (scripts["check:caio-terminology"] !== EXPECTED_GATE_COMMAND) {
        violations.push({
          file: "package.json",
          reason:
            "check:caio-terminology script does not match the frozen gate command",
        });
      }
      if (scripts["check:boundaries"] !== EXPECTED_BOUNDARIES_COMMAND) {
        violations.push({
          file: "package.json",
          reason:
            "check:boundaries does not match the frozen boundary chain including the CAIO terminology gate",
        });
      }
    } catch {
      violations.push({
        file: "package.json",
        reason: "package.json is invalid",
      });
    }
  }

  return violations;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const violations = checkCaioTerminology();
  if (violations.length > 0) {
    console.error("caio-terminology: FAIL");
    for (const violation of violations) {
      console.error(`- ${violation.file}: ${violation.reason}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      "caio-terminology: PASS - the CAIO ADR is frozen and no new legacy wording entered public Core; this is a terminology statement, not production readiness",
    );
  }
}
