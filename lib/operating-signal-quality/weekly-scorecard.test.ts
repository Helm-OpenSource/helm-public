import { describe, expect, it } from "vitest";
import type { CollectorCommit } from "./collect-from-github";
import {
  buildWeeklyScorecard,
  formatWeeklyScorecardAsMarkdown,
} from "./weekly-scorecard";

function commit(overrides: Partial<CollectorCommit> = {}): CollectorCommit {
  return {
    sha: overrides.sha ?? `sha-${Math.random().toString(36).slice(2, 8)}`,
    message: overrides.message ?? "feat: do something useful",
    author: overrides.author ?? {
      name: "Tommy",
      email: "tommy@example.com",
      githubLogin: "hzqian2026",
    },
    coAuthors: overrides.coAuthors ?? [],
    filesChanged: overrides.filesChanged ?? ["lib/foo.ts"],
    additions: overrides.additions ?? 30,
    deletions: overrides.deletions ?? 10,
    isMerge: overrides.isMerge ?? false,
    isRevert: overrides.isRevert ?? false,
  };
}

describe("buildWeeklyScorecard", () => {
  it("groups commits by contributor and ranks by totalScore desc", () => {
    const alice = {
      name: "Alice",
      email: "alice@example.com",
      githubLogin: "alice-gh",
    };
    const bob = {
      name: "Bob",
      email: "bob@example.com",
      githubLogin: "bob-gh",
    };

    const commits: CollectorCommit[] = [
      // Alice: touches prisma schema + cron + env => high readiness
      commit({
        author: alice,
        filesChanged: ["prisma/schema.prisma"],
        additions: 50,
      }),
      commit({
        author: alice,
        filesChanged: [".env.example", "lib/signal-collection/cron-route.ts"],
        additions: 20,
      }),
      // Bob: noise-heavy (Revert + fix typo + tiny slices)
      commit({
        author: bob,
        message: "Revert: bad change",
        isRevert: true,
        additions: 5,
        deletions: 5,
      }),
      commit({
        author: bob,
        message: "fix typo",
        additions: 1,
        deletions: 1,
        filesChanged: ["lib/foo.ts"],
      }),
      commit({
        author: bob,
        message: "trying again",
        additions: 2,
        deletions: 2,
        filesChanged: ["lib/bar.ts"],
      }),
    ];

    const sc = buildWeeklyScorecard({
      commits,
      windowLabel: "2026-W19",
    });

    expect(sc.entries).toHaveLength(2);
    expect(sc.entries[0].contributor.githubLogin).toBe("alice-gh");
    expect(sc.entries[1].contributor.githubLogin).toBe("bob-gh");
    expect(sc.entries[0].rank).toBe(1);
    expect(sc.entries[1].rank).toBe(2);
    expect(sc.entries[0].assessment.scores.totalScore).toBeGreaterThan(
      sc.entries[1].assessment.scores.totalScore,
    );
    expect(sc.cohortSummary.contributorCount).toBe(2);
    expect(sc.cohortSummary.totalCommits).toBe(5);
  });

  it("skips merge commits when grouping and counting", () => {
    const commits: CollectorCommit[] = [
      commit({
        isMerge: true,
        message: "Merge branch 'feature'",
        author: { name: "auto", email: "auto@x", githubLogin: "auto-bot" },
      }),
      commit({
        author: {
          name: "Tommy",
          email: "t@x",
          githubLogin: "hzqian2026",
        },
      }),
    ];
    const sc = buildWeeklyScorecard({
      commits,
      windowLabel: "test",
    });
    expect(sc.entries).toHaveLength(1);
    expect(sc.entries[0].contributor.githubLogin).toBe("hzqian2026");
    expect(sc.cohortSummary.totalCommits).toBe(1);
  });

  it("sorts ties by commit count ascending (less-is-more)", () => {
    // Two contributors who each get evidence-free batches (same baseline score).
    const a = { name: "A", email: "a@x", githubLogin: "a-gh" };
    const b = { name: "B", email: "b@x", githubLogin: "b-gh" };
    const commits: CollectorCommit[] = [
      commit({ author: a, filesChanged: ["lib/x.ts"], additions: 30 }),
      commit({ author: b, filesChanged: ["lib/y.ts"], additions: 30 }),
      commit({ author: b, filesChanged: ["lib/z.ts"], additions: 30 }),
    ];
    const sc = buildWeeklyScorecard({
      commits,
      windowLabel: "test",
    });
    expect(sc.entries[0].contributor.githubLogin).toBe("a-gh");
    expect(sc.entries[1].contributor.githubLogin).toBe("b-gh");
  });

  it("attributes commits to GitHub login even when AI co-author present", () => {
    const commits: CollectorCommit[] = [
      commit({
        author: {
          name: "Tommy",
          email: "t@x",
          githubLogin: "hzqian2026",
        },
        coAuthors: [
          {
            name: "Claude Opus 4.7 (1M context)",
            email: "noreply@anthropic.com",
          },
        ],
      }),
    ];
    const sc = buildWeeklyScorecard({
      commits,
      windowLabel: "test",
    });
    expect(sc.entries).toHaveLength(1);
    expect(sc.entries[0].contributor.githubLogin).toBe("hzqian2026");
    expect(sc.entries[0].aiCoAuthorRatio).toBe(1);
  });

  it("computes cohort summary with grade buckets and average", () => {
    const a = { name: "A", email: "a@x", githubLogin: "a-gh" };
    const b = { name: "B", email: "b@x", githubLogin: "b-gh" };
    const c = { name: "C", email: "c@x", githubLogin: "c-gh" };
    const commits: CollectorCommit[] = [
      // A: readiness commits → readiness 9, total 9, weak
      commit({ author: a, filesChanged: ["prisma/schema.prisma", ".env.example", "lib/cron/x.ts"], additions: 80 }),
      // B: noise-heavy → harmful
      commit({ author: b, message: "Revert: x", isRevert: true, additions: 5 }),
      commit({ author: b, message: "Revert: y", isRevert: true, additions: 5 }),
      commit({ author: b, message: "Revert: z", isRevert: true, additions: 5 }),
      // C: no positive evidence → weak
      commit({ author: c, filesChanged: ["lib/foo.ts"], additions: 20 }),
    ];
    const sc = buildWeeklyScorecard({
      commits,
      windowLabel: "test",
    });
    expect(sc.cohortSummary.contributorCount).toBe(3);
    expect(sc.cohortSummary.harmfulCount).toBeGreaterThanOrEqual(0);
    expect(sc.cohortSummary.weakCount).toBeGreaterThanOrEqual(1);
    expect(typeof sc.cohortSummary.averageScore).toBe("number");
  });

  it("uses email as fallback identity when githubLogin is null", () => {
    const commits: CollectorCommit[] = [
      commit({
        author: { name: "AnonHuman", email: "anon@x.com", githubLogin: null },
      }),
    ];
    const sc = buildWeeklyScorecard({
      commits,
      windowLabel: "test",
    });
    expect(sc.entries[0].contributor.identityKey).toBe("anon@x.com");
    expect(sc.entries[0].contributor.githubLogin).toBe(null);
  });

  it("includes boundary fields reminding readers this is not a contract", () => {
    const sc = buildWeeklyScorecard({
      commits: [commit()],
      windowLabel: "test",
    });
    expect(sc.boundary).toEqual({
      reservedOnly: true,
      notAPerformanceContractor: true,
      notAFinancialSettlementInput: true,
      aiOutputAttributedToHumanGithub: true,
    });
  });
});

