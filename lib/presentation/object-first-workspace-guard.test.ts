import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DemoMode } from "@/lib/demo/demo-modes";
import type { UiLocale } from "@/lib/i18n/config";
import { getWorkspaceStory } from "@/lib/presentation/workspace-story";

// 对象优先守卫（2026-10-15 起，见 CLAUDE.md「对象优先」）。
// Object-first guard (from 2026-10-15, see CLAUDE.md "Object-first").
//
// 每个工作区视图自上而下只放对象 → 原始内容 → 具体下一步；系统判断最多一个、
// 默认折叠、标记为 data-system-judgement 的 <details>。尚未改造的视图登记为
// pending，并写明属于第几波；改造那一波把 status 改成 "enforced" 即可启用。
//
// Each workspace view shows object → original content → next action, with at
// most one collapsed <details data-system-judgement>. Views that have not been
// reworked yet are registered as pending with their wave; the wave that reworks
// a view flips its status to "enforced".
//
// lib/presentation/** is excluded from the public `npm run test` projection, so
// this file runs in CI through `npm run check:object-first-workspace`, which is
// chained into `npm run check:boundaries`.

const root = path.resolve(__dirname, "..", "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const SYSTEM_JUDGEMENT_ATTRIBUTE = "data-system-judgement";

const bannedJudgementPhrases =
  /当前压力|下一步判断|缺结果口径|Helm 提醒|人类主导|依据与来源|为什么现在需要处理|现在先改什么/;

type ViewStatus =
  | { status: "enforced" }
  | { status: "pending"; wave: 2 | 3 | 4; reason: string };

type WorkspaceView = {
  id: string;
  route: string;
  files: readonly string[];
  /**
   * Page-specific regressions a wave removed: canned reasons that state facts
   * the data does not hold, copy that contradicts the real ordering, or
   * judgement blocks that now live only inside the system judgement block.
   */
  regressionPatterns?: readonly RegExp[];
  /**
   * Object markers that must render, outside and before the system judgement
   * block, in the file that holds that block (object → original content →
   * next action, then judgement).
   */
  leadingObjectMarkers?: readonly string[];
} & ViewStatus;

const workspaceViews: readonly WorkspaceView[] = [
  {
    id: "dashboard",
    route: "/dashboard",
    status: "enforced",
    files: [
      "features/dashboard/legacy-home-view.tsx",
      "features/dashboard/home-work-entry-surface.tsx",
      "features/dashboard/home-work-entry.ts",
    ],
  },
  {
    id: "meetings",
    route: "/meetings",
    status: "enforced",
    files: ["app/(workspace)/meetings/page.tsx"],
    regressionPatterns: [
      /Meeting OS wedge/,
      /当前下一步|边界状态|当前还没收口的地方/,
    ],
  },
  {
    id: "contacts",
    route: "/contacts",
    status: "enforced",
    files: ["app/(workspace)/contacts/page.tsx"],
    regressionPatterns: [/沉默最久/, /gone cold longest/],
  },
  {
    id: "companies",
    route: "/companies",
    status: "enforced",
    files: ["app/(workspace)/companies/page.tsx"],
    regressionPatterns: [/最需要你介入/, /needs you most/],
  },
  {
    id: "mobile",
    route: "/mobile",
    status: "enforced",
    files: [
      "app/(workspace)/mobile/page.tsx",
      "features/mobile/components/mobile-hero-card.tsx",
      "features/mobile/components/must-push-card.tsx",
      "features/mobile/components/must-push-list.tsx",
      "features/mobile/lib/mobile-command-read-model.ts",
    ],
    regressionPatterns: [
      /客户已多次催问|客户已发送后续消息|竞争对手可能已在接触|续约已逾期/,
      /customer sent a follow-up/,
    ],
  },
  {
    id: "meeting-detail",
    route: "/meetings/[id]",
    status: "enforced",
    files: [
      "app/(workspace)/meetings/[id]/page.tsx",
      "features/meetings/meeting-detail-client.tsx",
    ],
    regressionPatterns: [
      /Meeting OS wedge|会议推进主线/,
      /If we do not push today|如果今天不推进/,
      /24-hour post-meeting window|黄金推进窗口/,
      /Meeting guidance|会议引导/,
      /Meeting ingress context|会议入口上下文/,
      /Memory generation|记忆生成状态/,
      /mock notes|mock 记录/,
      /"Why this meeting matters"|这场会议值得讲的点/,
      /titleAs="h2"/,
    ],
    leadingObjectMarkers: ["data-meeting-facts", "<Tabs "],
  },
  {
    id: "contact-detail",
    route: "/contacts/[id]",
    status: "enforced",
    files: [
      "app/(workspace)/contacts/[id]/page.tsx",
      "features/contacts/contact-detail-client.tsx",
    ],
    regressionPatterns: [
      /Relationship operating summary|关系操作摘要/,
      /Relationship guidance|关系引导/,
      /Relationship judgement and recommended moves|关系判断与推荐动作/,
      /titleAs="h2"/,
    ],
    leadingObjectMarkers: ["data-contact-facts", "<CustomerEmailThreadsCard"],
  },
  {
    id: "company-detail",
    route: "/companies/[id]",
    status: "enforced",
    files: [
      "app/(workspace)/companies/[id]/page.tsx",
      "features/companies/company-detail-client.tsx",
    ],
    regressionPatterns: [
      /Account operating summary|账户操作摘要/,
      /Account guidance|账户引导/,
      /Account momentum judgement|账户势能判断/,
      /"If we do not push this week"|"如果本周不推进"/,
      /All interactions|全部互动/,
      /getApprovalTasksData/,
      /titleAs="h2"/,
    ],
    leadingObjectMarkers: ["data-company-facts", "<CustomerEmailThreadsCard"],
  },
  {
    id: "inbox-detail",
    route: "/inbox/[id]",
    status: "enforced",
    files: [
      "app/(workspace)/inbox/[id]/page.tsx",
      "features/inbox-followup-review-request/detail-view.tsx",
    ],
    regressionPatterns: [
      /inbox first screen stays concise|收件箱首屏保持精简/,
    ],
    leadingObjectMarkers: ["data-inbox-thread-facts", "<EmailThreadTranscript"],
  },
  {
    id: "inbox",
    route: "/inbox",
    status: "pending",
    wave: 3,
    reason:
      "第 3 波：删除「当前压力 / 下一步判断」条 / wave 3 removes the pressure strip",
    files: ["app/(workspace)/inbox/page.tsx", "features/inbox/inbox-client.tsx"],
  },
  {
    id: "approvals",
    route: "/approvals",
    status: "pending",
    wave: 3,
    reason:
      "第 3 波：卡片改显示草稿正文和发起人 / wave 3 shows draft body and requester on cards",
    files: [
      "app/(workspace)/approvals/page.tsx",
      "features/approvals/approvals-client.tsx",
    ],
  },
  {
    id: "reports",
    route: "/reports",
    status: "pending",
    wave: 3,
    reason:
      "第 3 波：遗漏和高风险清单前置 / wave 3 moves the missed and high-risk lists first",
    files: [
      "app/(workspace)/reports/page.tsx",
      "features/reports/reports-client.tsx",
    ],
  },
  {
    id: "operating",
    route: "/operating",
    status: "pending",
    wave: 3,
    reason:
      "第 3 波：移走 fixture 信号流图，展开工作清单 / wave 3 drops the fixture flow map and opens the work list",
    files: [
      "app/(workspace)/operating/page.tsx",
      "features/internal-operating-workspace/internal-operating-home.tsx",
    ],
  },
  {
    id: "memory",
    route: "/memory",
    status: "pending",
    wave: 4,
    reason:
      "第 4 波：事实 join 对象名和来源 / wave 4 joins object names and sources into facts",
    files: ["app/(workspace)/memory/page.tsx", "features/memory/memory-client.tsx"],
  },
  {
    id: "search",
    route: "/search",
    status: "pending",
    wave: 4,
    reason:
      "第 4 波：空查询显示最近对象 / wave 4 shows recent objects for an empty query",
    files: ["app/(workspace)/search/page.tsx"],
  },
  {
    id: "settings",
    route: "/settings",
    status: "pending",
    wave: 4,
    reason:
      "第 4 波：组织信息前置 / wave 4 moves organisation facts first",
    files: [
      "app/(workspace)/settings/page.tsx",
      "features/settings/settings-client.tsx",
      "features/settings/components/settings-overview-panels.tsx",
    ],
  },
];

type StoryPage = Parameters<typeof getWorkspaceStory>[0];

const workspaceStoryPages: ReadonlyArray<{ page: StoryPage } & ViewStatus> = [
  { page: "dashboard", status: "enforced" },
  { page: "meetings", status: "enforced" },
  { page: "contacts", status: "enforced" },
  { page: "companies", status: "enforced" },
  {
    page: "opportunities",
    status: "pending",
    wave: 2,
    reason:
      "由 feat/opportunities-customer-first 分支改造 / reworked on the opportunities customer-first branch",
  },
  {
    page: "approvals",
    status: "pending",
    wave: 3,
    reason: "第 3 波 / wave 3",
  },
  {
    page: "reports",
    status: "pending",
    wave: 3,
    reason: "第 3 波 / wave 3",
  },
  {
    page: "memory",
    status: "pending",
    wave: 4,
    reason: "第 4 波 / wave 4",
  },
  {
    page: "settings",
    status: "pending",
    wave: 4,
    reason: "第 4 波 / wave 4",
  },
];

const locales: readonly UiLocale[] = ["zh-CN", "en-US"];
const demoModes: ReadonlyArray<DemoMode | null> = [
  null,
  "founder",
  "sales",
  "recruiter",
];

function findOpeningTagEnd(source: string, start: number) {
  let braceDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth -= 1;
    else if (char === ">" && braceDepth === 0) return index;
  }
  return -1;
}

