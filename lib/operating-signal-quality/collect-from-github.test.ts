import { describe, expect, it } from "vitest";
import { assessOperatingSignalQuality } from "./assess";
import {
  __INTERNALS_FOR_TESTING_ONLY__,
  collectOperatingSignalQualityEvidenceFromGitHub,
  type CollectorCommit,
  type CollectorPullRequest,
} from "./collect-from-github";

const { detectReadinessSignals, detectPrInflation, buildAttribution } =
  __INTERNALS_FOR_TESTING_ONLY__;

function commit(overrides: Partial<CollectorCommit> = {}): CollectorCommit {
  return {
    sha: overrides.sha ?? "deadbeef",
    message: overrides.message ?? "feat: implement something",
    author: overrides.author ?? {
      name: "Tommy",
      email: "tommy@example.com",
      githubLogin: "hzqian2026",
    },
    coAuthors: overrides.coAuthors ?? [],
    filesChanged: overrides.filesChanged ?? ["lib/foo.ts"],
    additions: overrides.additions ?? 20,
    deletions: overrides.deletions ?? 5,
    isMerge: overrides.isMerge ?? false,
    isRevert: overrides.isRevert ?? false,
  };
}

describe("detectReadinessSignals", () => {
  it("detects dbMigrated when prisma schema or migrations files are touched", () => {
    const result = detectReadinessSignals([
      commit({ filesChanged: ["prisma/schema.prisma"] }),
    ]);
    expect(result.dbMigrated).toBe(true);
  });

  it("detects envConfigured when .env example is touched", () => {
    const result = detectReadinessSignals([
      commit({ filesChanged: [".env.example"] }),
    ]);
    expect(result.envConfigured).toBe(true);
  });

  it("detects cronOrTokenSet when scheduler/cron/token paths are touched", () => {
    const result = detectReadinessSignals([
      commit({ filesChanged: ["lib/signal-collection/cron-route.ts"] }),
    ]);
    expect(result.cronOrTokenSet).toBe(true);
  });

  it("detects tenantEnabled when tenant manifest is touched", () => {
    const result = detectReadinessSignals([
      commit({
        filesChanged: ["extensions/sample-test-slug/tenant.manifest.json"],
      }),
    ]);
    expect(result.tenantEnabled).toBe(true);
  });

  it("detects initialDataSeeded when seed script is touched", () => {
    const result = detectReadinessSignals([
      commit({ filesChanged: ["scripts/seed-sample-workspace.ts"] }),
    ]);
    expect(result.initialDataSeeded).toBe(true);
  });

  it("returns all-false when no readiness paths are touched", () => {
    const result = detectReadinessSignals([
      commit({ filesChanged: ["lib/some/feature.ts"] }),
    ]);
    expect(result).toEqual({
      envConfigured: false,
      cronOrTokenSet: false,
      dbMigrated: false,
      tenantEnabled: false,
      initialDataSeeded: false,
    });
  });
});