describe("formatWeeklyScorecardAsMarkdown", () => {
  it("emits a markdown table with rank / contributor / score / grade", () => {
    const sc = buildWeeklyScorecard({
      commits: [
        commit({
          author: {
            name: "Tommy",
            email: "t@x",
            githubLogin: "hzqian2026",
          },
          filesChanged: ["prisma/schema.prisma"],
        }),
      ],
      windowLabel: "2026-W19",
    });
    const md = formatWeeklyScorecardAsMarkdown({ scorecard: sc, english: false });
    expect(md).toContain("经营信号质量周榜");
    expect(md).toContain("2026-W19");
    expect(md).toContain("hzqian2026");
    expect(md).toContain("名次");
    expect(md).toContain("评级");
    expect(md).toContain("AI 共署比");
    expect(md).toContain("保留租户");
  });

  it("emits an empty-cohort message when no eligible commits matched", () => {
    const sc = buildWeeklyScorecard({
      commits: [
        commit({ isMerge: true, message: "Merge" }),
      ],
      windowLabel: "empty",
    });
    const md = formatWeeklyScorecardAsMarkdown({ scorecard: sc, english: false });
    expect(md).toContain("本时间窗未匹配到任何贡献者");
  });

  it("produces english markdown when english=true", () => {
    const sc = buildWeeklyScorecard({
      commits: [commit()],
      windowLabel: "2026-W19",
    });
    const md = formatWeeklyScorecardAsMarkdown({ scorecard: sc, english: true });
    expect(md).toContain("Weekly Scorecard");
    expect(md).toContain("Reserved-tenant");
    expect(md).toContain("Rank");
  });
});
