---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm v0.1.0-trial Launch Post — Draft V1

更新时间：2026-04-27
状态：草稿（owner 在 Week 5 #37 最终修订前可改）
版本目标：`v0.1.0-trial` 公开 release 当日发布
渠道：GitHub repo README banner / 官网 blog / 微信公众号 / X (Twitter) / LinkedIn

---

## 一、本文件的定位

这是 v0.1.0-trial 公开发布日的对外文案草稿。

它**不**替代：

- [HELM_PUBLIC_ROADMAP.md](../roadmap/HELM_PUBLIC_ROADMAP.md) — 路线图全文
- [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md) — 试用须知与 oncall
- [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) — 数据政策

它**只**是发布日推文 / 博客 / 内部分享的口径范本，统一给：

- 中英双版正文（每个段落一致）
- 4 渠道短版（GitHub README banner / X / LinkedIn / 微信公众号）
- 不要踩的 4 条措辞红线（commitment / SLA / marketplace / auto-execution）

文案在发布前必须经过 Product Owner + Data Protection Officer 双签。

---

## 二、文案红线（不要踩）

发布日所有渠道、所有翻译版本**不得**出现下列措辞：

| 红线 | 原因 |
| --- | --- |
| 「我们承诺 99.x% 可用性」 / "we commit to X% uptime" / 任何 SLA 数字 | v0.1.0-trial 明确 no-SLA；写出数字即合同风险 |
| 「Helm 帮你自动审批 / 自动发送 / 自动结算」 | 受控试点姿态；自动执行平面是 Out of scope |
| 「marketplace」 / 「应用市场」 / 「插件商店」 | Out of scope |
| 「保证 X 天内回复你的反馈」 | 试用支持仅周一至周五 9:00-18:00 (UTC+8)；不承诺周末 / 节假日 |
| 「LLM 帮你做最终决策」 | LLM 仅做解释 / 文案 / 压缩；ranking 必须 deterministic |
| 「Helm 知道你公司的所有数据」 | workspace-first 隔离；不跨 workspace 聚合 |
| 「升级到企业版享受不限时数据保留」 | v0.1.0-trial 没有「企业版」；试用只有 30 天 active + 7 天 grace |
| 任何把建议写成承诺的句式：「会做」「将自动」「我们决定」 | recommendation ≠ commitment 是 Helm 核心边界 |

---

## 三、中文长版（约 800 字，blog / 公众号长文）

### 标题

**Helm v0.1.0-trial 开放：受控试点的经营推进控制台**

副标题：把会议、邮箱、CRM 收敛成必须推进项与正式复核入口；Apache-2.0 开源 + 阿里云 cn-hangzhou 云端试用

### 正文

今天我们公开发布 Helm 的第一版：`v0.1.0-trial`。

**Helm 是什么**

Helm 是一套面向受控试点（controlled trial）的经营推进控制台。它把会议、邮箱、CRM 与企业内部信号收敛成统一推进链，每天告诉团队和 AI 员工**今天最重要的经营动作是什么**、**为什么这样判断**、以及**正式复核应该走哪一步**。

它**不是**：完整企业平台、自动执行系统、Marketplace、通用聊天产品。它**默认不**自动外发邮件 / 钉钉 / 企微 / 短信，**默认不**自动审批 / 结算 / 付款。所有 LLM 输出都明确标记为「建议」而非「承诺」。

**为什么是受控试点**

受控试点不是「未完成」的别名，而是 Helm 的产品边界。我们刻意把以下方向标记为「刻意不做」：完整 SSO / SCIM、跨 workspace 自动聚合、自动执行平面、LLM 做最终排序、多轮聊天历史持久化。每一条都对应一个真实的可信度风险，而不是路线图未到。

完整的「能做 vs 刻意不做」表见 [HELM_PUBLIC_ROADMAP.md](../roadmap/HELM_PUBLIC_ROADMAP.md)。

**今天发布了什么**

