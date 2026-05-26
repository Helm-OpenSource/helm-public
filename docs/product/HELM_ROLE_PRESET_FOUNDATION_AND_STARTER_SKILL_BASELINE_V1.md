---
status: active
owner: helm-core
created: 2026-04-10
review_after: 2026-07-09
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_ROLE_PRESET_FOUNDATION_AND_STARTER_SKILL_BASELINE_V1

## 1. 目标

冻结一条很窄的 `Role Foundation v1` truth：

- 当前 9 个 `Role Preset` 不只是一组 label
- 它们已经可以被理解为一份 `Soul-lite / working definition skeleton`
- 每个角色都应有一组 `starter skill suggestions`

这里的 `Soul-lite` 只是对现有角色预设字段的便捷说法，指：

- `summary`
- `mission`
- `ownedOutcomes`
- `mainJudgements`
- `handoffEdges`
- `successSignals`
- `boundaryNotes`

这条能力的目标是把“角色是什么、先该学会什么”整理成一条窄而诚实的 repo truth，不把 Helm 写成完整 soul platform、人格系统、KPI 平台或自动授权系统。

## 2. 当前已成立

### 已经完整成立

- repo 当前已经内置 9 个稳定 `Role Preset`
  - Founder / CEO
  - Sales lead
  - Account executive
  - Recruiter
  - Customer success
  - Delivery lead
  - Product / design / engineering
  - Operations / finance / support
  - General operator
- 这些角色预设本身已经携带一份可作为 `Soul-lite` 使用的骨架：
  - `summary`
  - `mission`
  - `ownedOutcomes`
  - `mainJudgements`
  - `handoffEdges`
  - `successSignals`
  - `boundaryNotes`
- repo 当前已经有 8 个正式 `OperatingSkillId`
  - `meeting-briefing`
  - `meeting-follow-through`
  - `external-followup-draft`
  - `approval-review`
  - `opportunity-push`
  - `relationship-revival`
  - `memory-correction`
  - `pilot-readiness-diagnostics`
- setup / settings 当前已经能基于 `rolePresetKey` 生成 `Member Definition Draft`
- `/settings` 的当前成员定义卡片现在会显示当前角色对应的 starter skill suggestions，并额外显示当前 workspace fit
- `/setup` 与 `/settings` 的成员邀请表单现在会在选择 `rolePresetKey` 时同步显示同一份 suggestion-only starter skill preview
- `/dashboard` 现在也会显示当前成员的 role foundation card，明确区分：
  - accepted member definition
  - draft definition
  - preset-led start
- starter skill preview 现在已经会轻量读取：
  - `workspace profileType`
  - `focusAreas`
  - 并按当前 focus 主线对 skill readout 做有限排序

### 已成形但仍需下一层

- repo 现在已经新增一份内部 canonical mapping：
  - `lib/definitions/role-foundations.ts`
  - 它把每个 `Role Preset` 对齐到：
    - 一份 `Soul-lite` 读法
    - 一组 `starter skill suggestion pack`
- 这些 starter skill 现在已经进入 setup/settings/dashboard，但仍不是更广产品面 fully surfaced 的能力
- 当前 `starter skill suggestion pack` 还没有进入：
  - role handoff surface
  - 自动 `SkillSuggestion` 生成链
- 当前 starter pack 已经叠加 `workspace profileType + focusAreas`，但还没有继续叠加：
  - tenant evidence
  - adoption history
  - accepted / dismissed history

### 刻意未做

- 不新增 `CompanySoul / RoleSoul / MemberSoul` 独立平台层
- 不把 starter skill 自动 accept 成 candidate capability
- 不把 starter skill 自动写成 formal skill
- 不把 starter skill 自动接入 routing / worker binding / auto execution
- 不自动生成 KPI / policy / goal / campaign
- 不做 personality inference 或个人画像系统

### 风险项

- 同一角色在不同 workspace posture 下，starter pack 可能需要明显不同
- 如果把 starter skill 写成“默认已拥有的能力”，容易误读 execution authority
- 如果把 `Soul-lite` 写成完整 soul system，容易把定义层顺手扩成平台层
- 如果 starter pack 后续不叠加 focus area / evidence / calibration，可能只是一份过粗的默认模板

## 3. 边界

`Role Foundation v1` 必须继续保持：

- `role preset != authority`
- `Soul-lite != soul platform`
- `working definition != KPI contract`
- `starter skill suggestion != formal skill`
- `candidate capability != execution authority`
- `explanation != commitment`
- `proactive != automatic decision-making`

任何可能被误读成外部承诺的内容，仍必须保留：

- boundary
- prerequisite
- dependency
- risk
- non-commitment

## 4. 当前建议的 9 组 role foundations

### Founder / CEO

- Soul-lite 焦点：经营主线、资源优先级、关键判断和高风险表达边界
- Starter skill suggestions：
  - `机会推进判断`
  - `审批判断`
  - `会前 briefing`

### Sales lead

- Soul-lite 焦点：机会排序、跟进质量、review-required 外部动作
- Starter skill suggestions：
  - `机会推进判断`
  - `外部跟进草稿`
  - `审批判断`

### Account executive

- Soul-lite 焦点：单条机会推进、联系人线程恢复、会后 next step
- Starter skill suggestions：
  - `外部跟进草稿`
  - `关系恢复动作`
  - `机会推进判断`

### Recruiter

- Soul-lite 焦点：候选人推进、面试协同、反馈链连续性
- Starter skill suggestions：
  - `会前 briefing`
  - `会后动作提炼`
  - `关系恢复动作`

### Customer success

- Soul-lite 焦点：续约扩容线索、客户风险、issue follow-through
- Starter skill suggestions：
  - `关系恢复动作`
  - `外部跟进草稿`
  - `会后动作提炼`

### Delivery lead

- Soul-lite 焦点：交付前提、timeline / scope / dependency 边界、owner clarity
- Starter skill suggestions：
  - `会前 briefing`
  - `会后动作提炼`
  - `审批判断`

### Product / design / engineering

- Soul-lite 焦点：问题定义、切片取舍、事实修正与交付时机
- Starter skill suggestions：
  - `会前 briefing`
  - `会后动作提炼`
  - `记忆修正`

### Operations / finance / support

- Soul-lite 焦点：治理边界、readiness 诊断、例外和状态修正
- Starter skill suggestions：
  - `审批判断`
  - `试点 readiness 诊断`
  - `记忆修正`

### General operator

- Soul-lite 焦点：通用协同、会后推进、事实守准和 review-first
- Starter skill suggestions：
  - `会后动作提炼`
  - `记忆修正`
  - `审批判断`

## 5. 下一层最合理的方向

1. 把 setup/settings 里的 starter pack readout 再收紧成更清楚的 role summary vs workspace fit vs starter skills 层次
2. 让 starter pack 在 `workspace profileType + focusAreas` 之外，再叠加 tenant evidence / adoption history
3. 再决定是否把这些 starter pack 显式接到 `SkillSuggestion` operator surface
4. 让 role handoff / operating summary 等更多 surface 读到 accepted member definition 与 starter skill posture
5. 继续保持 `starter suggestion != formal skill`、`candidate capability != authority` 的边界检查
