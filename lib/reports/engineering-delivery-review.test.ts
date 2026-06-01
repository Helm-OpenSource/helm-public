import { describe, expect, it } from "vitest";
import {
  buildEngineeringDeliveryReview,
  parseGitHistoryLog,
} from "@/lib/reports/engineering-delivery-review";

describe("engineering delivery review", () => {
  it("parses git history with numstat blocks", () => {
    const raw = [
      "commit\u001fabcd1234\u001fAlice\u001falice@example.com\u001f2026-04-10\u001ffeat: harden reports review",
      "12\t4\tapp/(workspace)/reports/page.tsx",
      "8\t0\tfeatures/reports/reports-client.tsx",
      "",
      "commit\u001fefgh5678\u001fBob\u001fbob@example.com\u001f2026-04-09\u001fdocs: align report baseline",
      "3\t1\tdocs/README.md",
      "5\t0\tREADME.md",
    ].join("\n");

    const commits = parseGitHistoryLog(raw);

    expect(commits).toHaveLength(2);
    expect(commits[0]).toMatchObject({
      hash: "abcd1234",
      authorName: "Alice",
      subject: "feat: harden reports review",
    });
    expect(commits[0].files).toHaveLength(2);
    expect(commits[0].files[0]).toMatchObject({
      path: "app/(workspace)/reports/page.tsx",
      additions: 12,
      deletions: 4,
      changedLines: 16,
      focusKey: "reports",
    });
    expect(commits[1].files[1].focusKey).toBe("docs");
  });

  it("builds contributor, ownership, and collaboration judgements from commit history", () => {
    const review = buildEngineeringDeliveryReview({
      repoLabel: "helm2026",
      days: 28,
      english: true,
      commits: [
        {
          hash: "c1",
          authorName: "Alice",
          authorEmail: "alice@example.com",
          date: "2026-04-11",
          subject: "feat: land runtime closure",
          files: [
            {
              path: "lib/helm-v2/runtime-upgrade.ts",
              additions: 120,
              deletions: 30,
              changedLines: 150,
              binary: false,
              focusKey: "runtime",
            },
            {
              path: "lib/helm-v2/runtime-upgrade.test.ts",
              additions: 24,
              deletions: 0,
              changedLines: 24,
              binary: false,
              focusKey: "tests",
            },
            {
              path: "scripts/helm-self-check.ts",
              additions: 8,
              deletions: 2,
              changedLines: 10,
              binary: false,
              focusKey: "guardrails",
            },
          ],
        },
        {
          hash: "c2",
          authorName: "Alice",
          authorEmail: "alice@example.com",
          date: "2026-04-10",
          subject: "docs: record runtime baseline",
          files: [
            {
              path: "docs/product/HELM_RUNTIME_REPORT.md",
              additions: 60,
              deletions: 0,
              changedLines: 60,
              binary: false,
              focusKey: "docs",
            },
            {
              path: "README.md",
              additions: 4,
              deletions: 1,
              changedLines: 5,
              binary: false,
              focusKey: "docs",
            },
          ],
        },
        {
          hash: "c3",
          authorName: "Alice",
          authorEmail: "alice@example.com",
          date: "2026-04-09",
          subject: "feat: refine reports operating block",
          files: [
            {
              path: "app/(workspace)/reports/page.tsx",
              additions: 22,
              deletions: 7,
              changedLines: 29,
              binary: false,
              focusKey: "reports",
            },
            {
              path: "features/reports/reports-client.tsx",
              additions: 38,
              deletions: 12,
              changedLines: 50,
              binary: false,
              focusKey: "reports",
            },
          ],
        },
        {
          hash: "c4",
          authorName: "Alice",
          authorEmail: "alice@example.com",
          date: "2026-04-08",
          subject: "chore: update package metadata",
          files: [
            {
              path: "package.json",
              additions: 3,
              deletions: 1,
              changedLines: 4,
              binary: false,
              focusKey: "tooling",
            },
          ],
        },
        {
          hash: "c5",
          authorName: "Bob",
          authorEmail: "bob@example.com",
          date: "2026-04-07",
          subject: "feat: restyle reports shell",
          files: [
            {
              path: "app/(workspace)/reports/page.tsx",
              additions: 18,
              deletions: 6,
              changedLines: 24,
              binary: false,
              focusKey: "reports",
            },
            {
              path: "features/reports/reports-client.tsx",
              additions: 16,
              deletions: 8,
              changedLines: 24,
              binary: false,
              focusKey: "reports",
            },
          ],
        },
        {
          hash: "c6",
          authorName: "Bob",
          authorEmail: "bob@example.com",
          date: "2026-04-06",
          subject: "docs: clarify reports notes",
          files: [
            {
              path: "docs/README.md",
              additions: 12,
              deletions: 0,
              changedLines: 12,
              binary: false,
              focusKey: "docs",
            },
          ],
        },
      ],
    });

    expect(review.availability).toBe("READY");
    expect(review.connections.find((item) => item.label === "Ownership pressure")?.value).toBe(
      "Concentrated",
    );
    expect(review.snapshot.blocker).toContain("Alice");
    expect(review.contributors).toHaveLength(2);
    expect(review.contributors[0]).toMatchObject({
      name: "Alice",
      commits: 4,
      badgeTone: "success",
    });
    expect(review.contributors[0].focusLabels).toContain("runtime / core logic");
    expect(review.contributors[1].focusLabels).toContain("reports / review surfaces");
    expect(review.collaboration.overlapPairs[0]?.label).toBe("Alice + Bob");
    expect(review.suggestions[0]?.title).toContain("second owner");
  });

  it("keeps Chinese engineering delivery readout out of internal English labels", () => {
    const review = buildEngineeringDeliveryReview({
      repoLabel: "helm2026",
      days: 28,
      english: false,
      commits: [
        {
          hash: "c1",
          authorName: "Alice",
          authorEmail: "alice@example.com",
          date: "2026-04-11",
          subject: "feat(memory): freeze native memory phase 0-3",
          files: [
            {
              path: "lib/helm-v2/runtime-upgrade.ts",
              additions: 120,
              deletions: 30,
              changedLines: 150,
              binary: false,
              focusKey: "runtime",
            },
            {
              path: "scripts/helm-self-check.ts",
              additions: 8,
              deletions: 2,
              changedLines: 10,
              binary: false,
              focusKey: "guardrails",
            },
            {
              path: "misc/manual-note.txt",
              additions: 5,
              deletions: 1,
              changedLines: 6,
              binary: false,
              focusKey: "other",
            },
            {
              path: "scratch/runtime-follow-up.txt",
              additions: 4,
              deletions: 0,
              changedLines: 4,
              binary: false,
              focusKey: "other",
            },
            {
              path: "notes/review-outline.txt",
              additions: 6,
              deletions: 0,
              changedLines: 6,
              binary: false,
              focusKey: "other",
            },
          ],
        },
        {
          hash: "c2",
          authorName: "Alice",
          authorEmail: "alice@example.com",
          date: "2026-04-10",
          subject: "docs: record runtime baseline",
          files: [
            {
              path: "docs/product/HELM_RUNTIME_REPORT.md",
              additions: 60,
              deletions: 0,
              changedLines: 60,
              binary: false,
              focusKey: "docs",
            },
          ],
        },
        {
          hash: "c3",
          authorName: "Bob",
          authorEmail: "bob@example.com",
          date: "2026-04-09",
          subject: "feat: refine reports operating block",
          files: [
            {
              path: "app/(workspace)/reports/page.tsx",
              additions: 18,
              deletions: 6,
              changedLines: 24,
              binary: false,
              focusKey: "reports",
            },
          ],
        },
      ],
    });

    const rendered = JSON.stringify(review);

    expect(review.headline).toContain("提交数");
    expect(review.summary).toContain("轻量交付窗口");
    expect(review.snapshot.objectState).toContain("窄范围触达");
    expect(review.connections.find((item) => item.label === "闭环")?.description).not.toContain(
      "%",
    );
    expect(review.contributors[0].focusLabels).toContain("运行核心");
    expect(review.contributors[0].focusLabels).toContain("综合支撑");
    expect(review.contributors[0].latestSubject).toBe("新增或强化：结构化记忆与经营信号");
    expect(review.connections.find((item) => item.label === "职责压力")?.value).toBe(
      "中心化",
    );
    expect(review.suggestions[0]?.title).toContain("第二负责人");
    expect(review.suggestions[0]?.body).toContain("复核人");
    expect(rendered).not.toContain("runtime / core logic");
    expect(rendered).not.toContain("docs / baseline");
    expect(rendered).not.toContain("guardrails / self-check");
    expect(rendered).not.toContain("review ownership");
    expect(rendered).not.toContain("second owner");
    expect(rendered).not.toContain("current-main priority");
    expect(rendered).not.toContain("bus factor");
    expect(rendered).not.toContain("merge friction");
    expect(rendered).not.toContain("feat(memory)");
    expect(rendered).not.toContain("native memory");
    expect(rendered).not.toContain("其他");
    expect(rendered).not.toContain("1 条提交");
    expect(rendered).not.toContain("3 条提交");
    expect(rendered).not.toContain("共同触达了 1 个文件");
    expect(rendered).not.toContain("共同触达了");
  });

  it("uses all contributors for team-level stats while still limiting visible cards to top slices", () => {
    const commits = Array.from({ length: 7 }).map((_, index) => ({
      hash: `c${index + 1}`,
      authorName: `Contributor-${index + 1}`,
      authorEmail: `contributor-${index + 1}@example.com`,
      date: `2026-04-${String(20 - index).padStart(2, "0")}`,
      subject: `feat: lane ${index + 1}`,
      files: [
        {
          path: `app/(workspace)/reports/lane-${index + 1}.tsx`,
          additions: 20,
          deletions: 4,
          changedLines: 24,
          binary: false,
          focusKey: "reports" as const,
        },
      ],
    }));

    const review = buildEngineeringDeliveryReview({
      repoLabel: "helm2026",
      days: 28,
      english: true,
      commits,
    });

    expect(review.contributors).toHaveLength(6);
    expect(review.summary).toContain("7 active contributors");
    expect(review.snapshot.objectState).toContain("7 contributors");
  });

  it("counts closure only when implementation and closure evidence appear in the same commit", () => {
    const review = buildEngineeringDeliveryReview({
      repoLabel: "helm2026",
      days: 28,
      english: true,
      commits: [
        {
          hash: "c1",
          authorName: "Alice",
          authorEmail: "alice@example.com",
          date: "2026-04-10",
          subject: "chore: tools and docs",
          files: [
            {
              path: "package.json",
              additions: 3,
              deletions: 0,
              changedLines: 3,
              binary: false,
              focusKey: "tooling",
            },
            {
              path: "docs/README.md",
              additions: 10,
              deletions: 0,
              changedLines: 10,
              binary: false,
              focusKey: "docs",
            },
          ],
        },
        {
          hash: "c2",
          authorName: "Alice",
          authorEmail: "alice@example.com",
          date: "2026-04-09",
          subject: "feat: runtime plus tests",
          files: [
            {
              path: "lib/helm-v2/runtime-upgrade.ts",
              additions: 20,
              deletions: 5,
              changedLines: 25,
              binary: false,
              focusKey: "runtime",
            },
            {
              path: "lib/helm-v2/runtime-upgrade.test.ts",
              additions: 12,
              deletions: 1,
              changedLines: 13,
              binary: false,
              focusKey: "tests",
            },
          ],
        },
      ],
    });

    expect(review.contributors[0]?.closureCommitRate).toBe(0.5);
    expect(review.contributors[0]?.metricCards[1]?.value).toContain("50%");
  });
});
