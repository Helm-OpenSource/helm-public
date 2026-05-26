---
status: active
owner: 创始人 / GTM
created: 2026-04-30
review_after: 2026-05-15
archive_trigger:
  - Pack A 第一个 design partner 完成 Week 1 review 且本文件被实跑复盘版替代后 30 天归档
  - 连续 10 个候选验证电话完成后若评分字段被实际弃用则归档并以新评分卡替换
---

# Pack A OPC 市场验证系统

## 1. 结论

Pack A 现在不需要再写更漂亮的市场报告，而要进入 **证据驱动的 OPC 市场验证系统**。

系统只回答三个问题：

1. 谁最痛。
2. 谁愿意付费。
3. 谁能在 4 周内给出可公开或半公开 proof。

当前拍板：

1. 第一切口锁定 **B2B SaaS / 企业软件 / AI 服务商的销售推进与交付 handoff**。
2. 暂不扩成通用 AI agent、数字员工平台、CRM 替代、会议纪要工具或 BI 工具。
3. 第一个 design partner 必须通过失败事件、owner、数据、proof、付费、边界六项验证。
4. Founder-led direct sales 是首批成交主路径；开源与社区短期服务信任，不作为首批商业转化主引擎。

## 2. 外部建议吸收判断

| 建议 | 处理 | 原因 |
|---|---|---|
| 从报告转向 OPC 市场验证系统 | 吸收 | 与 founder-led、4 周 paid pilot、proof pack 的当前节奏一致 |
| 聚焦 B2B SaaS / 企业软件 / AI 服务商 | 吸收 | 最贴近客户会议后的收入推进闭环，且数据 / owner / proof 可得性最高 |
| 先问失败事件，不先问 AI 意愿 | 吸收 | 能最快过滤“想试 AI”但没有真实预算和责任人的候选 |
| 增加预算归属调研 | 吸收 | 个人效率预算无法支撑 Pack A 的 workflow / proof / review 价值 |
| 增加数据接入摩擦调研 | 吸收 | 第一个 design partner 不能卡在长安全评估和内网部署 |
| proof 可公开性前置 | 吸收 | 第一个客户不仅验证产品，也要产生市场证据 |
| review-first 作为产品边界，但销售表达需改写 | 改写 | 不直接卖“AI 不自动发送”，而要卖“减少错承诺 / 错外发 / CRM 污染”；否则买方可能理解为自动化不够强 |
| ¥50,000 paid pilot | 改写 | 作为 Pack A design partner 默认锚点；可在 Top 2-3 中测试 ¥30k / ¥50k / ¥80k，但不先降成免费 PoC |
| Belkins / Snowflake 等二手数字 | 暂不采用为 repo truth | 未拿到原始来源前，只可作为访谈背景，不进入对外 claim |
| 把 Helm 讲成 AI agent / 数字员工 | 拒绝 | 会把 Helm 拉入同质化和高风险自动执行叙事 |

## 3. 六条市场假设

| 假设 | 要验证什么 | 通过信号 | Stop 信号 |
|---|---|---|---|
| H1 会后 48 小时推进断层足够痛 | 过去 30 天是否有真实漏跟进、客户等待、越界承诺、handoff 断层 | 候选能说出 ≥3 个具体失败事件，且影响 pipeline / 续约 / 交付 | 只有泛泛效率诉求，无法说出事件 |
| H2 客户接受 review-first 风险控制 | 是否认可建议、草稿、复核先于高风险动作 | 销售负责人能说出误发、误承诺或 CRM 污染的具体损失，并认为 review-first 能降低风险 | 认为 review-first 只是“AI 不够自动化”，坚持自动群发、自动改 CRM、自动承诺成交 |
| H3 首批 design partner 来自 founder 网络 | warm intro 是否明显优于冷启动 | 20 个候选中 ≥8 个来自创始人人脉或近场转介绍 | 冷启动消耗高且无 owner 回复 |
| H4 ¥50,000 paid pilot 可接受 | 强痛点客户是否能接受 paid pilot | 能说出预算 owner，接受 ¥50k 或提出可谈的付费结构 | 只要免费试用，无预算 owner |
| H5 开源短期贡献信任，不贡献首批成交 | 开源材料是否帮助技术评审和信任，而非直接成交 | 客户愿意用开源材料做技术评审，但签约仍来自 founder-led | 把社区数据误写成商业 pipeline |
| H6 “经营推进控制台”优于泛 AI 文案 | 哪套语言更触达买方 | 买方复述“客户会议后的收入推进闭环 / 建议 vs 承诺” | 买方只把 Helm 理解为会议纪要或聊天工具 |