describe("detectPrInflation", () => {
  it("counts tiny non-cohesive slices", () => {
    const result = detectPrInflation([
      commit({ additions: 2, deletions: 1, filesChanged: ["lib/a.ts"] }),
      commit({ additions: 3, deletions: 1, filesChanged: ["lib/b.ts"] }),
      commit({ additions: 1, deletions: 1, filesChanged: ["lib/c.ts"] }),
      // 大切片不计入
      commit({ additions: 200, deletions: 50, filesChanged: ["lib/d.ts"] }),
    ]);
    expect(result.tinyNonCohesiveSliceCount).toBe(3);
  });

  it("ignores tiny docs-only commits as inflation", () => {
    const result = detectPrInflation([
      commit({
        additions: 2,
        deletions: 1,
        filesChanged: ["README.md"],
      }),
      commit({
        additions: 1,
        deletions: 1,
        filesChanged: ["docs/something.md"],
      }),
    ]);
    expect(result.tinyNonCohesiveSliceCount).toBe(0);
  });

  it("counts repeated non-progressive commits via message or isRevert", () => {
    const result = detectPrInflation([
      commit({ message: "Revert: undo bad change" }),
      commit({ message: "fix typo" }),
      commit({ message: "trying again" }),
      commit({ isRevert: true, message: "anything" }),
      commit({ message: "feat: real progress" }), // not counted
    ]);
    expect(result.repeatedNonProgressiveCommitCount).toBe(4);
  });

  it("flags commitsForCountSake when many small commits dominate", () => {
    const tiny = Array.from({ length: 12 }, () =>
      commit({
        additions: 1,
        deletions: 1,
        filesChanged: ["lib/foo.ts"],
      }),
    );
    const result = detectPrInflation(tiny);
    expect(result.commitsForCountSake).toBe(true);
  });

  it("does not flag commitsForCountSake when commits are substantive", () => {
    const real = Array.from({ length: 15 }, () =>
      commit({ additions: 30, deletions: 10 }),
    );
    const result = detectPrInflation(real);
    expect(result.commitsForCountSake).toBe(false);
  });

  it("skips merge commits when computing inflation", () => {
    const result = detectPrInflation([
      commit({ isMerge: true, message: "Merge branch 'x'", additions: 0, deletions: 0 }),
      commit({ message: "feat: real change", additions: 80, deletions: 20 }),
    ]);
    expect(result.commitsForCountSake).toBe(false);
    expect(result.repeatedNonProgressiveCommitCount).toBe(0);
  });
});

describe("buildAttribution", () => {
  it("attributes commits to human GitHub login, not to AI co-author", () => {
    const attribution = buildAttribution([
      commit({
        author: {
          name: "Tommy",
          email: "tommy@example.com",
          githubLogin: "hzqian2026",
        },
        coAuthors: [
          {
            name: "Claude Opus 4.7 (1M context)",
            email: "noreply@anthropic.com",
          },
        ],
      }),
      commit({
        author: {
          name: "Tommy",
          email: "tommy@example.com",
          githubLogin: "hzqian2026",
        },
        coAuthors: [{ name: "Codex bot", email: "codex@openai" }],
      }),
    ]);
    expect(attribution.primaryGithubLogin).toBe("hzqian2026");
    expect(attribution.authorLoginCounts).toEqual({ hzqian2026: 2 });
    expect(attribution.aiCoAuthorRatio).toBe(1);
    expect(attribution.detectedAiCoAuthors).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Claude"),
        expect.stringContaining("Codex"),
      ]),
    );
  });

  it("ignores merge commits when calculating attribution counts", () => {
    const attribution = buildAttribution([
      commit({
        isMerge: true,
        message: "Merge branch 'main'",
        author: {
          name: "auto-merge",
          email: "auto@github",
          githubLogin: "github-actions",
        },
      }),
      commit({
        author: {
          name: "Tommy",
          email: "t@x.com",
          githubLogin: "hzqian2026",
        },
      }),
    ]);
    expect(attribution.primaryGithubLogin).toBe("hzqian2026");
    expect(attribution.authorLoginCounts).toEqual({ hzqian2026: 1 });
  });

  it("picks the most frequent author when there are multiple humans", () => {
    const attribution = buildAttribution([
      commit({
        author: { name: "A", email: "a@x", githubLogin: "alice" },
      }),
      commit({
        author: { name: "A", email: "a@x", githubLogin: "alice" },
      }),
      commit({
        author: { name: "B", email: "b@x", githubLogin: "bob" },
      }),
    ]);
    expect(attribution.primaryGithubLogin).toBe("alice");
    expect(attribution.authorLoginCounts).toEqual({ alice: 2, bob: 1 });
  });
});

