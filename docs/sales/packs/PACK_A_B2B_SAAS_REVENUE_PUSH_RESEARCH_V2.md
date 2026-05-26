---
status: draft
owner: 创始人 / GTM / 工程
created: 2026-04-30
supersedes: docs/sales/packs/PACK_A_B2B_SAAS_REVENUE_PUSH_RESEARCH_V1.md
audit:
  - 选型对齐：PACK_INDUSTRY_SELECTION §5 第一名（82.5）
  - ICP 对齐：HELM_CHINA_ICP_PLAYBOOK ICP 1
  - 双层规范对齐：HELM_PACK_SKILL_DUAL_LAYER_SPEC_V1 §3-§7（强约束 A/B/C 全量落地）
  - 商业边界对齐：HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN §6
  - 认证生态对齐：HELM_AI_IMPLEMENTATION_ENGINEER_CERTIFICATION_STANDARD_V1
  - OpenClaw 借鉴对齐：OPENCLAW_TECHNICAL_DEEP_DIVE_V1 §8（SKILL.md schema + 三级加载 + 6 层加载优先级）
  - Cookbook 联动：HELM_COOKBOOK_TO_CLAWHUB_PUBLISHING_PROTOCOL_V1
v2_change_log:
  - 全量纳入双层结构（SKILL.md 外层 + worker 内层）
  - 三条强约束（Day-1 行业有效性 / 作业质量是核心证据 / 首次落地是种子事件）逐条落到 Skill 与 design partner 标准
  - 4 个 Skill 各自落地 SKILL.md 草案、seed 必填项、作业质量门槛、Day-1 fixture 范围
  - 新增 §11 design partner 选择标准（创始人裁决 C 的硬门槛）
  - 新增 §12 V1 → V2 修订对照表
archive_rule:
  - Pack A 进入正式商业版本后，本调研文档转入 archive 作为决策记录
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Pack A — B2B SaaS 销售推进 行业 Pack 调研、定位与需求 V2

## 1. 适用 ICP（不变）
B2B SaaS / 企业软件公司（与 ICP playbook ICP 1 对齐）。

**对终端客户：** 让你的销售团队在每次客户会议结束 5 分钟内，知道该跟什么、谁来跟、怎么说、哪些不能承诺、哪些需要管理者介入。

**对自媒体：** 把"会议结束→该做什么"变成可截图、可审计、可交接的推进链。

## 2. 行业调研（不变，引用 V1）
V1 §2 客群画像 / 痛点 / 工具栈盲区 / 竞品对比 / 开源传播分析全部沿用，不在 V2 重复。

## 3. Pack A 定位（不变）
- 主卖点：Meeting-to-Action / Revenue Operating Loop / Manager Attention / CS Handoff
- No-Go：客户只买纪要 / 团队没有协同链 / 客单价 < ¥5 万

## 4. 双层结构落地（V2 核心新增）

### 4.1 Pack A 目录结构
```
packs/pack-a/                                # Pack A 根目录
├── PACK.md                                  # Pack 级清单（开源摘要版）
├── pack.config.yaml                         # 默认阈值/策略/权限
├── skills/
│   ├── A1-meeting-followup/
│   │   ├── SKILL.md                         # 自然语言操作手册（开源）
│   │   ├── seed/
│   │   │   ├── playbook.md                  # 行业 SOP（强约束 A）
│   │   │   ├── templates/                   # ≥3 个跟进模板（强约束 A）
│   │   │   └── thresholds.yaml              # 默认阈值（强约束 A）
│   │   ├── fixtures/
│   │   │   └── sample-meetings.json         # Day-1 看板示例数据
│   │   └── implementation/
│   │       ├── worker.ts                    # ❌ 闭源
│   │       └── tests/                       # ❌ 闭源
│   ├── A2-priority-customers/
│   ├── A3-manager-attention/
│   └── A4-cs-handoff-pack/
└── cookbook-derivatives/                    # 脱敏后发到 ClawHub 的 Cookbook 版（@helm-cookbook 命名空间）
```

### 4.2 开源/商业版边界
| 文件 | 开源（Helm Core / Cookbook） | 商业版 Pack A（闭源） |
|---|---|---|
| PACK.md | ✅ 摘要版 | ✅ 完整版（含商业策略） |
| SKILL.md（每个 Skill） | ✅ 完整发 | ✅ 完整版（与开源版一致） |
| seed/playbook.md | ⚠️ 摘要发（关键 SOP 节选） | ✅ 完整版（含话术全集） |
| seed/templates/ | ✅ ≥3 个示例模板 | ✅ ≥10 个完整模板 |
| seed/thresholds.yaml | ✅ 默认阈值 | ✅ 含调优空间 |
| fixtures/ | ✅ 公开示例 | ✅ |
| implementation/ | ❌ | ✅ |