function findMatchingDetailsClose(source: string, start: number) {
  const tokens = /<details\b|<\/details>/g;
  tokens.lastIndex = start;
  let depth = 0;
  for (
    let match = tokens.exec(source);
    match !== null;
    match = tokens.exec(source)
  ) {
    depth += match[0] === "</details>" ? -1 : 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return -1;
}

/**
 * Removes every `<details data-system-judgement …>…</details>` block and
 * returns what is left, how many blocks there were, and their opening tags.
 */
function splitSystemJudgementBlocks(file: string, source: string) {
  let outside = source;
  const openingTags: string[] = [];
  let attributeIndex = outside.indexOf(SYSTEM_JUDGEMENT_ATTRIBUTE);

  while (attributeIndex >= 0) {
    const start = outside.lastIndexOf("<details", attributeIndex);
    if (start < 0 || outside.slice(start + 1, attributeIndex).includes("<")) {
      throw new Error(
        `${file}: ${SYSTEM_JUDGEMENT_ATTRIBUTE} must sit on a <details> element`,
      );
    }
    const openingEnd = findOpeningTagEnd(outside, start);
    const end = findMatchingDetailsClose(outside, start);
    if (openingEnd < 0 || end < 0) {
      throw new Error(`${file}: unbalanced system judgement <details> block`);
    }
    openingTags.push(outside.slice(start, openingEnd + 1));
    outside = outside.slice(0, start) + outside.slice(end);
    attributeIndex = outside.indexOf(SYSTEM_JUDGEMENT_ATTRIBUTE);
  }

  return { outside, count: openingTags.length, openingTags };
}

describe("object-first workspace guard", () => {
  it("keeps the view registry pointed at files that exist", () => {
    for (const view of workspaceViews) {
      for (const file of view.files) {
        expect(existsSync(path.join(root, file)), `${view.route}: ${file}`).toBe(
          true,
        );
      }
    }
  });

  it("strips system judgement blocks, including nested details", () => {
    const sample = [
      "<section>当前工作",
      '<details className="x" data-system-judgement>',
      "<summary>系统判断</summary>",
      "<details><summary>当前压力</summary></details>",
      "下一步判断",
      "</details>",
      "</section>",
    ].join("\n");
    const result = splitSystemJudgementBlocks("sample.tsx", sample);

    expect(result.count).toBe(1);
    expect(result.outside).not.toMatch(bannedJudgementPhrases);
    expect(result.outside).toContain("当前工作");
    expect(
      splitSystemJudgementBlocks("sample.tsx", "<p>当前压力</p>").outside,
    ).toMatch(bannedJudgementPhrases);
  });

  for (const view of workspaceViews) {
    const title =
      view.status === "enforced"
        ? `${view.route} keeps judgement copy inside one collapsed system judgement block`
        : `${view.route} is pending wave ${view.wave}: ${view.reason}`;
    const run = view.status === "enforced" ? it : it.skip;

    run(title, () => {
      let blocks = 0;
      for (const file of view.files) {
        const { outside, count, openingTags } = splitSystemJudgementBlocks(
          file,
          read(file),
        );
        blocks += count;
        expect(outside, `${file} carries judgement copy outside the block`).not.toMatch(
          bannedJudgementPhrases,
        );
        for (const pattern of view.regressionPatterns ?? []) {
          expect(outside, `${file} reintroduced ${pattern}`).not.toMatch(pattern);
        }
        for (const tag of openingTags) {
          expect(tag, `${file}: system judgement must start collapsed`).not.toMatch(
            /\sopen(?=[\s=>/])/,
          );
        }
      }
      expect(blocks, `${view.route} renders more than one system judgement block`).toBeLessThanOrEqual(1);

      if (view.leadingObjectMarkers?.length) {
        const blockFile =
          view.files.find((file) => read(file).includes(SYSTEM_JUDGEMENT_ATTRIBUTE)) ??
          view.files[view.files.length - 1];
        const source = read(blockFile);
        const blockStart = source.includes(SYSTEM_JUDGEMENT_ATTRIBUTE)
          ? source.lastIndexOf("<details", source.indexOf(SYSTEM_JUDGEMENT_ATTRIBUTE))
          : source.length;
        for (const marker of view.leadingObjectMarkers) {
          const markerIndex = source.indexOf(marker);
          expect(markerIndex, `${blockFile} is missing ${marker}`).toBeGreaterThanOrEqual(0);
          expect(
            markerIndex,
            `${blockFile}: ${marker} must render before the system judgement block`,
          ).toBeLessThan(blockStart);
        }
      }
    });
  }

  for (const entry of workspaceStoryPages) {
    const title =
      entry.status === "enforced"
        ? `workspace story for ${entry.page} has no header description`
        : `workspace story for ${entry.page} is pending wave ${entry.wave}: ${entry.reason}`;
    const run = entry.status === "enforced" ? it : it.skip;

    run(title, () => {
      for (const locale of locales) {
        for (const demoMode of demoModes) {
          expect(
            getWorkspaceStory(entry.page, locale, demoMode).description,
            `${entry.page} ${locale} ${demoMode ?? "default"}`,
          ).toBe("");
        }
      }
    });
  }
});
