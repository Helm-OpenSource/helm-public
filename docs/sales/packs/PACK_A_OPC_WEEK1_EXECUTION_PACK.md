---
status: active
owner: 创始人 / GTM
created: 2026-04-30
review_after: 2026-05-15
archive_trigger:
  - Pack A Week 1 完成 20 家候选 desk research 且形成 Top 2-3 scope call 决策包后 30 天归档
  - Pack A OPC 市场验证系统被实跑复盘版替代并完成 docs/README.md 索引切换后 30 天归档
---

# Pack A OPC Week 1 执行包

## 1. 结论

本执行包用于绕开“先等创始人整理完整私域客户名单”的阻塞：先用公开安全的候选池结构、脱敏 tracker 和固定节奏跑起来。

Week 1 只做三件事：

1. 建立 20 个候选 alias。
2. 每个候选只填公开信息和创始人私有线索摘要。
3. 按 OPC 六项评分卡选出 Top 8-10 个进入 30 分钟验证电话。

不做：

1. 不把真实客户名单、联系人、电话、邮箱、CRM 截图写入仓库。
2. 不做正式 sales deck。
3. 不承诺 pilot。
4. 不把公开信息 desk research 写成客户已认可。

## 2. Week 1 Done 定义

| 项 | Done 条件 |
|---|---|
| 20 个候选 alias | `SaaS-01` 到 `SaaS-10`、`SI-01` 到 `SI-06`、`Digital-01` 到 `Digital-04` 全部建行 |
| 每行最低信息 | segment、buyer hypothesis、failure hypothesis、data hypothesis、proof hypothesis、warm intro path |
| 初筛分 | 每个候选给出 0-100 初筛分；分数低可信也必须诚实标注 |
| Top 队列 | 至少选出 8 个进入 30 分钟验证电话 |
| 风险过滤 | 明确 No-Go：只要会议纪要、无 owner、数据不可达、只想免费试用、要求自动外发 |

## 3. 候选池结构

| Alias 范围 | Segment | 数量 | 目标 |
|---|---|---:|---|
| `SaaS-01` 到 `SaaS-10` | B2B SaaS / 企业软件 | 10 | 首选，验证客户会议后的收入推进闭环 |
| `SI-01` 到 `SI-06` | AI 服务商 / SI / 咨询交付 | 6 | 验证销售到交付 handoff、承诺边界和方案变更 |
| `Digital-01` 到 `Digital-04` | 高客单传统数字化团队 | 4 | 验证高客单、多角色、长周期销售推进 |

候选 alias 与真实公司映射只保存在创始人私有表，不提交 repo。

## 4. Desk Research 字段

每个候选只填以下字段：

| 字段 | 说明 |
|---|---|
| `alias` | 脱敏代号 |
| `segment` | SaaS / SI / Digital |
| `source_type` | warm_intro / founder_network / public_research / partner_referral |
| `buyer_hypothesis` | 可能买方：CEO / COO / 销售 VP / 交付负责人 / CS lead |
| `failure_hypothesis` | 可能失败事件：漏跟进 / 客户等待 / 越界承诺 / handoff 断层 |
| `data_hypothesis` | 可能数据路径：手工样本 / 标准 CRM / 自研系统 / blocked |
| `proof_hypothesis` | 可能 proof 姿态：anonymized public / semi-public / internal-only / no proof |
| `budget_hypothesis` | 预算锚点：销售提效 / RevOps / AI 项目 / 交付协同 |
| `warm_intro_path` | 私有线索路径摘要，不写真实人名 |
| `next_step` | enrich / call / nurture / no-go |

## 5. 每日执行节奏

每天 45-60 分钟，严格压缩：

| 时间 | 动作 | 输出 |
|---:|---|---|
| 0-10 分钟 | 新增或补齐 5 个候选 alias | tracker 新增 5 行 |
| 10-25 分钟 | 对 5 个候选做公开信息 / 私域摘要补齐 | 每行完成 6 个 hypothesis 字段 |
| 25-40 分钟 | 初筛打分 | 每行给出分数和 score_confidence |
| 40-50 分钟 | 更新 Top 队列 | 今日 Top 8-10 排序 |
| 50-60 分钟 | 写给 Codex / Claude 的脱敏回执 | 今日新增、今日电话、阻塞问题 |