- **`/mobile` Mobile Command Surface**：当前 workspace 的窄手机端经营推进入口，第一屏整合 Ask Helm 答复、必须推进项、复核 / 记忆 / 运营承接
- **`/operating` Operating console**：判断 / 决策 / 边界三层组织的经营推进主表面
- **`/approvals`**：审批承接面，明确建议与承诺边界
- **`/memory`**：经营记忆，事实 / 行动二级提升，review-first 写入
- **Ask Helm（`/search?mode=ask`）**：行动意图入口，可回答、计划分解、起草草稿、生成内部 handoff（不发送、不承诺）
- **完整 trace 审计链路**：`AuditLog` 强制带 `traceId / requestId / parentEventId`，每条客户可见动作可在 `/memory` 回放（DingTalk Directory 邀请等 connector 默认 dryRun，live send 必须显式 confirmation）
- **Apache-2.0 开源**：完整源代码 + 治理文档套（CONTRIBUTING / SECURITY / CODE_OF_CONDUCT / CHANGELOG）
- **`docker compose up` 5 步起本地**：`git clone && docker compose up && open http://localhost:3000/mobile`
- **阿里云 cn-hangzhou 公开试用**：30 天 active + 7 天 grace + 物理删除 + 删除证明邮件；no-SLA

**两条同时为真的事**

- 我们对路线图的方向和 controlled-trial 边界**很坚定**
- 我们对节奏和 v0.2 内容**不预承诺**

如果你需要的是「企业级，今天就能换掉现有 stack」的产品，Helm 还不是。如果你愿意在受控试点姿态里和我们一起评估「经营推进控制台」是否对你的团队有价值，欢迎走 [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md) 的注册流程。

**反馈与贡献**

- GitHub Issues：方向、bug、文档勘误
- 安全漏洞：私下渠道见 [SECURITY.md](../../SECURITY.md)，不要在公开 issue 披露
- 试用支持：trial-support@helm.run（周一至周五 9:00-18:00 UTC+8，不承诺 7×24）

愿意帮我们改进的方向：bug 修复 + 测试、文档双语同步、本地化、只读连接器、可访问性。会改 schema / 引入自动写入 / 扩展 sandbox / marketplace / orchestration 平台能力的方向请先开 issue 讨论。

发布版本号：`v0.1.0-trial` · License：Apache-2.0 · 仓库：github.com/Helm-OpenSource/helm-public

---

## 四、英文长版（约 800 words）

### Title

**Helm v0.1.0-trial: A controlled-trial console for receipt-driven advancement**

Subtitle: Collapses meetings, email, CRM into must-push items and formal review handoffs. Apache-2.0 open source + Aliyun cn-hangzhou public trial.

### Body

Today we publicly release the first version of Helm: `v0.1.0-trial`.

**What Helm is**

Helm is a controlled-trial advancement console for operating teams. It collapses meeting, email, CRM, and internal signals into a single push chain that tells the team — and the AI workers in the workspace — every day **what the most important business action is**, **why Helm thinks so**, and **which formal-review step you should hand off to**.

It is **not** a complete enterprise platform, **not** an auto-execution system, **not** a marketplace, **not** a general chat product. It does **not** auto-send email / DingTalk / WeCom / SMS by default; it does **not** auto-approve / settle / pay. Every LLM output is explicitly framed as a *recommendation*, not a *commitment*.

**Why "controlled trial" is a feature, not a delay**

"Controlled trial" is the product boundary, not a synonym for "incomplete." We deliberately mark the following as *intentionally not done*: full SSO / SCIM, cross-workspace auto-aggregation, an auto-execution plane, LLM as the final ranking authority, multi-turn chat history persistence. Each corresponds to a real trust risk, not a roadmap that hasn't arrived yet.

The full "what we do vs. what we deliberately don't" table is in [HELM_PUBLIC_ROADMAP.md](../roadmap/HELM_PUBLIC_ROADMAP.md).

**What ships today**

