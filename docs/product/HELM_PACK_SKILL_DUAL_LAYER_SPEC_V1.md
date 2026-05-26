---
status: draft
owner: 创始人 / 工程
created: 2026-04-30
audit:
  - 与 docs/research/competitor/OPENCLAW_TECHNICAL_DEEP_DIVE_V1.md §8 借鉴决策对齐
  - 与 docs/sales/packs/PACK_A/B/C_*_RESEARCH_V1.md 对齐（Skill 设计落地基线）
  - 与 docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md §5/§6 对齐（开源/商业边界）
  - 与 docs/partners/HELM_AI_IMPLEMENTATION_ENGINEER_CERTIFICATION_STANDARD_V1.md 对齐（认证工程师可读可改 SKILL.md）
freeze_status: 待 Pack A V2 修订引用并落地后冻结为 V1
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Helm Pack Skill 双层结构规范 V1

## 1. 目的与定位

定义 Helm Pack（商业版）暴露的 Skill 形态：**SKILL.md 自然语言操作手册（外层）+ worker TypeScript 实现（内层）**。

**这份规范不是技术文档**，是产品决策文档：定义对外 Skill 的**契约形态、可见性边界、质量门槛**，让认证工程师与客户可读、可改、可审计；让 Pack 内核保持类型化、强约束、可测试。

## 2. 核心约束（来自创始人裁决）

> 预置 Pack 对于行业有效性和作业质量和价值是第一次的成果展示，非常重要。

这句话翻译为三条**强约束**：

### 约束 A：Day-1 行业有效性
预置 Pack 必须**当天产出有效结果**——不能要求客户先调参、训练、喂数据。每个 Pack 必须自带：
- **行业种子知识库**：话术、模板、SOP、识别规则
- **行业典型 fixture**：足以让 Day-1 看板有真实可读内容
- **默认阈值与策略**：开箱可用，无需配置

### 约束 B：作业质量是核心证据
**作业质量是"成果展示"的真凭证**——不是 demo 漂亮。Pack 验收必须有：
- 量化作业质量指标（识别率、采纳率、误差、复用度）
- 可被客户业务侧验证（不是只看技术指标）
- 输出可追溯到具体的工作流环节

### 约束 C：首次落地是种子事件
**首批 design partner 客户的首日感知决定 Helm 生态启动**——Pack A 第一个 design partner 必须按三条标准慎选：
- **行业代表性**：客户能代表 ICP 1（B2B SaaS）的典型形态
- **配合度**：愿意 4 周 pilot + 每周 review 节奏
- **可公开案例性**：愿意脱敏后做对外案例（公众号 / 知乎 / Cookbook）

## 3. 双层结构定义

### 3.1 外层：SKILL.md（人可读，认证工程师可改）

每个 Pack Skill 是一个目录：
```
packs/<pack-id>/skills/<skill-id>/
├── SKILL.md                    # 自然语言操作手册（开源 + 可读）
├── seed/                       # 种子知识、模板、SOP
│   ├── playbook.md
│   ├── templates/
│   └── thresholds.yaml
├── fixtures/                   # 行业典型 fixture（Day-1 看板用）
│   └── sample-data.json
└── implementation/             # worker 实现（闭源/商业版）
    ├── worker.ts
    ├── types.ts
    └── tests/
```

### 3.2 内层：worker（强类型实现，闭源）

`implementation/worker.ts` 是 Helm worker 家族的标准实现，强类型 TypeScript，与 Helm 内核 audit chain、推荐/承诺边界、不掉案件 invariant 集成。

### 3.3 边界（关键）

| 文件 | 开源（Helm Core / Cookbook） | 商业版 Pack（闭源） |
|---|---|---|
| SKILL.md | ✅ 可发到 ClawHub / GitHub | ✅ 商业版同样发布（行业种子描述部分截短） |
| seed/ | ⚠️ 可选发开源（视行业敏感度） | ✅ 完整版进商业 Pack |
| fixtures/ | ✅ Cookbook 公开 | ✅ |
| implementation/ | ❌ **不开源** | ✅ |

## 4. SKILL.md frontmatter（Helm 标准）

借鉴 OpenClaw schema 风格，加入 Helm 必需字段：

```yaml
---
name: <slug>                          # 必填，小写+连字符
description: <≤1024 字符>             # 必填
pack: <pack-id>                       # 必填，归属 Pack（A/B/C）
version: <semver>                     # 必填
license: Apache-2.0 | proprietary     # 必填
helm:
  level: basic | pro | certified      # 决定开源/商业版可见性
  multi_tenant: true                  # Helm 必须 true（与 OpenClaw 单租户区分）
  recommendation_only: true           # 默认建议；任何 false 需创始人评审
  audit_required: true                # 进 audit chain
  invariant: case-no-drop             # 不掉案件 invariant 标记
  workspace_scope: workspace | member # 工作区/成员级
requires:
  models: [string]                    # 模型供应商列表（不绑定单一）
  connectors: [string]                # 连接器
  permissions: [string]               # 工作区权限
metadata:
  industry: <ICP id>                  # ICP 1 / 2 / 3
  trigger: <event-type>               # meeting-end / daily-09 / handoff / ...
---

# <Skill 中文名>

## 使用场景
（说人话——客户能读懂；不写技术架构）

## 输入
- 来源 1
- 来源 2

## 输出
- 形态
- 复核点（强制说明，建议 vs 承诺边界）

## 不做清单（Skill 级红线）

## 调用方式

## 示例（Day-1 看板预期）
```

