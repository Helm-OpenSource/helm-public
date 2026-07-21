import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  checkCaioTerminology,
  findForbiddenTerms,
  findForbiddenTermsInAnyForm,
  NAMED_ENTITIES,
} from "./check-caio-terminology";

const REPO_ROOT = path.resolve(__dirname, "..");

// The complete evidence surface the checker asserts over. Copying the real
// files gives every test a minimal valid fixture; each test then breaks
// exactly one condition and asserts the precise violation.
const FIXTURE_FILES = [
  "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
  "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.en.md",
  "docs/README.md",
  "docs/STATUS.md",
  "docs/public-docs-manifest.json",
  "scripts/check-caio-terminology.ts",
  "scripts/check-caio-terminology.test.ts",
  "package.json",
] as const;

function createFixture(): string {
  const sandbox = mkdtempSync(path.join(tmpdir(), "caio-terminology-"));
  for (const file of FIXTURE_FILES) {
    const target = path.join(sandbox, file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(REPO_ROOT, file), target);
  }
  return sandbox;
}

describe("findForbiddenTerms", () => {
  it("flags every legacy wording family including separator variants", () => {
    const samples = [
      "我们的 AI COO 产品",
      "AICOO console",
      "AI  COO with double space",
      "AI–COO with unicode dash",
      "ai_coo supervision direction",
      "数字 COO 驾驶舱",
      "数字COO",
      "数字-COO",
      "aicoo-foundation-sample-token",
      "aiCooSampleField",
      "AI·COO with a middle dot",
      "AI/COO with a slash",
      "AI (COO) with parentheses",
      "AI（COO）with fullwidth parentheses",
      "数字（COO）with fullwidth parentheses",
      "AI[COO] with brackets",
      // explicit delimiter table: every common ASCII/CJK delimiter must act
      // as a separator
      ...[
        "，",
        "。",
        "！",
        "？",
        "：",
        "；",
        "、",
        "{",
        "}",
        "【",
        "】",
        "〔",
        "〕",
        "「",
        "」",
        "『",
        "』",
        "〈",
        "〉",
        "《",
        "》",
        "!",
        "?",
        "%",
        "&",
        "#",
        "@",
        "^",
      ].map((delimiter) => `AI${delimiter}COO`),
      "AI **COO** in markdown emphasis",
      '"AI " + "COO" string concatenation',
      "brandHelmAICOO embedded token",
      "brandHelmAI-COO embedded with separator",
      "prefixaicooBinding embedded token",
      "the Chief AI Officer role",
      "the Chief Artificial Intelligence Officer role",
      "chief ai\nofficer across lines",
      // natural plurals
      "AI COOs",
      "数字 COOs",
      "Chief AI Officers",
      "Chief Artificial Intelligence Officers",
    ];
    for (const sample of samples) {
      expect(findForbiddenTerms(sample).length, sample).toBeGreaterThanOrEqual(
        1,
      );
    }
  });

  it("flags wording that only reassembles when markup is rendered", () => {
    const samples = [
      "<span>AI</span><span>COO</span>",
      "AI&nbsp;COO",
      "AI&#160;COO",
      "AI&#32;COO",
      "AI&#x20;COO",
      "AI&Tab;COO",
      "AI&MediumSpace;COO",
      "AI&ThickSpace;COO",
      "AI&NegativeThinSpace;COO",
      "AI&NegativeMediumSpace;COO",
      "AI&NegativeThickSpace;COO",
      "AI&NegativeVeryThinSpace;COO",
      "AI&ApplyFunction;COO",
      "AI&af;COO",
      "AI&InvisibleTimes;COO",
      "AI&it;COO",
      "AI&InvisibleComma;COO",
      "AI&ic;COO",
      "AI⁡COO with an invisible operator",
      "A؜I COO with an Arabic letter mark",
      'AI{" "}COO',
      'AI{"\\u0020"}COO',
      "AI{/* glue */}COO",
      'AI<span title=">"/>COO',
      "A​I COO with a zero-width space",
      "<b>AI</b> <i>COO</i>",
      "AI&ndash;COO",
      "AI&middot;COO",
      "数字&mdash;COO",
      "Chief&ThinSpace;AI&sol;Officer",
      "AI&lpar;COO&rpar;",
      "AI&lbrack;COO&rbrack;",
      "AI&lcub;COO&rcub;",
      // an entity name the table does not know still acts as a separator
      "AI&someunknownentity;COO",
      // HTML5 legacy references parse without a trailing semicolon
      "AI&nbspCOO",
      "AI&notCOO",
      "数字&middotCOO",
      // numeric character references also parse without a semicolon
      "AI&#32COO",
      "AI&#160COO",
      "AI&#9COO",
      "AI&#x20-COO",
      // out-of-range references decode to U+FFFD like an HTML parser
      "AI&#1114112;COO",
      "AI&#x110000;COO",
      "AI&#1114112COO",
      "AI&#x110000-COO",
      // markdown links keep their label; footnote markers vanish
      "[AI](./glossary) COOs",
      "Chief [AI](./glossary) Officers",
      "Chief [Artificial Intelligence](./glossary) Officer",
      "[AI][ai-glossary] COOs",
      "AI[^1] COO",
      // CommonMark link destinations with balanced parens, ")" in titles,
      // and <angle> destinations
      '[AI](https://en.wikipedia.org/wiki/Artificial_intelligence_(AI) "AI overview") COO',
      "[AI](https://example.com/search?q=(AI)report) COO",
      '[AI](./guide "phase ) two") COO',
      "[AI](<https://example.com/a)b>) COO",
      '[AI]( <https://example.com/a)b> "phase ) two" ) COO',
      "[AI](\n<https://example.com/a)b>) COO",
      "[AI](https://example.com/what's-new) COO",
      '[AI](https://example.com/what\'s-new "overview") COO',
    ];
    for (const name of Object.keys(NAMED_ENTITIES)) {
      samples.push(`AI&${name};COO`);
    }
    for (const sample of samples) {
      expect(
        findForbiddenTermsInAnyForm(sample).length,
        sample,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("accepts the frozen CAIO wording and unrelated content", () => {
    const samples = [
      "Helm CAIO｜一号位 AI 经营中枢",
      "Helm CAIO — the AI executive reporting to the CEO",
      "cooperationMaturity cookie COOKIE",
      "Founder / COO 视角",
      "chief officer of ai-free operations",
      "openai-cookbook reference",
      "Shanghai-cool venue",
      "AI-cooperation program",
    ];
    for (const sample of samples) {
      expect(findForbiddenTerms(sample), sample).toEqual([]);
    }
  });
});

describe("checkCaioTerminology against the real repository", () => {
  it("reports zero violations on the current tree", () => {
    expect(checkCaioTerminology(REPO_ROOT)).toEqual([]);
  });
});

describe("checkCaioTerminology fail-closed behavior", () => {
  let sandbox: string | null = null;

  afterEach(() => {
    if (sandbox !== null) {
      rmSync(sandbox, { recursive: true, force: true });
      sandbox = null;
    }
  });

  it("passes on an unmodified fixture", () => {
    sandbox = createFixture();
    expect(checkCaioTerminology(sandbox)).toEqual([]);
  });

  it("fails with per-file reasons when everything is missing", () => {
    sandbox = mkdtempSync(path.join(tmpdir(), "caio-terminology-"));
    const violations = checkCaioTerminology(sandbox);
    for (const file of [
      "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
      "docs/public-docs-manifest.json",
      "package.json",
    ]) {
      expect(
        violations.some(
          (violation) =>
            violation.file === file && violation.reason.includes("missing"),
        ),
        file,
      ).toBe(true);
    }
  });

  it("fails when a frozen governance token is removed from the ADR", () => {
    sandbox = createFixture();
    const adr = path.join(
      sandbox,
      "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
    );
    writeFileSync(
      adr,
      readFileSync(adr, "utf8").replace("汇报关系不等于授权关系", "汇报关系"),
      "utf8",
    );
    expect(checkCaioTerminology(sandbox)).toEqual([
      {
        file: "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
        reason: "required evidence token is missing: 汇报关系不等于授权关系",
      },
    ]);
  });

  it("fails when a legacy term is added to the budgeted ADR itself", () => {
    sandbox = createFixture();
    const adr = path.join(
      sandbox,
      "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
    );
    writeFileSync(
      adr,
      `${readFileSync(adr, "utf8")}\n附注：数字 COO 新表述。\n`,
      "utf8",
    );
    expect(checkCaioTerminology(sandbox)).toEqual([
      {
        file: "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
        reason:
          'legacy term budget mismatch for "数字 COO": expected raw 3 / rendered 3, found raw 4 / rendered 4',
      },
    ]);
  });

  it("fails when markup-assembled wording is added to the budgeted ADR", () => {
    sandbox = createFixture();
    const adr = path.join(
      sandbox,
      "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
    );
    writeFileSync(
      adr,
      `${readFileSync(adr, "utf8")}\n<span>AI</span><span>COO</span>\n`,
      "utf8",
    );
    expect(checkCaioTerminology(sandbox)).toEqual([
      {
        file: "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
        reason:
          'legacy term budget mismatch for "AI COO": expected raw 9 / rendered 9, found raw 9 / rendered 10',
      },
      {
        // the rendered join also trips the aicoo substring rule
        file: "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
        reason:
          'legacy term budget mismatch for "aicoo": expected raw 5 / rendered 5, found raw 5 / rendered 6',
      },
    ]);
  });

  it("fails when a budgeted file smuggles a NUL byte", () => {
    sandbox = createFixture();
    const adr = path.join(
      sandbox,
      "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
    );
    writeFileSync(
      adr,
      Buffer.concat([readFileSync(adr), Buffer.from([0])]),
    );
    expect(checkCaioTerminology(sandbox)).toContainEqual({
      file: "docs/product/HELM_CAIO_PRODUCT_AND_GOVERNANCE.md",
      reason: "text file contains a NUL byte; refusing to skip it as binary",
    });
  });

  it("fails when the aicoo token appears in a file path", () => {
    sandbox = createFixture();
    mkdirSync(path.join(sandbox, "lib", "aicoo-adapter"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "lib", "aicoo-adapter", "index.ts"),
      "export const clean = true;",
      "utf8",
    );
    expect(checkCaioTerminology(sandbox)).toEqual([
      {
        file: "lib/aicoo-adapter/index.ts",
        reason:
          "forbidden legacy term in file path: the aicoo machine namespace must not appear in public Core paths",
      },
    ]);
  });

  it("fails when new legacy wording enters an ordinary file", () => {
    sandbox = createFixture();
    writeFileSync(
      path.join(sandbox, "docs", "new-page.md"),
      "欢迎使用数字 COO 驾驶舱",
      "utf8",
    );
    expect(checkCaioTerminology(sandbox)).toEqual([
      {
        file: "docs/new-page.md",
        reason:
          "forbidden legacy term: 数字 COO (legacy customer-visible wording: use Helm CAIO instead)",
      },
    ]);
  });

  it("scans svg and extensionless files instead of skipping them", () => {
    sandbox = createFixture();
    mkdirSync(path.join(sandbox, "public"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "public", "banner.svg"),
      "<svg><text>AI COO</text></svg>",
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "Procfile"),
      "web: echo aicoo-sample",
      "utf8",
    );
    const violations = checkCaioTerminology(sandbox);
    expect(violations).toContainEqual({
      file: "public/banner.svg",
      reason:
        "forbidden legacy term: AI COO (legacy customer-visible wording: use Helm CAIO instead)",
    });
    expect(violations).toContainEqual({
      file: "Procfile",
      reason:
        "forbidden legacy term: aicoo (the historical aicoo machine namespace is owned by the private planes; public Core must not introduce it)",
    });
    // the bare aicoo token also legitimately trips the zero-separator AI COO
    // rule, so Procfile reports both families
    expect(violations).toHaveLength(3);
  });

  it("fails when the manifest is invalid JSON or drops the ADR", () => {
    sandbox = createFixture();
    const manifest = path.join(sandbox, "docs/public-docs-manifest.json");
    writeFileSync(manifest, "{not json", "utf8");
    expect(checkCaioTerminology(sandbox)).toContainEqual({
      file: "docs/public-docs-manifest.json",
      reason: "manifest is not valid JSON",
    });
    writeFileSync(manifest, JSON.stringify({ allowedDocs: [] }), "utf8");
    const violations = checkCaioTerminology(sandbox);
    expect(
      violations.some((violation) =>
        violation.reason.includes("public document is not allowlisted"),
      ),
    ).toBe(true);
  });

  it("fails when a text file smuggles a NUL byte", () => {
    sandbox = createFixture();
    writeFileSync(
      path.join(sandbox, "docs", "smuggle.md"),
      Buffer.concat([Buffer.from("AI COO"), Buffer.from([0])]),
    );
    expect(checkCaioTerminology(sandbox)).toContainEqual({
      file: "docs/smuggle.md",
      reason: "text file contains a NUL byte; refusing to skip it as binary",
    });
  });

  function mutatePackageScripts(
    root: string,
    mutate: (scripts: Record<string, string>) => void,
  ): void {
    const packagePath = path.join(root, "package.json");
    const manifest = JSON.parse(readFileSync(packagePath, "utf8")) as {
      scripts: Record<string, string>;
    };
    mutate(manifest.scripts);
    writeFileSync(packagePath, JSON.stringify(manifest, null, 2), "utf8");
  }

  it("fails when the gate command is weakened in any way", () => {
    const mutations = [
      "vitest run scripts/other.test.ts",
      "node --import tsx scripts/check-caio-terminology.ts",
      // marker substrings alone must not satisfy the frozen-command check
      "echo check-caio-terminology && echo vitest run",
    ];
    for (const mutation of mutations) {
      const root = createFixture();
      try {
        mutatePackageScripts(root, (scripts) => {
          scripts["check:caio-terminology"] = mutation;
        });
        expect(checkCaioTerminology(root), mutation).toEqual([
          {
            file: "package.json",
            reason:
              "check:caio-terminology script does not match the frozen gate command",
          },
        ]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("fails when check:boundaries is weakened in any way", () => {
    const mutate = (original: string): string[] => [
      original.replace(" && npm run check:caio-terminology", ""),
      // quoting and shell-comment tricks that merely CONTAIN the segment
      'echo "x && npm run check:caio-terminology && y"',
      ": # && npm run check:caio-terminology",
    ];
    const probeRoot = createFixture();
    const original = (
      JSON.parse(
        readFileSync(path.join(probeRoot, "package.json"), "utf8"),
      ) as { scripts: Record<string, string> }
    ).scripts["check:boundaries"];
    rmSync(probeRoot, { recursive: true, force: true });
    for (const mutation of mutate(original)) {
      const root = createFixture();
      try {
        mutatePackageScripts(root, (scripts) => {
          scripts["check:boundaries"] = mutation;
        });
        expect(checkCaioTerminology(root), mutation).toEqual([
          {
            file: "package.json",
            reason:
              "check:boundaries does not match the frozen boundary chain including the CAIO terminology gate",
          },
        ]);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  it("flags the aicoo token in binary asset paths too", () => {
    sandbox = createFixture();
    mkdirSync(path.join(sandbox, "public"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "public", "aicoo-banner.png"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]),
    );
    expect(checkCaioTerminology(sandbox)).toEqual([
      {
        file: "public/aicoo-banner.png",
        reason:
          "forbidden legacy term in file path: the aicoo machine namespace must not appear in public Core paths",
      },
    ]);
  });

  it("ignores gitignored working directories like .claude worktrees", () => {
    sandbox = createFixture();
    const worktree = path.join(sandbox, ".claude", "worktrees", "wt1");
    mkdirSync(worktree, { recursive: true });
    writeFileSync(
      path.join(worktree, "evil.md"),
      "数字 COO 副本不应参与扫描",
      "utf8",
    );
    expect(checkCaioTerminology(sandbox)).toEqual([]);
  });

  it("honors .gitignore via the git-defined scan surface", () => {
    sandbox = createFixture();
    execFileSync("git", ["init", "--quiet", sandbox]);
    writeFileSync(path.join(sandbox, ".gitignore"), "ignored-dir/\n", "utf8");
    const ignored = path.join(sandbox, "ignored-dir");
    mkdirSync(ignored, { recursive: true });
    writeFileSync(
      path.join(ignored, "evil.md"),
      "数字 COO 被忽略目录不应参与扫描",
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "visible.md"),
      "数字 COO 未忽略文件必须被扫描",
      "utf8",
    );
    const violations = checkCaioTerminology(sandbox);
    expect(
      violations.some((violation) => violation.file.startsWith("ignored-dir/")),
    ).toBe(false);
    expect(
      violations.some(
        (violation) =>
          violation.file === "visible.md" &&
          violation.reason.includes("forbidden legacy term"),
      ),
    ).toBe(true);
  });

  it("fails when an extensionless file smuggles a NUL byte", () => {
    sandbox = createFixture();
    writeFileSync(
      path.join(sandbox, "Procfile"),
      Buffer.concat([Buffer.from("web: echo aicoo-sample"), Buffer.from([0])]),
    );
    expect(checkCaioTerminology(sandbox)).toEqual([
      {
        file: "Procfile",
        reason: "text file contains a NUL byte; refusing to skip it as binary",
      },
    ]);
  });
});