## 5. 三条强约束在 Pack A 的落地

### 5.1 约束 A：Day-1 行业有效性

**Pack A 必须在 30 分钟内可演示，4 小时内 Day-1 看板有真实可读内容。**

每个 Skill 的 seed 必填项：
| Skill | seed/playbook.md | seed/templates/ | seed/thresholds.yaml |
|---|---|---|---|
| A1 | 会后跟进 SOP（5 类典型会议×3 类客户阶段） | ≥3 跟进话术模板（确认/承诺/异议/沉默/再促） | 跟进延迟阈值；越界承诺识别词典初版 |
| A2 | 销售优先级判断 SOP | ≥3 优先级模板（高潜/风险/沉默） | 优先级权重默认值；客户健康度公式 |
| A3 | 销售主管介入 SOP | ≥3 介入场景模板（关键决策/承诺越界/客户升级） | 介入触发阈值；建议时机规则 |
| A4 | Handoff Pack SOP | ≥3 Handoff 模板（标准成单/复杂客户/早期客户） | Handoff 完整度评分公式 |

**质量门：** 没有 seed/ 三件齐全的 Skill **不允许打包进 Pack A 商业版**。

### 5.2 约束 B：作业质量是核心证据

**每个 Skill 必须有量化作业质量门槛 + 客户业务侧可读验证。**

每个 Skill 在 V2 SKILL.md 的 `acceptance` 段定义：
| Skill | 4 周 pilot 量化门槛 | 客户业务侧可读验证 |
|---|---|---|
| A1 跟进清单 | 跟进延迟≤30 分；采纳率≥60%；越界承诺识别准≥70% | 销售总监每周复盘抽查 5 条跟进，主观评分≥3.5/5 |
| A2 优先级 | 排序与销售主管手工排序重合度≥60% | 销售主管每日抽查"应跟未跟"漏判率 ≤20% |
| A3 主管介入 | 介入有效率≥40%；介入时机准确率≥50% | 主管每周复盘介入命中率 |
| A4 Handoff | 完整度≥3.5/5；交付/CS 接收方主观可读性≥3.5/5 | 交付/CS lead 月度复盘 |

**关键设计：** 量化门槛只是必要条件；客户业务侧（销售总监、CS lead）的主观可读性验证是充分条件。**两者都过才算 Skill 通过 V1 落地。**

### 5.3 约束 C：首次落地是种子事件

**Pack A 第一个 design partner 选择必须满足三条硬门槛**（详见 §11）。

## 6. 4 个 Skill 详细设计（V2 新增）

各 Skill 的完整 SKILL.md 草案见 `packs/pack-a/skills/<skill-id>/SKILL.md`。本节是产品需求摘要，不重复 SKILL.md 操作手册内容。

### 6.1 Skill A1：会议跟进清单
| 维度 | 内容 |
|---|---|
| 触发 | 客户会议结束（飞书/钉钉/腾讯会议事件） |
| 输入 | 录音/纪要 + CRM 商机 + 历史会话记忆 |
| 输出 | 跟进清单（谁/做什么/何时/措辞建议/不能承诺什么） |
| 复核点 | 跟进措辞默认建议；对外发送前需销售本人确认 |
| 内核 | Meeting-to-Action basic worker（开源） + follow-up draft governor（商业版） |
| Day-1 fixture | 5 个示例会议 + 5 份示例跟进清单 + 3 个越界承诺识别样例 |
| frontmatter | `helm.recommendation_only: true / invariant: case-no-drop / multi_tenant: true` |

### 6.2 Skill A2：今天该跟的 5 个客户
| 维度 | 内容 |
|---|---|
| 触发 | 每日 09:00 / 销售唤起 |
| 输入 | 活跃商机 + 7 天活动 + 跟进未完成项 |
| 输出 | 当日 5 个优先客户 + 风险标注 + 建议动作 |
| 复核点 | 排序是建议；销售可调整 |
| 内核 | Opportunity Judge shadow worker（开源 basic） + priority scorer（商业版） |
| Day-1 fixture | 30 个示例商机 + 7 天活动数据 + 优先级排序示例 |
| frontmatter | `helm.recommendation_only: true / invariant: case-no-drop / multi_tenant: true` |

### 6.3 Skill A3：销售主管的会议风险面板
| 维度 | 内容 |
|---|---|
| 触发 | 每日 / 销售主管打开 |
| 输入 | 全部销售今日会议 + 历史承诺 + 客户健康度 |
| 输出 | 需介入的 2-3 个会（原因 + 建议时机） |
| 复核点 | 介入是建议；主管自主决定 |
| 内核 | Manager Attention worker（商业版） |
| Day-1 fixture | 1 周内 50 个会议数据 + 5 个介入示例 + 主管反馈样本 |
| frontmatter | `helm.recommendation_only: true / invariant: case-no-drop / multi_tenant: true / workspace_scope: workspace（仅主管角色可见）` |