describe("collectOperatingSignalQualityEvidenceFromGitHub", () => {
  it("derives readiness + duplicate noise + prInflation from raw commits and feeds the scorer", () => {
    const commits = [
      commit({
        message: "feat(prisma): add gtm-lead schema",
        filesChanged: ["prisma/schema.prisma"],
        additions: 60,
        deletions: 5,
      }),
      commit({
        message: "chore(env): add new env vars",
        filesChanged: [".env.example"],
        additions: 4,
        deletions: 0,
      }),
      commit({
        message: "feat(scheduler): wire cron route",
        filesChanged: ["lib/signal-collection/cron-route.ts"],
        additions: 120,
        deletions: 10,
      }),
      commit({
        isRevert: true,
        message: "Revert: bad change",
        filesChanged: ["lib/foo.ts"],
      }),
      commit({
        message: "fix typo",
        additions: 1,
        deletions: 1,
        filesChanged: ["lib/foo.ts"],
      }),
    ];
    const prs: CollectorPullRequest[] = [
      {
        number: 1,
        title: "feat: x",
        state: "merged",
        authorLogin: "hzqian2026",
        commits,
        ciResults: {
          typecheck: "pass",
          lint: "pass",
          test: "pass",
          boundary: "pass",
          build: "pass",
        },
      },
    ];

    const { evidence, attribution } =
      collectOperatingSignalQualityEvidenceFromGitHub({
        commits,
        prs,
      });

    expect(evidence.readiness.dbMigrated).toBe(true);
    expect(evidence.readiness.envConfigured).toBe(true);
    expect(evidence.readiness.cronOrTokenSet).toBe(true);
    // 没碰 tenant manifest / seed script，应保持 false
    expect(evidence.readiness.tenantEnabled).toBe(false);
    expect(evidence.readiness.initialDataSeeded).toBe(false);

    expect(evidence.noise.duplicateSignalCount).toBe(1);
    expect(evidence.prInflation.repeatedNonProgressiveCommitCount).toBeGreaterThan(
      0,
    );

    // CI 全过 → onlineVerified hint = true
    expect(evidence.delivery.onlineVerified).toBe(true);

    expect(attribution.primaryGithubLogin).toBe("hzqian2026");

    // 跑通整条评分链
    const assessment = assessOperatingSignalQuality({
      subject: {
        kind: "contributor",
        label: "Tommy",
        githubHandle: attribution.primaryGithubLogin,
      },
      evidence,
    });
    expect(assessment.scores.operationalReadinessScore).toBe(9); // 3 of 5 readiness bools true × 3
    expect(assessment.subject.githubHandle).toBe("hzqian2026");
  });

  it("manual overrides take precedence over heuristic detection", () => {
    const { evidence } = collectOperatingSignalQualityEvidenceFromGitHub({
      commits: [
        commit({ filesChanged: ["lib/foo.ts"] }),
      ],
      manualOverrides: {
        delivery: {
          tenantUsable: true,
          customerCanTest: true,
          operatingPushForward: true,
        },
        signal: { actionable: true, leadsToReview: true },
        collaboration: { reducedBlockersForOthers: true, clearHandoff: true },
        noise: { misleadingSignalCount: 2 },
      },
    });
    expect(evidence.delivery.tenantUsable).toBe(true);
    expect(evidence.signal.actionable).toBe(true);
    expect(evidence.collaboration.clearHandoff).toBe(true);
    expect(evidence.noise.misleadingSignalCount).toBe(2);
    // heuristic-derived items still empty because no relevant paths touched
    expect(evidence.readiness.dbMigrated).toBe(false);
  });

  it("returns onlineVerified=false when CI is missing on any PR", () => {
    const c = commit({ filesChanged: ["lib/foo.ts"] });
    const { evidence } = collectOperatingSignalQualityEvidenceFromGitHub({
      commits: [c],
      prs: [
        {
          number: 1,
          title: "no-ci-yet",
          state: "open",
          authorLogin: "hzqian2026",
          commits: [c],
          // ciResults absent
        },
      ],
    });
    expect(evidence.delivery.onlineVerified).toBe(false);
  });

  it("does not invent collab / signal / delivery hints without explicit override", () => {
    const { evidence } = collectOperatingSignalQualityEvidenceFromGitHub({
      commits: [commit({ filesChanged: ["lib/foo.ts"] })],
    });
    expect(evidence.delivery.tenantUsable).toBe(false);
    expect(evidence.delivery.customerCanTest).toBe(false);
    expect(evidence.delivery.operatingPushForward).toBe(false);
    expect(evidence.signal.actionable).toBe(false);
    expect(evidence.collaboration.clearHandoff).toBe(false);
  });
});