## 6. 初筛评分规则

初筛不是最终分。它只决定是否值得打一通 30 分钟电话。

| 维度 | 分值 | Week 1 可用证据 |
|---|---:|---|
| 客户痛点 | 25 | 公开材料 / 私域判断能否推断复杂销售、会后推进、handoff、客户等待 |
| 业务 owner | 20 | 是否可能触达到销售 VP / COO / founder，而不是只有 IT / 创新部门 |
| 数据可得性 | 20 | 是否可能一周内拿到脱敏会议、CRM、handoff 样本 |
| proof 价值 | 15 | 是否有公开案例习惯、行业曝光意愿、匿名指标可讲空间 |
| 付费意愿 | 15 | 是否有明确销售提效 / RevOps / AI 项目预算可能 |
| 边界匹配 | 5 | 是否更需要受控推进，而不是要求自动群发或替代 CRM |

`score_confidence` 必须单独标注：

| 值 | 含义 |
|---|---|
| low | 主要来自公开信息推断 |
| medium | 有私域线索但未电话验证 |
| high | 已完成电话验证 |

## 7. Claude Code 分工

Claude Code 可以做：

1. 根据创始人提供的候选 alias 和公开官网链接，补齐公开字段。
2. 按 tracker 字段输出初筛摘要。
3. 帮忙把 30 分钟电话后的脱敏笔记转成评分。
4. 检查是否有过度承诺、自动执行、客户隐私泄漏。

Claude Code 不能做：

1. 自行推断真实联系人。
2. 把真实客户名、联系人、电话、邮箱写入 repo。
3. 替创始人承诺电话、价格、合同、DPA 或 proof 授权。
4. 把低可信公开信息写成事实。

## 8. Codex 审计口径

Codex 每次只审四件事：

1. 分数是否来自证据，而不是主观兴奋。
2. 是否把 planning / hypothesis 写成 customer truth。
3. 是否泄漏真实客户或联系人信息。
4. 是否违反 recommendation != commitment、draft != send、review-before-commitment。

## 9. Week 1 到 Week 2 的交接门

进入 30 分钟验证电话前，每个候选必须满足：

1. 总分 ≥60，或创始人明确认为有战略意义。
2. 至少有一个可能 buyer。
3. 至少有一个可验证失败事件假设。
4. 数据接入不是明确 blocked。
5. 没有明显 No-Go：只想会议纪要、只要免费试用、要求自动执行、完全不能 proof。

## 10. 相关文件

| 文件 | 用途 |
|---|---|
| [PACK_A_OPC_MARKET_VALIDATION_SYSTEM.md](./PACK_A_OPC_MARKET_VALIDATION_SYSTEM.md) | 总系统、六条假设、100 分评分 |
| [PACK_A_OPC_CANDIDATE_TRACKER_TEMPLATE.csv](./PACK_A_OPC_CANDIDATE_TRACKER_TEMPLATE.csv) | 可导入飞书 / Excel 的空白 tracker |
| [PACK_A_CANDIDATE_CALL_SCRIPT_CN.md](./PACK_A_CANDIDATE_CALL_SCRIPT_CN.md) | 30 分钟验证电话脚本 |
| [PACK_A_SCOPE_CALL_SCRIPT_CN.md](./PACK_A_SCOPE_CALL_SCRIPT_CN.md) | Top 2-3 的 45 分钟 scope call 脚本 |
| [PACK_A_CANDIDATE_PRIVATE_NOTE_TEMPLATE.md](./PACK_A_CANDIDATE_PRIVATE_NOTE_TEMPLATE.md) | 私有候选记录模板 |

## 11. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 新增 Pack A OPC Week 1 执行包，绕开私域名单等待阻塞，定义 alias、tracker、初筛与交接门 |