### 6.4 Skill A4：交付/CS Handoff Pack
| 维度 | 内容 |
|---|---|
| 触发 | 销售标记成单 / 进入交付前评估 |
| 输入 | 整个销售周期的会议、承诺、边界、风险 |
| 输出 | Handoff Pack（承诺清单/边界/待复核项/客户性格画像） |
| 复核点 | Handoff 默认建议；销售经理确认后正式提交 |
| 内核 | Handoff Pack worker（商业版 certified） |
| Day-1 fixture | 3 个完整销售周期数据 + 3 份示例 Handoff Pack |
| frontmatter | `helm.recommendation_only: true / invariant: case-no-drop / multi_tenant: true` |

## 7. SKILL.md frontmatter 标准（Pack A 全部 4 个 Skill 共用）

每个 Skill 的 SKILL.md 必填如下结构（按 HELM_PACK_SKILL_DUAL_LAYER_SPEC_V1 §4）：

```yaml
---
name: helm-a-<skill-id>
description: <≤1024 字符，中英双语>
pack: A
version: 1.0.0
license: proprietary
helm:
  level: certified
  multi_tenant: true            # 必须 true
  recommendation_only: true     # 必须 true（任何 false 需创始人评审）
  audit_required: true
  invariant: case-no-drop
  workspace_scope: workspace    # A3 仅主管可见，其他三个 Skill 全工作区
requires:
  models: [openai, anthropic, qwen, deepseek]   # 不绑定单一供应商
  connectors: [feishu, dingtalk, wechat-work, imap, crm-saleseasy, crm-fenxiang, crm-sfdc-cn]
  permissions: [meeting:read, crm:read, im:read, email:read]
metadata:
  industry: ICP-1-b2b-saas
  trigger: meeting-end | daily-09 | manager-open | sale-stage-change
  pack_a_skill: A1 | A2 | A3 | A4
---
```

## 8. 三级加载策略（Pack A 落地）

参照 OpenClaw 三级加载（OPENCLAW_TECHNICAL_DEEP_DIVE §4）：