**建议默认值（不锁死，由 Pack 创建者按需调整）：**
- `helm.recommendation_only: true` 是**建议默认值**——如 Pack 决定不采用需在 Pack 调研文档中说明理由
- `helm.invariant: case-no-drop` 建议 Pack B/A 默认采用，Pack C 视情况
- `helm.multi_tenant: true` 建议所有 Helm Skill 默认采用（与 OpenClaw 区分）

## 5. 三级加载策略（借鉴 OpenClaw）

| 级 | 内容 | 时机 |
|---|---|---|
| L1 名片 | name + description + pack + version + level（XML 包裹注入系统 prompt） | 工作区会话启动 |
| L2 手册 | 完整 SKILL.md（含使用场景/复核点/不做清单） | 模型判断相关时 read |
| L3 资源 | seed/ + fixtures/ 子文件 | 执行子任务时读 |

**目标 token 开销：** Pack A 4 个 Skill + Pack B 4 个 + Pack C 4 个 = 12 Skills，L1 注入约 300-500 tokens。

## 6. 加载优先级（Helm 6 层）

借鉴 OpenClaw 6 层结构，Helm 版：

1. Workspace 自定义 Skill（认证工程师为客户做的客户化）
2. Pack certified Skill（A/B/C 商业版，闭源）
3. Pack template Skill（开源 helm-pack-template 仓库）
4. Helm Cookbook Skill（开源案例）
5. Helm Core basic Skill（开源核心）
6. 第三方扩展 Skill（社区贡献）

**冲突处理：** 高优先级覆盖低优先级（与 OpenClaw 一致）。

## 7. 三条强约束的可执行翻译

### 约束 A → SKILL.md seed/ 必填项
每个 Pack Skill **必须** 包含：
- `seed/playbook.md`：行业 SOP 与典型话术
- `seed/templates/*`：≥3 个开箱即用模板
- `seed/thresholds.yaml`：默认阈值（识别率门槛、优先级权重等）

**质量门：** 没有 seed/ 的 Skill 不允许打包进 Pack 商业版。

### 约束 B → 作业质量验收
每个 Pack Skill 在 V1 落地时必须通过：
- 量化作业质量门槛（识别率 ≥ X%、采纳率 ≥ Y%、误差 ≤ Z%）—— 阈值在 SKILL.md `acceptance` 段定义
- ≥1 个真实客户场景的 fixture 复盘（Pack A pilot 验证）
- 客户业务侧（非技术）的可读输出验证

### 约束 C → 首批 design partner 标准
Pack A 第一个 design partner 选择必须满足：
- 行业代表性：30-500 人 B2B SaaS、5-50 销售团队、CRM/IM/邮箱齐备
- 配合度：4 周 pilot + 每周 1 次 review，承诺投入运营负责人级别
- 可公开案例性：脱敏后愿意做对外案例

**Helm 不接受**：纯做免费试用、无 owner、不可公开的客户作为 Pack A 第一个 design partner。

## 8. 与 ClawHub 的兼容性

| 内容 | 是否发 ClawHub | 备注 |
|---|---|---|
| Helm Cookbook Skill | ✅ 公开发 | 开源精神，扩大 Helm 影响力 |
| Pack template（不含商业 Pack 实现） | ✅ 公开发 | 让认证工程师能造 Pack 骨架 |
| Pack A/B/C 商业版 Skill | ❌ 不发 | 闭源护城河 |
| Pack Skill 的 SKILL.md（脱敏版） | ⚠️ 可选发 | 创始人按 Pack 单独裁决 |

详见 `docs/partners/HELM_COOKBOOK_TO_CLAWHUB_PUBLISHING_PROTOCOL_V1.md`。

## 9. 对 Pack A/B/C V1 的修订要求

Pack A/B/C V1 需要在 V2 修订时补：
1. 每个 Skill 的 SKILL.md frontmatter（按 §4 标准）
2. 每个 Skill 的 seed/ 必填项（按约束 A）
3. 每个 Skill 的作业质量门槛（按约束 B）
4. Pack A 第一个 design partner 标准（按约束 C）

**修订时间窗：** Pack A V2 在创始人确认 design partner 候选后启动；Pack B/C V2 在 Pack A 进入 pilot 后启动。

## 10. 决策与下一步

**待创始人拍板：**
1. §4 SKILL.md Helm frontmatter 是否采用？特别是 `helm.recommendation_only / invariant / multi_tenant` 三个强约束字段
2. §6 6 层加载优先级是否采用？
3. §7.3 Pack A 第一个 design partner 标准是否锁死？

**下一步交付物（拍板后启动）：**
- `docs/product/HELM_PACK_A_TECHNICAL_SPEC_V1.md` 含双层结构应用
- Pack A V2 修订（按本规范）
- helm-pack-template 仓库初始化（含 SKILL.md 模板）

## 11. 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 双层结构 + 三条强约束 + frontmatter schema + 三级加载 + 6 层优先级 + ClawHub 兼容 |