### 3.1 左右互博后的强制修正

本节来自 2026-04-30 的 Codex / Claude 双路红队审计。它不改变六条假设，但改变验证方式：

1. `review-first` 不作为第一销售卖点；第一销售表达必须落到“避免错承诺、错外发、CRM 污染”等具体损失。
2. `¥50,000` 只保留为默认报价锚点；Top 2-3 scope call 中必须同时测试 `¥30k / ¥50k / ¥80k` 三档，不接受 0 元 PoC。
3. Business Advancement runtime / Phase 3 calibration 没有 redacted 或 live-like 证据前，Pack A pilot 只能承诺 read-first / manual-review / review-first workspace，不承诺 production runtime adoption。
4. 第一个 paid pilot 的 4 周验收不再用单一 `8/10` 一票通过门；改用 `4/10 继续观察`、`6/10 续约谈判`、`8/10 公开 proof` 的分层门。
5. 开源只作为技术信任和评审材料，不进入 12 个月商业获客或 ARR 假设。
6. founder-led direct sales 不能等于 founder-only delivery；Top 1 进入 scope call 前必须指定 GTM operator 或 implementation lead 的临时责任人，否则首个 pilot 会吞掉后续候选池。

## 4. 100 分 OPC 评分卡

第一个 design partner 不建议低于 75 分。

| 维度 | 分值 | 高分标准 | 低分信号 |
|---|---:|---|---|
| 客户痛点 | 25 | 最近 30 天有 ≥3 个真实推进断层，能说清角色、时间、影响和补救 | 只有“想 AI 化”或泛效率诉求 |
| 业务 owner | 20 | 销售 VP / 销售总监 / 创始人 / COO 当场愿意每周 review | 只有创新部门、IT 或一线个人感兴趣 |
| 数据可得性 | 20 | 一周内可提供脱敏会议、CRM、handoff 样本，或标准 CRM + 手工导出 | 需要长安全评估、内网部署或无法导出 |
| proof 价值 | 15 | 允许匿名指标、脱敏截图、案例文章、销售 reference 任一组合 | 完全不能公开任何结果，也不允许内部指标复盘 |
| 付费意愿 | 15 | 接受 paid pilot，能说出预算 owner 和审批路径 | 只想免费试用或无法说明预算归属 |
| 边界匹配 | 5 | 接受 recommendation != commitment、draft != send、review-before-commitment | 坚持自动外发、自动改系统、自动成交 |

评分规则：

| 总分 | 决策 |
|---:|---|
| ≥80 | Top 1 / Top 2，进入 45 分钟 scope call |
| 70-79 | 候选池，适合作为备用 design partner |
| 60-69 | Nurture，只保留关系，不进首批 pilot |
| <60 | No-Go |

### 4.1 付费验证与定价解释

Pack A 不能按会议纪要工具或 CRM 插件报价解释。它的首批 paid pilot 价格是验证真实经营推进价值和客户投入强度的筛选器。

| 价格锚点 | 适用判断 | 处理 |
|---|---|---|
| `¥30k` | 客户痛点真实、数据可给、proof 可能，但预算审批保守 | 可接受，但必须锁定 Week 0 数据、每周 review 和 proof 姿态 |
| `¥50k` | 默认 design partner 锚点 | 优先报价；成功后可抵扣标准订阅或后续季度观察 |
| `¥80k` | 高客单、高 proof 价值、需要更多 founder / 工程投入 | 只在 owner 强、数据清楚、proof 强时测试 |
| `0 元 PoC` | 客户想试 AI 但无预算 owner 或 proof 承诺 | 默认拒绝；可转 nurture 或只做一次诊断电话 |

对外解释顺序：

1. 先讲“客户会议后 48 小时收入推进断层”。
2. 再讲 paid pilot 交付内容：失败事件 baseline、Must Push 候选、review action、handoff proof、边界审计。
3. 最后才讲订阅价或 Enterprise 价。不要在首屏同时展示 `¥9,800 / ¥19,800 / ¥29,800`、`¥50k`、`¥29,800 年付` 和 `¥200k+ Enterprise`。

### 4.2 离线 readiness gate

为了把市场判断、销售推进、Week 0 启动和 Pack A Skill 交付物集成到同一套证据链，当前仓库新增：

```bash
npm run eval:pack-a-pilot-readiness
```

该 gate 使用 `evals/pack-a/pilot-readiness-cases.json` 中的 alias-only fixture，不包含真实客户名称、联系人、会议原文或 CRM 数据。它会同时检查：

