/**
 * repo-split-execute 安全/可复现性测试（Step 4B 放行前置）。
 *
 * 覆盖 reviewer Required changes：参数校验、写盘安全护栏、symlink/特殊文件不外带、
 * dry-run 不写盘、--force-clean 仅清理已校验目录。全部用仓外临时目录，绝不动 repo。
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  assertSafeOutDir,
  buildPlan,
  canonicalize,
  copyTree,
  countCopyableFiles,
  isStrictlyInside,
  newCopyStats,
  parseArgs,
  resolveRepoRoot,
  runExecute,
} from "./repo-split-execute";

const REPO_ROOT = resolveRepoRoot(resolve(__dirname));
let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "helm-split-test-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("parseArgs", () => {
  it("无参数 → dry-run", () => {
    const r = parseArgs([]);
    expect(r).toMatchObject({ ok: true, dryRun: true, out: null });
  });
  it("--dry-run 显式 → dry-run", () => {
    expect(parseArgs(["--dry-run"])).toMatchObject({ ok: true, dryRun: true });
  });
  it("--out 缺值 → fail fast（不静默 dry-run）", () => {
    const r = parseArgs(["--out"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("--out");
  });
  it("--out 后接另一个 flag → fail fast", () => {
    expect(parseArgs(["--out", "--force-clean"]).ok).toBe(false);
  });
  it("未知参数 → fail fast", () => {
    const r = parseArgs(["--bogus"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("未知参数");
  });
  it("--out <dir> → write 模式", () => {
    expect(parseArgs(["--out", "/tmp/x"])).toMatchObject({ ok: true, dryRun: false, out: "/tmp/x" });
  });
  it("--dry-run 优先于 --out（即便给了 out 也只预览）", () => {
    expect(parseArgs(["--out", "/tmp/x", "--dry-run"])).toMatchObject({ ok: true, dryRun: true });
  });
  it("--force-clean 无 --out → fail fast", () => {
    expect(parseArgs(["--force-clean"]).ok).toBe(false);
  });
  it("--out=foo 形式", () => {
    expect(parseArgs(["--out=/tmp/x"])).toMatchObject({ ok: true, out: "/tmp/x", dryRun: false });
  });
});

describe("isStrictlyInside", () => {
  it("子目录在内", () => expect(isStrictlyInside("/a", "/a/b")).toBe(true));
  it("相等不算内部", () => expect(isStrictlyInside("/a", "/a")).toBe(false));
  it("兄弟目录不在内", () => expect(isStrictlyInside("/a", "/b")).toBe(false));
  it("前缀字符串但非子路径不在内", () => expect(isStrictlyInside("/a", "/ab")).toBe(false));
});

describe("assertSafeOutDir", () => {
  const cwd = "/cwd";
  it("拒绝 out == repo root", () => {
    const r = assertSafeOutDir({ out: "/repo", repoRoot: "/repo", cwd, forceClean: false });
    expect(r.ok).toBe(false);
  });
  it("拒绝 out 在 repo root 内部", () => {
    const r = assertSafeOutDir({ out: "/repo/staging", repoRoot: "/repo", cwd, forceClean: false });
    expect(r.ok).toBe(false);
  });
  it("拒绝 repo root 在 out 内部（out 是 repo 的父目录）", () => {
    const r = assertSafeOutDir({ out: "/parent", repoRoot: "/parent/repo", cwd, forceClean: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("repo root 位于 --out 内部");
  });
  it("拒绝文件系统根", () => {
    expect(assertSafeOutDir({ out: "/", repoRoot: "/repo", cwd, forceClean: false }).ok).toBe(false);
  });
  it("仓外不存在目录 → ok 且返回 canonical 绝对路径", () => {
    const out = join(tmp, "fresh");
    const r = assertSafeOutDir({ out, repoRoot: REPO_ROOT, cwd, forceClean: false });
    expect(r.ok).toBe(true);
    // assertSafeOutDir returns a CANONICAL path (realpath of nearest existing
    // ancestor + missing tail). Compare against canonicalize(), NOT lexical
    // resolve() — otherwise this is red on platforms where tmp is a symlink
    // (macOS: /var → /private/var, /tmp → /private/tmp).
    if (r.ok) expect(r.outDir).toBe(canonicalize(out));
  });
  it("仓外空目录 → ok", () => {
    const r = assertSafeOutDir({ out: tmp, repoRoot: REPO_ROOT, cwd, forceClean: false });
    expect(r.ok).toBe(true);
  });
  it("仓外非空目录无 --force-clean → 拒绝", () => {
    writeFileSync(join(tmp, "keep.txt"), "x");
    const r = assertSafeOutDir({ out: tmp, repoRoot: REPO_ROOT, cwd, forceClean: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("--force-clean");
  });
  it("仓外非空目录 + --force-clean → ok", () => {
    writeFileSync(join(tmp, "old.txt"), "x");
    const r = assertSafeOutDir({ out: tmp, repoRoot: REPO_ROOT, cwd, forceClean: true });
    expect(r.ok).toBe(true);
  });
  it("相对 out 相对 cwd 解析（不存在路径按 lexical 处理）", () => {
    const r = assertSafeOutDir({ out: "rel/dir", repoRoot: "/repo", cwd: "/cwd", forceClean: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.outDir).toBe("/cwd/rel/dir");
  });
  it("out 为指向仓外真实目录的 symlink → 解析后通过（canonical target 在仓外）", () => {
    const real = join(tmp, "real");
    const link = join(tmp, "link");
    mkdirSync(real);
    symlinkSync(real, link);
    const r = assertSafeOutDir({ out: link, repoRoot: REPO_ROOT, cwd, forceClean: false });
    // canonicalize follows the link to tmp/real (outside repo) → safe.
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.outDir).toBe(realpathSync(real));
  });
});

describe("canonicalize + symlink/alias bypass resistance（Required change 2）", () => {
  const cwd = "/cwd";
  it("canonicalize resolves the nearest existing ancestor and re-appends the missing tail", () => {
    const base = realpathSync(tmp);
    const out = join(tmp, "does", "not", "exist", "yet");
    expect(canonicalize(out)).toBe(join(base, "does", "not", "exist", "yet"));
  });

  it("canonicalize unmasks a symlinked ancestor", () => {
    const real = join(tmp, "realdir");
    const link = join(tmp, "linkdir");
    mkdirSync(real);
    symlinkSync(real, link);
    // out is UNDER the symlinked dir but does not exist yet.
    const out = join(link, "child");
    expect(canonicalize(out)).toBe(join(realpathSync(real), "child"));
  });

  it("rejects --out that reaches INTO the repo via a symlink alias", () => {
    // A symlink in tmp that points back inside the real repo root.
    const insideRepoTarget = join(REPO_ROOT, "scripts");
    const link = join(tmp, "sneaky");
    symlinkSync(insideRepoTarget, link);
    // Even though `link` lexically lives in /tmp, its realpath is inside the repo.
    const r = assertSafeOutDir({ out: link, repoRoot: REPO_ROOT, cwd, forceClean: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/repo root 内部|位于 repo root/);
  });

  it("rejects --out under a symlinked ancestor that resolves inside the repo", () => {
    const link = join(tmp, "repo-alias");
    symlinkSync(REPO_ROOT, link); // link → real repo root
    const out = join(link, "staging"); // not-yet-existing child under the alias
    const r = assertSafeOutDir({ out, repoRoot: REPO_ROOT, cwd, forceClean: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/repo root 内部|位于 repo root/);
  });

  it("treats a repo addressed via a symlink alias as equal to the canonical repo root", () => {
    // repoRoot passed in via a symlink alias; out == the SAME repo by realpath.
    const repoAlias = join(tmp, "repo-link");
    symlinkSync(REPO_ROOT, repoAlias);
    const r = assertSafeOutDir({ out: repoAlias, repoRoot: REPO_ROOT, cwd, forceClean: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/等于 repo root|位于 repo root 内部/);
  });
});

describe("countCopyableFiles / copyTree（不跟随 symlink）", () => {
  it("统计常规文件，跳过 symlink，与 copy 同口径", () => {
    const src = join(tmp, "src");
    mkdirSync(join(src, "sub"), { recursive: true });
    writeFileSync(join(src, "a.txt"), "a");
    writeFileSync(join(src, "sub", "b.txt"), "b");
    symlinkSync(join(src, "a.txt"), join(src, "link.txt"));
    expect(countCopyableFiles(src)).toBe(2);

    const dest = join(tmp, "dest");
    const stats = newCopyStats();
    copyTree(src, dest, stats);
    expect(stats.copied).toBe(2);
    expect(stats.skippedSymlink).toBe(1);
    expect(existsSync(join(dest, "a.txt"))).toBe(true);
    expect(existsSync(join(dest, "sub", "b.txt"))).toBe(true);
    // symlink 不应被带出
    expect(existsSync(join(dest, "link.txt"))).toBe(false);
  });
});

describe("runExecute (integration)", () => {
  it("dry-run（无 out）不写盘", () => {
    const probe = join(tmp, "should-not-appear");
    const r = runExecute([], { repoRoot: REPO_ROOT, cwd: tmp });
    expect(r.exitCode).toBe(0);
    expect(r.dryRun).toBe(true);
    expect(existsSync(probe)).toBe(false);
    expect(r.lines.join("\n")).toContain("DRY-RUN");
  });
  it("--out 缺值 → 非零退出", () => {
    expect(runExecute(["--out"], { repoRoot: REPO_ROOT, cwd: tmp }).exitCode).not.toBe(0);
  });
  it("--out 指向 repo 内部 → 非零退出", () => {
    const inside = join(REPO_ROOT, "tmp-staging-should-reject");
    const r = runExecute(["--out", inside], { repoRoot: REPO_ROOT, cwd: tmp });
    expect(r.exitCode).not.toBe(0);
    expect(existsSync(inside)).toBe(false);
  });
  it("--out == repo root → 非零退出", () => {
    expect(runExecute(["--out", REPO_ROOT], { repoRoot: REPO_ROOT, cwd: tmp }).exitCode).not.toBe(0);
  });
  it("非空 out 无 --force-clean → 非零退出", () => {
    writeFileSync(join(tmp, "keep.txt"), "x");
    expect(runExecute(["--out", tmp], { repoRoot: REPO_ROOT, cwd: tmp }).exitCode).not.toBe(0);
  });
  it("--force-clean 仓外旧目录 → 成功并物化、清掉旧文件", () => {
    const out = join(tmp, "staging");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "STALE.txt"), "stale");
    const r = runExecute(["--out", out, "--force-clean"], { repoRoot: REPO_ROOT, cwd: tmp });
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(out, "STALE.txt"))).toBe(false);
    // 至少 helm-packs 或 helm-overlays 暂存目录之一被生成
    const made = readdirSync(out);
    expect(made.some((d) => d === "helm-packs" || d === "helm-overlays")).toBe(true);
    expect(r.copy && r.copy.copied).toBeGreaterThan(0);
  });
  it("生成的 staging package.json 把 @helm/core / @helm/pack-sdk 声明为 optional peer（可独立 install）", () => {
    const out = join(tmp, "staging-peer");
    const r = runExecute(["--out", out, "--force-clean"], { repoRoot: REPO_ROOT, cwd: tmp });
    expect(r.exitCode).toBe(0);

    // 至少一个暂存仓被物化；对每个被物化的仓校验 optional peer metadata。
    const made = readdirSync(out).filter((d) => d === "helm-packs" || d === "helm-overlays");
    expect(made.length).toBeGreaterThan(0);

    for (const repo of made) {
      const pkgPath = join(out, repo, "package.json");
      expect(existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
      // future peer 契约仍在
      expect(pkg.peerDependencies).toMatchObject({
        "@helm/core": "*",
        "@helm/pack-sdk": "*",
      });
      // 两个 peer 都被标记为 optional，避免 npm install --package-lock-only 拉私有包 E404
      expect(pkg.peerDependenciesMeta).toMatchObject({
        "@helm/core": { optional: true },
        "@helm/pack-sdk": { optional: true },
      });
    }
  });
  it("buildPlan 只含 helm-packs / helm-overlays（不夸大范围）", () => {
    const { plan } = buildPlan(REPO_ROOT);
    for (const row of plan) {
      expect(["helm-packs", "helm-overlays"]).toContain(row.target);
    }
  });
});