| 级 | Pack A 内容 |
|---|---|
| L1 名片（启动注入系统 prompt） | 4 个 Skill 的 name + description + pack + level（XML 包裹） |
| L2 完整手册（Brain 判断相关时 read） | 完整 SKILL.md 含使用场景/复核点/不做清单/示例 |
| L3 子资源（执行子任务时读） | seed/playbook.md + seed/templates/* + fixtures/* |

**目标：** Pack A 4 个 Skill L1 总注入 ≤200 tokens（按 OpenClaw 公式 195 base + 4×97 = 583 tokens 上限；优化 description 后预期 ~200）。

## 9. 数据接入（V1 不变）
V1 §6.1 / §6.2 / §6.3 沿用：飞书/钉钉/企微会议、CRM、邮箱 IMAP、IM——按认证工程师服务空间 L1/L2/L3 分级落地。

## 10. 不做清单（V1 不变 + V2 强化）
V1 §7 全部沿用。V2 强化：
- **任何 SKILL.md 把 `helm.recommendation_only` 设为 false 建议创始人评审**（建议性，非强制锁死）
- **任何 worker 实现绕过 audit chain 的代码建议创始人评审后再合并到 main**

## 11. 第一个 Design Partner 评估参考（V2 新增，强约束 C）

**三条评估维度（建议参考，不锁死；最终由创始人按候选实情裁决）：**

### 11.1 行业代表性
- 公司规模 30-500 人 B2B SaaS
- 销售团队 5-50 人（销售 + 售前 + CS 三角色齐全）
- 客单价 ¥10 万 - ¥500 万 ARR
- 现有工具栈完整：CRM（销售易/纷享/SFDC 中国版任一）+ 飞书/钉钉/企微 + 邮箱

### 11.2 配合度
- 提供专职运营负责人（销售总监级或以上）
- 接受 4 周 pilot + 每周 1 次 review 节奏
- 接受 4 周内 ≥1 次创始人现场访谈
- 接受 Day-1 看板默认配置（不要求大幅客户化）

### 11.3 可公开案例性
- 4 周后愿意脱敏后做对外案例（公众号 / 知乎 / Helm Cookbook 三选 ≥1）
- 接受 Helm 在销售对话中引用客户名（脱敏后）
- 不接受："只做免费试用、不给案例"的客户作为第一个 design partner

### 11.4 需要慎重评估的客户类型（不锁死）
以下类型**不是绝对禁止**，创始人评估时应特别留意（必要时可接受）：
- 纯免费试用、不接受 paid POC（¥50,000）
- 没有运营负责人、要求 Helm 端"全自动"
- 拒绝任何对外曝光（即使 4 周后脱敏也拒绝）
- 业务在受控试点边界外（如政企背景的"伪 SaaS 公司"）

## 12. V1 → V2 修订对照表

| V1 章节 | V1 内容 | V2 修订 |
|---|---|---|
| §1-§3 | 适用 ICP / 调研 / 定位 | 不变（沿用） |
| §4 Skill 设计 | 4 个 Skill 描述 | **重写**为双层结构落地（§4 + §6 + 配套 SKILL.md 草案） |
| §5 Day-1 看板 | 看板示意 | 沿用 + 各 Skill Day-1 fixture 范围明确（§6 内表） |
| §6 数据接入 | 不变 | 沿用 |
| §7 不做清单 | 5 条红线 | 沿用 + V2 §10 强化 frontmatter 强约束 |
| §8 试点验收 | 6 项指标 | **重写**为作业质量量化门槛 + 业务侧可读验证（§5.2） |
| §9 渠道与定价 | 不变 | 沿用 |
| §10 风险 | 5 项 | 沿用 |
| §11 决策 | 待拍板 4 项 | 更新为 V2 待拍板 |
| - | - | **§4 双层结构（新）** |
| - | - | **§5 三条强约束（新）** |
| - | - | **§6 4 个 Skill 详细设计（新）** |
| - | - | **§7 frontmatter 标准（新）** |
| - | - | **§8 三级加载策略（新）** |
| - | - | **§11 design partner 三条硬门槛（新）** |
| - | - | **§13 配套交付物清单（新）** |

## 13. 配套交付物（V2 同时落地）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/sales/packs/pack-a/skills/A1-meeting-followup/SKILL.md` | A1 SKILL.md 草案 | ✅ V2 落地 |
| `docs/sales/packs/pack-a/skills/A1-meeting-followup/seed/playbook.md` | A1 SOP 骨架 | ✅ V2 骨架 |
| `docs/sales/packs/pack-a/skills/A1-meeting-followup/seed/templates/*` | A1 ≥3 模板（占位） | ✅ V2 占位 |
| `docs/sales/packs/pack-a/skills/A1-meeting-followup/seed/thresholds.yaml` | A1 默认阈值 | ✅ V2 占位 |
| 同上 A2 / A3 / A4 | | ✅ V2 骨架 |
| `docs/sales/packs/pack-a/PACK.md` | Pack A 清单 | ✅ V2 落地 |
| `docs/sales/packs/pack-a/pack.config.yaml` | Pack A 默认配置 | ✅ V2 落地 |

后续（不在 V2 范围）：
| 路径 | 状态 |
|---|---|
| `docs/sales/packs/PACK_A_DESIGN_PARTNER_INTERVIEW_PROTOCOL.md` | ✅ 已落地（候选验证电话协议） |
| `docs/sales/packs/PACK_A_PILOT_RUNBOOK_V1.md` | ✅ 已落地（4 周 pilot 执行模板） |
| `docs/sales/packs/PACK_A_LANDING_COPY_V1.md` | 待启动 |
| `docs/product/HELM_PACK_A_TECHNICAL_SPEC_V1.md` | ✅ 已落地（目标技术规范，非 runtime 实现） |

## 14. 风险与未决问题（V1 §10 沿用 + V2 新增）
V1 5 项沿用。V2 新增：
6. **三级加载在 Pack A 实际 token 开销可能高于预期**——需要 Pack A V2.5 实测后校准
7. **认证工程师对 SKILL.md 双语写作的成本**——可能减缓 L2 续期内容贡献节奏；需要在 helm-cookbook 模板中提供双语骨架
8. **Day-1 fixture 的真实性**——种子数据如果太"假"会让 design partner 第一印象差；需要从 ICP playbook 客户访谈中抽取真实形态后脱敏

## 15. 决策与下一步

**待创始人拍板：**
1. §11 design partner 三条硬门槛是否锁死？
2. §6 4 个 Skill 的"内核"列里"商业版 worker"是否就这套命名？
3. §7 frontmatter 是否就此采用？特别是 `requires.models` 的多供应商列表
4. §13 配套交付物的骨架文件路径是否就此确定？

**下一步交付物（拍板后启动）：**
1. design partner 候选评估表（按 §11 三条硬门槛对手上线索打分）
2. helm-pack-template 仓库初始化（含本 V2 落地的 4 个 Skill 骨架）
3. Pack A landing copy
4. Pack A 技术实现 PRD / API contract / migration plan（进入代码前）

## 16. 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 | 首次落地，基于选型 §5 第一名（82.5）+ ICP 1 + commercial boundary §6 |
| 2026-04-30 | V2 草稿 | 全量纳入双层结构 + 三条强约束 + 4 个 Skill 详细设计 + design partner 硬门槛 |