1. Pack A OPC 六维评分是否命中 `scope_call_ready / candidate_pool / no_go`。
2. Week 0 是否具备合同、DPA、数据清单、工作区、每周 review、客户 owner、创始人 Day-1、GTM operator、implementation lead。
3. 是否出现 No-Go：0 元 PoC、budget owner 不明、要求自动外发 / CRM 写入、数据不可得、proof 不可用或 Phase 3 runtime overclaim。
4. Pack A 4 个 Skill 是否具备 `SKILL.md`、fixture、seed playbook、thresholds 和模板。

该 gate 只做 **readiness 判断**，不替代创始人决策、客户合同、DPA、法务 review、数据保护 review 或客户授权。

## 5. 失败事件采集

每个候选电话至少采集 3 类失败事件，不接受抽象描述。

失败事件模板：

```markdown
- event_alias:
- occurred_at: 最近 30 天内 / 30-90 天 / 更久
- failure_type: missed_followup | customer_waiting | over_commitment | handoff_gap | manager_blindspot
- roles_involved:
- business_impact:
- current_workaround:
- owner_of_recovery:
- proof_possible: yes | maybe | no
```

优先级：

1. 客户等待无人处理。
2. 会后 48 小时无人推进。
3. 销售承诺越界或交付边界不清。
4. 销售到 CS / 交付 handoff 丢上下文。
5. 管理者只能靠周会或群消息发现风险。

## 6. 预算归属调研

每通电话必须问：

> 如果这件事真的解决，你们会从哪个预算付钱？谁有审批权？

优先预算锚点：

1. 销售提效预算。
2. RevOps / BizOps 预算。
3. 交付 / CS 协同预算。
4. AI 项目预算。
5. 企业软件实施预算。

不优先锚定：

1. 个人效率工具预算。
2. 泛办公软件预算。
3. 会议纪要工具预算。

## 7. 数据接入摩擦分层

| 分层 | 条件 | 决策 |
|---|---|---|
| A 一周内可手工脱敏样本 | 会议、CRM、handoff 可导出或手工整理 | 优先 Top 1 |
| B 标准 CRM + 会议样本 | 销售易 / 纷享销客 / HubSpot / Salesforce 等标准实例，IT owner 可配合 | 优先候选 |
| C 自研系统但可手工导出 | 连接器慢，但样本可先跑 | 候选池 |
| D 只能内网部署和长安全评估 | 首周无法拿样本或需要长期采购流程 | 第二阶段，不做第一个 |
| E 数据完全不能出域也不能脱敏 | 无法验证 Pack A 首批闭环 | No-Go |

## 8. Proof 姿态

第一个 design partner 的 proof 价值必须前置验证。

| 姿态 | 含义 | 是否适合第一个 |
|---|---|---|
| approved public | 可公开公司名或联合发布 | 很强，但不强求 |
| anonymized public | 可发脱敏案例、匿名指标、流程图 | 最适合第一个 |
| semi-public reference | 可在销售私聊中匿名引用 | 可作为备用 |
| internal-only proof | 仅内部复盘 | 可学习，但不适合作为市场破局样本 |
| no proof | 不允许任何指标或样例复盘 | No-Go |

## 9. 30 天 OPC 验证节奏

### Week 1：候选池

目标：完成 20 家候选 desk research。

候选结构：

1. B2B SaaS / 企业软件：10 家。
2. AI 服务商 / SI：6 家。
3. 高客单传统数字化团队：4 家。

只填公开信息和私有线索，不做重报告。

### Week 2：验证电话

目标：完成 8-10 个 30 分钟电话。

只验证：

1. 真实失败事件。
2. owner。
3. 数据接入。
4. proof。
5. paid pilot / 预算 owner。
6. review-first 边界。

### Week 3：Scope Call

目标：选出 Top 2-3，完成 45 分钟 scope call。

必须加入：

1. 销售负责人。
2. IT / 法务联系人。
3. pilot owner。
4. Helm founder / GTM owner。

必须回答：

1. Week 0 数据清单。
2. DPA 与跨境路径。
3. 会议样本。
4. review 节奏。
5. 4 周 pass / stop 标准。
6. proof pack 可用范围。
7. paid pilot 价格锚点：客户能否接受 `¥30k / ¥50k / ¥80k` 的哪个档位，以及预算 owner 是谁。
8. 交付责任人：客户侧 owner、Helm implementation lead、GTM operator 是否明确。

### Week 4：签约或中止

