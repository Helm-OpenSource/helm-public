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

  it("fails when restricted code imports the caio-governance contract", () => {
    sandbox = createFixture();
    for (const dir of ["lib/auth", "lib/policies", "lib/llm", "app/api"]) {
      mkdirSync(path.join(sandbox, dir), { recursive: true });
      writeFileSync(
        path.join(sandbox, dir, "leak.ts"),
        'import { deriveRuntimeAuthority } from "@/lib/caio-governance";\n',
        "utf8",
      );
    }
    const violations = checkCaioTerminology(sandbox);
    for (const dir of ["lib/auth", "lib/policies", "lib/llm", "app/api"]) {
      expect(violations).toContainEqual({
        file: `${dir}/leak.ts`,
        reason:
          "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance",
      });
    }
    expect(violations).toHaveLength(4);
  });

  it("catches transitive dependencies laundered through barrel re-exports", () => {
    sandbox = createFixture();
    mkdirSync(path.join(sandbox, "lib", "bridge"), { recursive: true });
    mkdirSync(path.join(sandbox, "lib", "auth"), { recursive: true });
    // two-hop laundering: auth -> hop -> barrel -> caio-governance
    writeFileSync(
      path.join(sandbox, "lib", "bridge", "barrel.ts"),
      'export * from "@/lib/caio-governance";\n',
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "bridge", "hop.ts"),
      'export { deriveRuntimeAuthority } from "./barrel";\n',
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "auth", "consumer.ts"),
      'import { deriveRuntimeAuthority } from "@/lib/bridge/hop";\n',
      "utf8",
    );
    // a relative dynamic import also counts
    writeFileSync(
      path.join(sandbox, "lib", "auth", "lazy.ts"),
      'export const load = () => import("../bridge/barrel");\n',
      "utf8",
    );
    // unrestricted code may depend on the contract freely
    writeFileSync(
      path.join(sandbox, "lib", "reporting.ts"),
      'import "@/lib/caio-governance";\n',
      "utf8",
    );
    const violations = checkCaioTerminology(sandbox);
    expect(violations).toContainEqual({
      file: "lib/auth/consumer.ts",
      reason:
        "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance",
    });
    expect(violations).toContainEqual({
      file: "lib/auth/lazy.ts",
      reason:
        "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance",
    });
    expect(violations).toHaveLength(2);
  });

  it("covers server actions, route handlers, permission modules, and syntax variants", () => {
    sandbox = createFixture();
    const reason =
      "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance";
    const cases: ReadonlyArray<[string, string]> = [
      // additional restricted surfaces
      [
        "features/memory/actions.ts",
        'import "@/lib/caio-governance";\n',
      ],
      [
        "lib/memory/permissions.ts",
        'import "@/lib/caio-governance";\n',
      ],
      [
        "app/demo/start/route.ts",
        'import "@/lib/caio-governance";\n',
      ],
      // static syntax variants
      [
        "lib/auth/comment-import.ts",
        'export const p = import/*c*/("@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/comment-inside.ts",
        'export const p = import(/*c*/ "@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/template.ts",
        "export const p = import(`@/lib/caio-governance`);\n",
      ],
      [
        "lib/auth/double-slash.ts",
        'import "@//lib/caio-governance";\n',
      ],
      [
        "lib/auth/js-specifier.ts",
        'import "@/lib/bridge2/hop.js";\n',
      ],
    ];
    mkdirSync(path.join(sandbox, "lib", "bridge2"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "lib", "bridge2", "hop.ts"),
      'export * from "@/lib/caio-governance";\n',
      "utf8",
    );
    for (const [file, content] of cases) {
      mkdirSync(path.join(sandbox, path.dirname(file)), { recursive: true });
      writeFileSync(path.join(sandbox, file), content, "utf8");
    }
    const violations = checkCaioTerminology(sandbox);
    for (const [file] of cases) {
      expect(violations, file).toContainEqual({ file, reason });
    }
    expect(violations).toHaveLength(cases.length);
  });

  it("parses imports with the real AST: line comments, escapes, shadow pairs", () => {
    sandbox = createFixture();
    const reason =
      "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance";
    mkdirSync(path.join(sandbox, "lib", "auth"), { recursive: true });
    mkdirSync(path.join(sandbox, "lib", "shadow"), { recursive: true });
    // line comment between import and the parenthesis
    writeFileSync(
      path.join(sandbox, "lib", "auth", "line-comment.ts"),
      'export const p = import // comment\n("@/lib/caio-governance");\n',
      "utf8",
    );
    // unicode escape inside the specifier literal
    writeFileSync(
      path.join(sandbox, "lib", "auth", "escape.ts"),
      'export const p = import("@/lib/caio-gover\\u006eance");\n',
      "utf8",
    );
    // .js specifier with a harmless .js twin must still follow the .ts source
    writeFileSync(
      path.join(sandbox, "lib", "shadow", "hop.js"),
      "module.exports = {};\n",
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "shadow", "hop.ts"),
      'export * from "@/lib/caio-governance";\n',
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "auth", "shadowed.ts"),
      'import "@/lib/shadow/hop.js";\n',
      "utf8",
    );
    // allowJs: the .js twin of a server-action surface is firewalled too
    mkdirSync(path.join(sandbox, "features", "billing"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "features", "billing", "actions.js"),
      'require("@/lib/caio-governance");\n',
      "utf8",
    );
    const violations = checkCaioTerminology(sandbox);
    for (const file of [
      "lib/auth/line-comment.ts",
      "lib/auth/escape.ts",
      "lib/auth/shadowed.ts",
      "features/billing/actions.js",
    ]) {
      expect(violations, file).toContainEqual({ file, reason });
    }
    expect(violations).toHaveLength(4);
  });

  it("firewalls any use-server module and bundler shadow pairs", () => {
    sandbox = createFixture();
    const reason =
      "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance";
    // a Server Action file with a non-standard name is a restricted surface
    mkdirSync(path.join(sandbox, "features", "imports"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "features", "imports", "crm-actions.ts"),
      '"use server";\nimport "@/lib/caio-governance";\nexport async function act() {}\n',
      "utf8",
    );
    // module.require and import-equals are static loads too
    mkdirSync(path.join(sandbox, "lib", "auth"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "lib", "auth", "module-require.ts"),
      'declare const m: NodeModule;\nexport const p = m.require("@/lib/caio-governance");\n',
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "auth", "import-equals.ts"),
      'import governance = require("@/lib/caio-governance");\nexport { governance };\n',
      "utf8",
    );
    // .jsx specifier: the bundler resolves to the .tsx twin (which
    // re-exports the contract), never the harmless .ts sibling
    mkdirSync(path.join(sandbox, "lib", "shadow2"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "lib", "shadow2", "hop.ts"),
      "export const harmless = true;\n",
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "shadow2", "hop.tsx"),
      'export * from "@/lib/caio-governance";\n',
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "auth", "jsx-shadow.ts"),
      'import "@/lib/shadow2/hop.jsx";\n',
      "utf8",
    );
    // an ordinary module without a use-server directive stays unrestricted
    writeFileSync(
      path.join(sandbox, "lib", "plain-consumer.ts"),
      'import "@/lib/caio-governance";\n',
      "utf8",
    );
    const violations = checkCaioTerminology(sandbox);
    for (const file of [
      "features/imports/crm-actions.ts",
      "lib/auth/module-require.ts",
      "lib/auth/import-equals.ts",
      "lib/auth/jsx-shadow.ts",
    ]) {
      expect(violations, file).toContainEqual({ file, reason });
    }
    expect(violations).toHaveLength(4);
  });

  it("sees parenthesized/element-access require and .mts/.cts modules", () => {
    sandbox = createFixture();
    const reason =
      "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance";
    mkdirSync(path.join(sandbox, "lib", "auth"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "lib", "auth", "paren-require.ts"),
      'export const p = (require)("@/lib/caio-governance");\n',
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "auth", "paren-module-require.ts"),
      'declare const m: NodeModule;\nexport const p = (m.require)("@/lib/caio-governance");\n',
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "auth", "element-require.ts"),
      'declare const m: NodeModule;\nexport const p = m["require"]("@/lib/caio-governance");\n',
      "utf8",
    );
    // .mjs specifier resolving to a .mts twin that re-exports the contract
    mkdirSync(path.join(sandbox, "lib", "shadow3"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "lib", "shadow3", "hop.mts"),
      'export * from "@/lib/caio-governance";\n',
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "auth", "mjs-shadow.ts"),
      'import "@/lib/shadow3/hop.mjs";\n',
      "utf8",
    );
    // a .cts file inside a restricted root is itself a starting point
    writeFileSync(
      path.join(sandbox, "lib", "auth", "direct.cts"),
      'import governance = require("@/lib/caio-governance");\nexport { governance };\n',
      "utf8",
    );
    const violations = checkCaioTerminology(sandbox);
    for (const file of [
      "lib/auth/paren-require.ts",
      "lib/auth/paren-module-require.ts",
      "lib/auth/element-require.ts",
      "lib/auth/mjs-shadow.ts",
      "lib/auth/direct.cts",
    ]) {
      expect(violations, file).toContainEqual({ file, reason });
    }
    expect(violations).toHaveLength(5);
  });

  it("unwraps template keys and parenthesized static arguments", () => {
    sandbox = createFixture();
    const reason =
      "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance";
    mkdirSync(path.join(sandbox, "lib", "auth"), { recursive: true });
    const cases: ReadonlyArray<[string, string]> = [
      [
        "lib/auth/template-key.ts",
        'declare const m: NodeModule;\nexport const p = m[`require`]("@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/paren-key.ts",
        'declare const m: NodeModule;\nexport const p = m[("require")]("@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/paren-arg.ts",
        'export const p = require(("@/lib/caio-governance"));\n',
      ],
      [
        "lib/auth/paren-template-arg.ts",
        "export const p = import((`@/lib/caio-governance`));\n",
      ],
    ];
    for (const [file, content] of cases) {
      writeFileSync(path.join(sandbox, file), content, "utf8");
    }
    const violations = checkCaioTerminology(sandbox);
    for (const [file] of cases) {
      expect(violations, file).toContainEqual({ file, reason });
    }
    expect(violations).toHaveLength(cases.length);
  });

  it("sees through compile-time-transparent wrappers and new require", () => {
    sandbox = createFixture();
    const reason =
      "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance";
    mkdirSync(path.join(sandbox, "lib", "auth"), { recursive: true });
    const cases: ReadonlyArray<[string, string]> = [
      [
        "lib/auth/as-const-arg.ts",
        'export const p = require("@/lib/caio-governance" as const);\n',
      ],
      [
        "lib/auth/as-callee.ts",
        'export const p = (require as NodeRequire)("@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/non-null-callee.ts",
        'export const p = require!("@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/as-const-key.ts",
        'declare const m: NodeModule;\nexport const p = m["require" as const]("@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/as-import-arg.ts",
        'export const p = import("@/lib/caio-governance" as string);\n',
      ],
      [
        "lib/auth/new-require.js",
        'export const p = new require("@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/new-module-require.js",
        'export const p = new module.require("@/lib/caio-governance");\n',
      ],
      [
        "lib/auth/new-element-require.js",
        'export const p = new module["require"]("@/lib/caio-governance");\n',
      ],
    ];
    for (const [file, content] of cases) {
      writeFileSync(path.join(sandbox, file), content, "utf8");
    }
    const violations = checkCaioTerminology(sandbox);
    for (const [file] of cases) {
      expect(violations, file).toContainEqual({ file, reason });
    }
    expect(violations).toHaveLength(cases.length);
  });

  it("firewalls permission-family modules, JSDoc types, and triple-slash refs", () => {
    sandbox = createFixture();
    const reason =
      "authority firewall: permission, policy, LLM-runtime, and API code must not depend on lib/caio-governance";
    mkdirSync(path.join(sandbox, "lib", "extensions"), { recursive: true });
    // a permission execution module outside the four roots
    writeFileSync(
      path.join(sandbox, "lib", "extensions", "permission-access.ts"),
      'import "@/lib/caio-governance";\nexport const evaluate = () => true;\n',
      "utf8",
    );
    // a JSDoc type import inside a restricted-root JS module
    mkdirSync(path.join(sandbox, "lib", "auth"), { recursive: true });
    writeFileSync(
      path.join(sandbox, "lib", "auth", "jsdoc-type.js"),
      '/** @type {import("@/lib/caio-governance").CaioMandate} */\nexport const mandate = {};\n',
      "utf8",
    );
    // the TS 5.9 native @import tag is equivalent
    writeFileSync(
      path.join(sandbox, "lib", "auth", "jsdoc-import-tag.js"),
      '/** @import { CaioMandate } from "@/lib/caio-governance" */\nexport const mandate2 = {};\n',
      "utf8",
    );
    // a triple-slash path reference pointing into the contract
    mkdirSync(path.join(sandbox, "lib", "caio-governance"), {
      recursive: true,
    });
    writeFileSync(
      path.join(sandbox, "lib", "caio-governance", "types.ts"),
      "export type Placeholder = never;\n",
      "utf8",
    );
    writeFileSync(
      path.join(sandbox, "lib", "auth", "triple-slash.ts"),
      '/// <reference path="../caio-governance/types.ts" />\nexport const x = 1;\n',
      "utf8",
    );
    const violations = checkCaioTerminology(sandbox);
    for (const file of [
      "lib/extensions/permission-access.ts",
      "lib/auth/jsdoc-type.js",
      "lib/auth/jsdoc-import-tag.js",
      "lib/auth/triple-slash.ts",
    ]) {
      expect(violations, file).toContainEqual({ file, reason });
    }
    expect(violations).toHaveLength(4);
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
