import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupDuplicateBranches,
  parseWorktreePorcelain,
} from "./worktree-governance-audit.mjs";

describe("worktree governance audit helpers", () => {
  it("parses git worktree porcelain output", () => {
    const entries = parseWorktreePorcelain(`worktree /repo
HEAD aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
branch refs/heads/main

worktree /repo-feature
HEAD bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
branch refs/heads/codex/example

worktree /repo-stale
HEAD cccccccccccccccccccccccccccccccccccccccc
prunable gitdir file points to non-existent location
`);

    assert.equal(entries.length, 3);
    assert.equal(entries[0].branch, "main");
    assert.equal(entries[1].branch, "codex/example");
    assert.equal(entries[2].prunable, true);
    assert.equal(
      entries[2].prunableReason,
      "gitdir file points to non-existent location",
    );
  });

  it("detects duplicate active branch checkouts", () => {
    const duplicates = groupDuplicateBranches([
      { path: "/a", branch: "codex/demo", prunable: false },
      { path: "/b", branch: "codex/demo", prunable: false },
      { path: "/c", branch: "codex/other", prunable: false },
      { path: "/d", branch: "codex/demo", prunable: true },
    ]);

    assert.deepEqual(duplicates, [
      { branch: "codex/demo", paths: ["/a", "/b"] },
    ]);
  });
});
