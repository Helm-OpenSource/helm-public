# Operating Signal Quality Assessment

Helm 自身保留租户的"经营信号质量评估"机制。把"我们到底在产生优质经营信号、还是堆数量制造噪声"做成可追溯、可解释、强惩罚噪声的评分输出。

## 1. 目的

这不是新一份 BI 报表，也不是绩效合约。它服务的是 Helm reserved tenant 的内部经营复盘：

- **优质经营数据明显加分**：能帮判断者更快、更准看见客户风险 / 推进机会 / 执行阻塞 / 交付缺口的数据。
- **垃圾 / 重复 / 误导信息明显减分**：噪声 cap 至 -60，等于一份满分（100）正面信号被噪声压成 40（"useful" 临界），确保 PR / commit 数量不能抵消噪声。
- **PR / commit 数量不构成主要价值依据**：commit 数量本身没有正分项；过小切片、反复重写、为数量而提交都进入 PR inflation penalty。
- **优先级**：交付效果 > 经营信号质量 > 上线 / 配置 / 数据初始化完成度 > 代码质量 > 提交数量。

## 2. 评分模型

| 维度 | 区间 | 维度内细分 |
| --- | --- | --- |
| `deliveryEffectScore` | 0..40 | `tenantUsable` / `customerCanTest` / `onlineVerified` / `operatingPushForward` 各 10 |
| `signalQualityScore` | 0..35 | `actionable` 9 + `timely` 9 + `accurate` 9 + `leadsToReview` 8 |
| `operationalReadinessScore` | 0..15 | env / cron-token / db-migration / tenant-enabled / seed 各 3 |
| `collaborationScore` | 0..10 | `reducedBlockersForOthers` 4 + `clearHandoff` 3 + `teamSpeedUp` 3 |
| `noisePenalty` | -60..0 | 重复 -3 / 误导 -10 / 错误归因 -6 / 无效报表 -4 |
| `prInflationPenalty` | -20..0 | 过小切片 -2 / 反复非推进 commit -3 / 为提交数量而提交 -8 |

最终：`totalScore = clamp(sum, -60, 100)`，分级：

- `>= 70` → **`high_value`**（继续保持）
- `>= 40` → **`useful`**（总体有用但被噪声 / 上线拖低）
- `>= 0`  → **`weak`**（正面项还没补齐）
- `< 0`   → **`harmful`**（噪声压过产出）

## 3. 模块结构

```
lib/operating-signal-quality/
├── types.ts                       # Evidence / Assessment / SubjectKind / Grade
├── assess.ts                      # 纯函数：assessOperatingSignalQuality()
├── assess.test.ts                 # 10 case
├── display-copy.ts                # 双语 label + Badge variant 映射
├── format-readout.ts              # assessment → 结构化 readout / markdown
├── format-readout.test.ts         # 10 case
├── collect-from-github.ts         # commits + PRs → evidence（启发式 + manual override）
├── collect-from-github.test.ts    # 19 case
└── README.md                      # 本文件

features/operating-signal-quality/
└── scorecard.tsx                  # React UI（pure render，6 case jsdom 测试）

scripts/
└── operating-signal-quality-assess.ts  # CLI：git log → markdown
```

## 4. CLI 用法

```bash
# 默认取最近 20 个 commit
npm run operating-signal-quality:assess

# 限定提交数 / 时间范围 / 主语
npm run operating-signal-quality:assess -- --commits=10
npm run operating-signal-quality:assess -- --since="2 days ago" --subject="Tommy"
npm run operating-signal-quality:assess -- --since="2026-05-01" --subject-kind=contributor

# 切换语言 / 输出
npm run operating-signal-quality:assess -- --english
npm run operating-signal-quality:assess -- --json
```

输出包含分项、正面信号、噪声 / 干扰、改进建议、boundary footer，并标注 AI 共同署名比例（informational only）。

## 5. API 用法

### 5.1 直接评分

```ts
import { assessOperatingSignalQuality } from "@/lib/operating-signal-quality/assess";

const assessment = assessOperatingSignalQuality({
  subject: { kind: "contributor", label: "Tommy", githubHandle: "hzqian2026" },
  evidence: {
    delivery: { tenantUsable: true, customerCanTest: true, onlineVerified: true, operatingPushForward: true },
    signal: { actionable: true, timely: true, accurate: true, leadsToReview: true },
    readiness: { envConfigured: true, cronOrTokenSet: true, dbMigrated: true, tenantEnabled: true, initialDataSeeded: true },
    collaboration: { reducedBlockersForOthers: true, clearHandoff: true, teamSpeedUp: true },
    noise: { duplicateSignalCount: 0, misleadingSignalCount: 0, wrongAttributionCount: 0, invalidReportCount: 0 },
    prInflation: { tinyNonCohesiveSliceCount: 0, repeatedNonProgressiveCommitCount: 0, commitsForCountSake: false },
  },
});
// assessment.grade === "high_value", assessment.scores.totalScore === 100
```