- **`/mobile` Mobile Command Surface** — a narrow mobile entry that pulls together Ask Helm answers, must-push items, and review / memory / operating handoffs on a single first screen.
- **`/operating`** — the main advancement console organized as judgement / decision / boundary three layers.
- **`/approvals`** — the formal-review handoff surface that draws the line between recommendation and commitment.
- **`/memory`** — operating memory with fact / action two-tier promotion; review-first writes only.
- **Ask Helm (`/search?mode=ask`)** — an intent-driven entry that can answer, decompose plans, draft messages, generate internal handoffs (it does not send, does not commit).
- **Full trace audit chain** — `AuditLog` enforces `traceId / requestId / parentEventId` columns; every customer-visible action is replayable in `/memory`. Connectors like the DingTalk Directory invite default to dry-run and require an explicit confirmation payload before they can fire a live send.
- **Apache-2.0 source code** — complete, with full governance docs (CONTRIBUTING / SECURITY / CODE_OF_CONDUCT / CHANGELOG).
- **5-step local boot via `docker compose up`** — `git clone && docker compose up && open http://localhost:3000/mobile`.
- **Aliyun cn-hangzhou public trial** — 30 days active + 7 days read-only grace + physical deletion + an attestation email. **No SLA.**

**Two things that are simultaneously true**

- We are firm on the roadmap direction and the controlled-trial boundaries.
- We make **no forward commitment** about pace or v0.2 content.

If you need an "enterprise-grade, swap-it-in today" product, Helm is not it yet. If you are willing to evaluate, alongside us, whether an "advancement console" maps onto your team in the controlled-trial posture, follow the registration flow in [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md).

**Feedback and contributions**

- GitHub Issues — direction, bugs, doc fixes
- Security vulnerabilities — private channel via [SECURITY.md](../../SECURITY.md); please do not disclose in public issues
- Trial support — `trial-support@helm.run` (Monday–Friday 09:00–18:00 UTC+8; no 24×7 promise)

Welcome contributions: bug fixes with regression tests, bilingual documentation alignment, localization, read-only connectors, accessibility improvements. Anything that changes schema, introduces auto-write / auto-send, or extends to sandbox / marketplace / orchestration platform scope — please open an issue first to discuss.

Release: `v0.1.0-trial` · License: Apache-2.0 · Repository: github.com/Helm-OpenSource/helm-public

---

## 五、短版

### 5.1 GitHub README banner（中英各 < 200 字符）

中文：

> 🚢 **Helm v0.1.0-trial 发布候选**：面向受控试点的经营推进控制台 · Apache-2.0 开源 + 阿里云 cn-hangzhou 试用 · 30/7 天数据保留目标 · no-SLA · `docker compose up` 本地路径待 final smoke · 详见 [public roadmap](../roadmap/HELM_PUBLIC_ROADMAP.md)

English:

> 🚢 **Helm v0.1.0-trial release candidate**: a controlled-trial advancement console · Apache-2.0 OSS + Aliyun cn-hangzhou trial · 30/7-day retention target · no SLA · final local smoke still required · see [public roadmap](../roadmap/HELM_PUBLIC_ROADMAP.md)

### 5.2 X (Twitter) 推文（<= 280 字符）

中文：

> 发布候选文案：Helm v0.1.0-trial 是受控试点的经营推进控制台。Apache-2.0 开源 + 阿里云试用。把会议、邮箱、CRM 收敛成必须推进项与复核入口。不自动发送 / 不自动审批 / 不承诺 SLA。`git clone && docker compose up`。github.com/Helm-OpenSource/helm-public

English:

> Release-candidate copy: Helm v0.1.0-trial is a controlled-trial advancement console. Apache-2.0 + Aliyun cn-hangzhou trial. Collapses meetings, email, CRM into must-push items + formal-review handoffs. No auto-send. No SLA. `git clone && docker compose up`. github.com/Helm-OpenSource/helm-public

### 5.3 LinkedIn 短版（中英 ≤ 600 字符）

中文：