目标：签第一个 paid pilot，或主动中止并保留候选池。

Go 条件：

1. 总分 ≥75。
2. 客户接受 paid pilot 或给出明确付费结构。
3. Week 0 数据边界清楚。
4. Week 1 可看到可用输出。
5. DPA 与 proof 姿态可进入启动准备。
6. Phase 3 calibration 状态明确：若没有 redacted/live-like 证据，合同与 kickoff 必须写清 `read-first / manual-review` 姿态，不写 production runtime adoption。
7. Helm 内部已经明确 founder / GTM operator / implementation lead 的最小责任分工，避免创始人全量交付导致候选池中断。

No-Go 条件：

1. owner 不出现。
2. 只想免费试用。
3. 数据接入不可达。
4. proof 完全不可用。
5. 要求 Helm 自动外发、自动审批、自动改系统。
6. 要求 Helm 把 synthetic / fixture / local rehearsal 结果写成真实生产判断能力。
7. 需要创始人全程销售 + 全程交付 + 全程复盘，且没有任何可接手的 GTM 或 implementation 角色。

## 10. 每日 OPC 节奏

每天只做三件事：

1. 新增 5 个候选。
2. 完成 2 个访谈或触达。
3. 更新 1 次评分榜。

每日输出只需一张脱敏表：

| Alias | Segment | Score | Decision | Blocking Question | Next Step |
|---|---|---:|---|---|---|
| SaaS-A | B2B SaaS | 82 | Top 1 | DPA / 数据样本 | 45 min scope call |
| SI-B | AI 服务商 | 76 | Backup | proof 许可 | 二次确认 |
| SaaS-C | B2B SaaS | 61 | Nurture | owner 不清 | 30 天后回访 |

Week 1 的可执行细化见 [PACK_A_OPC_WEEK1_EXECUTION_PACK.md](./PACK_A_OPC_WEEK1_EXECUTION_PACK.md)，候选 tracker 模板见 [PACK_A_OPC_CANDIDATE_TRACKER_TEMPLATE.csv](./PACK_A_OPC_CANDIDATE_TRACKER_TEMPLATE.csv)。

## 11. 外部证据使用规则

当前已可作为方向性证据的来源：

1. 中国信通院《人工智能客户关系管理系统研究报告（2025 年）》：AI CRM 进入企业智能化转型和合规治理语境，可支持 Helm 避免“纯工具”叙事。来源：https://www.caict.ac.cn/kxyj/qwfb/ztbg/202509/P020250915603971582825.pdf
2. 纷享销客转载 IDC 市场跟踪数据：可作为 CRM SaaS 预算仍在的二手信号；未拿到 IDC 原文前，不作为强 claim。来源：https://www.fxiaoke.com/crm/news-81438.html
3. Otter 2026 meeting assistant 文案：会议 AI 已从 transcript 走向 action items、CRM sync、follow-up drafts，可作为竞争压力信号。来源：https://otter.ai/blog/best-ai-meeting-assistant
4. The Verge 对 Otter Meeting Agent 的报道：会议助手正在进入会中代理、跨会议问答、起草邮件方向，可作为“会议总结红海化”的外部信号。来源：https://www.theverge.com/news/635176/otter-ai-voice-activated-meeting-agent-availability

不得直接进入对外材料的来源：

1. 未核验原文的 sales follow-up 统计。
2. 未核验原文的企业 pilot 定价案例。
3. 任何来自竞品博客但未标明原始研究方法的数据。

## 12. 对 Codex / Claude 的回执协议

创始人只需要向 Codex / Claude 回传脱敏信息：

```markdown
Today OPC update:

- New candidates added: 5
- Calls completed: 2
- Top candidates:
  - SaaS-A: 82, Top 1, data medium, proof maybe, owner strong
  - SI-B: 76, Backup, data high, proof yes, owner medium
- Founder decision needed:
  - SaaS-A 是否进入 scope call
  - ¥50k 是否保持默认报价锚点
```

不要发送：

1. 客户真实名称。
2. 联系人姓名、电话、邮箱。
3. CRM 截图、会议原文、邮件原文。
4. 未经授权的客户交易金额。
5. 客户内部组织结构和预算细节。

## 13. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 将市场调研收敛为证据驱动 OPC 市场验证系统、100 分评分卡、30 天节奏和每日回执协议 |
| 2026-05-01 | V1.1 | 新增 `eval:pack-a-pilot-readiness` 离线 readiness gate，把 OPC 评分、Week 0 条件和 Pack A 4 Skill 集成覆盖合成可运行验证 |