### 5.2 从 GitHub 数据采证据

```ts
import { collectOperatingSignalQualityEvidenceFromGitHub } from "@/lib/operating-signal-quality/collect-from-github";

const { evidence, attribution } = collectOperatingSignalQualityEvidenceFromGitHub({
  commits: [/* CollectorCommit[] */],
  prs: [/* CollectorPullRequest[] with ciResults */],
  manualOverrides: {
    delivery: { tenantUsable: true, customerCanTest: true, operatingPushForward: true },
    signal: { actionable: true, leadsToReview: true },
    collaboration: { reducedBlockersForOthers: true, clearHandoff: true },
  },
});
```

启发式自动推断：

- `readiness.*`：commit 触碰 `prisma/schema*` / `prisma/migrations/` / `.env*` / `*cron*` / `*scheduler*` / `*token*` / `extensions/*/tenant.manifest.json` / `seed*.ts` 等路径
- `prInflation.*`：过小切片 / Revert / fix typo / commitsForCountSake（>10 非 merge + 平均 <5 行）
- `noise.duplicateSignalCount`：从 `isRevert` commit 计数
- `delivery.onlineVerified`：所有 PR 的 CI（typecheck / lint / test / boundary[/build]）全 pass 才为 true

剩下的 delivery / signal / collab 项必须通过 `manualOverrides` 由人工或上游 readout 提供——不擅自捏造。

### 5.3 渲染 scorecard

```tsx
import { OperatingSignalQualityScorecard } from "@/features/operating-signal-quality/scorecard";
import { formatOperatingSignalQualityReadout } from "@/lib/operating-signal-quality/format-readout";

const readout = formatOperatingSignalQualityReadout({ assessment, english });
return <OperatingSignalQualityScorecard readout={readout} githubHandle={attribution.primaryGithubLogin} />;
```

### 5.4 推送到 DingTalk / Slack / 周报 brief

```ts
import { formatOperatingSignalQualityReadoutAsMarkdown } from "@/lib/operating-signal-quality/format-readout";

const md = formatOperatingSignalQualityReadoutAsMarkdown({ assessment, english: false });
// md 可直接粘贴或喂给已有的 review-first 推送链路
```

## 6. 边界（必须长期保留）

1. **Reserved-only**：caller 必须在 surface / page-loader 层先做 `assertHelmReservedWorkspaceAccess`，再喂数据给本库。本库自身不持租户字面量。
2. **评估快照 ≠ 绩效合约 ≠ 结算依据**：所有 assessment 出参带 `boundary` 字段显式说明这一点；所有 readout / markdown 输出带 footer 提醒读者。
3. **AI 输出归人类 GitHub**：Claude / Codex / GPT / Copilot 等 Co-Authored-By 仅作 `aiCoAuthorRatio` informational metadata，不创建独立 contributor 评分对象，attribution 永远归 commit author。
4. **PR / commit 数量不主导**：noise penalty cap -60 ≥ delivery max 40，确保单纯堆代码量不可能压过噪声；不做任何 commit count → score 的正向贡献。
5. **不引入完整 BI 平台 / workflow engine / 自动决策 / 自动承诺**：纯函数 + read-only CLI；推送、复核、决策都在调用方手里。
6. **人工 override 优先**：collector 的启发式只覆盖 readiness + prInflation + 部分 noise；delivery / signal / collab 在没人工证据时**默认 false**，绝不擅自给正分。

## 7. 验证

```bash
# 单元测试（39 case）
npx vitest run lib/operating-signal-quality features/operating-signal-quality

# 类型 / lint / boundary
npx tsc --noEmit
npx eslint lib/operating-signal-quality/ features/operating-signal-quality/ scripts/operating-signal-quality-assess.ts
npm run check:boundaries

# CLI 实跑
npm run operating-signal-quality:assess -- --commits=20
```

## 8. 切片历史

| Slice | Commit | 内容 |
| --- | --- | --- |
| B | `90db36fd8` | 核心评分函数 + 类型 + 10 case |
| C | `8e80cb1a8` | 双语 readout + markdown formatter + 10 case |
| D | `d0b926591` | React Scorecard 组件 + 6 jsdom case |
| E | `9d02c44b4` | GitHub evidence collector + 19 case |
| F | `742d73bcb` | CLI 脚本（git log → markdown） |
| G | (本 commit) | README + 集成示例 |