> 我们今天开放了 Helm v0.1.0-trial — 一套面向受控试点的「经营推进控制台」。
>
> Helm 把会议、邮箱、CRM 收敛成「今天必须推进的事项」与「正式复核入口」。它判断优先 / 决策优先；不自动外发、不自动审批、不承诺 SLA；建议与承诺边界严格区分。
>
> Apache-2.0 开源；本地 5 步 `docker compose up` 起服务；阿里云 cn-hangzhou 公开试用（30 天 active + 7 天 grace + 物理删除）。
>
> 我们对路线图方向坚定，对 v0.2 节奏不预承诺。
>
> 路线图与试用 runbook：github.com/Helm-OpenSource/helm-public

English:

> Today we open Helm v0.1.0-trial — a controlled-trial advancement console.
>
> Helm collapses meetings, email, and CRM into must-push items and formal-review handoffs. Judgement-first, decision-first; no auto-send, no auto-approval, no SLA promise; the recommendation/commitment line is strict.
>
> Apache-2.0 open source; 5-step local boot via `docker compose up`; Aliyun cn-hangzhou public trial (30-day active + 7-day grace + hard deletion).
>
> We are firm on direction; we do not commit to v0.2 pace.
>
> Roadmap and trial runbook: github.com/Helm-OpenSource/helm-public

### 5.4 微信公众号导语（≤ 300 字）

> 我们今天发布 Helm v0.1.0-trial。
>
> Helm 是一套面向受控试点的「经营推进控制台」。它每天收敛会议、邮箱、CRM 与企业内部信号，判断当下最重要的经营动作、给出证据、留出正式复核入口。
>
> 我们刻意不做：自动外发 / 自动审批 / 自动结算 / Marketplace / 跨 workspace 聚合 / 多轮聊天历史持久化。受控试点不是「未完成」，而是产品边界。
>
> 阿里云 cn-hangzhou 试用，30 天 active + 7 天 grace + 物理删除；不承诺 SLA；试用支持周一至周五 9:00-18:00。
>
> 完整路线图、试用须知、源代码：搜索 GitHub helm 仓库。

---

## 六、视频脚本占位（90 秒 Mobile Command Surface 演示）

> Week 5 #37 配套要求 90 秒视频。脚本拆成 6 个 15 秒段：
>
> 1. 0–15s：标题卡 + 标语「receipt-driven advancement, controlled trial」
> 2. 15–30s：`/mobile` 第一屏 Must Push 三条样例（强调「建议 ≠ 承诺」标记）
> 3. 30–45s：点开第一条 Must Push → 进入 `/operating` 判断 / 决策 / 边界三层
> 4. 45–60s：点开 Ask Helm → 演示行动意图入口（生成内部 handoff，不外发）
> 5. 60–75s：`/approvals` 复核承接 + 边界 banner
> 6. 75–90s：`docker compose up` 终端动画 + 结尾 CTA「github.com/Helm-OpenSource/helm-public」
>
> 视频中**不出现**：竞品名、SLA 数字、营销动效、未来承诺时间表。

视频脚本本身在另一份 PR 里完成；本文件仅作占位。

---

## 七、发布日 checklist（owner 用）

- [ ] Product Owner + DPO 双签本文件中英双版
- [ ] `npm run release:check` 全绿（自动化 + 7 个人工 release receipt）
- [ ] GitHub repo `Settings → General → Visibility` 切到 public
- [ ] 创建 `v0.1.0-trial` git tag + GitHub release（release notes 引用 [CHANGELOG.md](../../CHANGELOG.md) Unreleased 段）
- [ ] README banner 替换为本文件 §5.1 短版
- [ ] X / LinkedIn / 微信发布按 §5.2 / 5.3 / 5.4 文案
- [ ] 90 秒视频上传（YouTube + B 站 + 微信视频号）
- [ ] 发布后 24 小时内 oncall 主备同时在线监控
- [ ] 发布后 72 小时内汇总反馈，为 v0.1.x 排序

---

## 八、迭代规则

- 任何对此文件的修改在合并前必须经过 Product Owner + DPO 双签
- 红线（§二）任何放松必须独立专项评审（不在本文件覆盖）
- 短版 4 渠道措辞必须与长版口径一致；新增渠道必须新增对应短版
