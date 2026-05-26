---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Action Intent Implementation Plan V2

更新时间：2026-04-25
状态：Implemented minimum baseline

实施收口见 [HELM_ASK_HELM_ACTION_INTENT_IMPLEMENTATION_CLOSEOUT_V2.md](HELM_ASK_HELM_ACTION_INTENT_IMPLEMENTATION_CLOSEOUT_V2.md)。

## 1. 结论

当前 Ask Helm 已经实现 read-only baseline，但还没有实现行动型入口。

下一阶段目标不是把 Ask Helm 做成 agent 或 workflow engine，而是把用户自然语言里的正常行动需求分成：

- answer
- plan
- prepare
- handoff
- review-required execution
- voice input / speakable response
- denied

然后把每类需求收口到 Helm 已有工作面。

## 2. 当前实现基线

已成立：

- `/search` 双模入口
- query intent taxonomy v1
- runtime knowledge pack
- read-only interpreter
- access scope
- validation suite

未成立：

- plan contract
- draft artifact contract
- action handoff contract
- review-required execution intent
- voice transcript contract
- internal queue write guard
- action intent eval

## 3. 不做的事

V2 仍不做：

- chat center
- full workflow engine
- broad agent orchestration
- automatic customer send
- automatic approval
- payment execution
- official writeback through Ask Helm
- cross-workspace answer
- always-on microphone
- voice-only approval or voice-only high-risk confirmation
- raw audio retention by default

## 4. 实施切片

### Slice 1 - Action Intent Taxonomy + Eval

目标：

- 把行动型 query 从 out-of-scope 里拆出来

新增 intent：

- `plan_breakdown`
- `prepare_draft`
- `prepare_review_packet`
- `queue_internal_followup`
- `request_handoff`
- `request_execution`
- `review_required_execution`
- `unsupported_open_domain`
- `cross_workspace_denied`

交付：

- `evals/ask-helm/action-intents.json`
- action intent classifier baseline
- action intent eval runner

完成标准：

- 计划型、准备型、执行型、高风险执行、开放域、跨 workspace 能稳定区分
- pass rate >= 80%

### Slice 2 - Action Response Contract

目标：

- 扩展 `AskHelmResponse`，让回答支持 plan / artifact / handoff

新增结构：

- `plan`
- `preparedArtifact`
- `actionHandoff`
- richer `boundaryNote`

完成标准：

- 每个 action intent 都有明确 output contract
- 每个 response 都有 primary target surface
- 所有 high-risk intent 都带 `review_required` 或 `execution_denied`

### Slice 3 - Draft Plan Generator

目标：

- 对计划型 query 生成 deterministic draft plan baseline

做法：

- 先基于 intent、related objects、knowledge pack 生成步骤
- 每一步有 rationale / targetSurface / riskLevel / reviewRequired
- 不写 DB

完成标准：

- 用户问“怎么推进 / 帮我拆”时，能看到步骤、风险、依赖和下一步页面
- plan status 固定为 `draft`

### Slice 4 - Draft Artifact Preparation

目标：

- 支持“准备草稿 / 准备审批材料 / 生成行动清单”

做法：

- 生成 draft-only artifact metadata
- 不实际发送
- 不写 official system
- 只跳转到 approvals / operating / object page

完成标准：

- draft artifact 状态清楚
- 用户能进入 review surface
- UI 明确显示 draft-only / review-required

### Slice 5 - Internal Handoff Queue

目标：

- 对低风险内部动作建立可审计 handoff

前置条件：

- 先定义 queue item contract
- 必须有 audit label
- 必须支持 dismiss / undo

做法：

- 第一阶段只允许 internal follow-up queue
- 不允许 external send / approve / payment

完成标准：

- queue write 只发生在低风险 intent
- 每次 queue 都有 source query / actor / timestamp / target surface
- review-required intent 不能进入 low-risk queue

### Slice 6 - LLM Rewrite Layer

目标：

- 让回答和计划表达更自然，但不改变 policy

做法：

- LLM 只允许改写：
  - answer wording
  - plan step wording
  - next-step wording
- LLM 不允许改写：
  - intent
  - riskLevel
  - reviewRequired
  - boundaryNote type
  - actionHandoff mode

完成标准：

- deterministic policy before LLM
- LLM output 后仍通过 policy validation

### Slice 7 - UX Upgrade

目标：

- `/search?mode=ask` 从 answer-only 升级成 action-intent result

展示顺序：

1. related objects
2. answer
3. draft plan 或 prepared artifact
4. action handoff
5. boundary note

完成标准：

- 不变成聊天界面
- 用户能一眼看出“这是回答 / 草案 / 待复核 / 不可执行”
- 高风险请求有清楚 review path

### Slice 8 - Voice Input Baseline

目标：

- 让 Ask Helm 支持语音提问，但不改变 action intent、权限和执行边界

做法：

1. 增加 voice input affordance
2. 将语音转写成 transcript
3. transcript 先进入可编辑确认状态
4. 用户确认 transcript 后，才进入同一套 Ask Helm action intent pipeline
5. 低置信度 transcript 或包含金额、承诺、审批、发送、付款等高风险词时，必须显式要求文本确认

完成标准：

- typed query 与 voice transcript 使用同一套 classifier / interpreter / access scope
- voice input 不打开任何新 write path
- transcript 可见、可编辑、可取消
- 不默认保存 raw audio
- high-risk intent 不能通过语音确认绕过 review / approval

### Slice 9 - Speakable Response

目标：

- 支持把 Ask Helm 的简短回答和边界提醒朗读给用户

做法：

1. 在 response contract 中加入 `speakableSummary`
2. 为 boundary note 加入 `speakableBoundary`
3. 朗读内容只来自已经通过 policy validation 的 response
4. 高风险请求必须朗读 boundary，不只朗读下一步

完成标准：

- 朗读不包含隐藏 reasoning
- 朗读不省略 review-required / draft-only / denied boundary
- 用户可关闭朗读
- 语音朗读不构成执行确认

## 5. 验证计划

新增验证：

```bash
npm run eval:ask-helm-action-intents
npm run eval:ask-helm-action-contract
npm run eval:ask-helm-voice
npm run test -- features/search/ask-helm-action-*.test.ts
```

继续保留：

```bash
npm run eval:ask-helm
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run build
```

若引入 DB-backed queue：

```bash
npm run db:reset
npm run test -- features/search/ask-helm-action-queue.test.ts
npm run e2e
```

DB-backed 验证必须有明确 MySQL test profile，不应依赖不透明共享本机数据库。

## 6. 风险与回滚

### 风险

1. 用户把 draft plan 理解成正式计划
2. 用户把 prepared artifact 理解成已发送
3. planning intent 被误判为 direct execution
4. low-risk queue 变成事实上的 workflow engine
5. LLM rewrite 改坏 review boundary
6. voice transcript 误识别关键对象、金额、承诺或执行动作
7. 用户误以为语音确认等于正式审批 / 发送

### 回滚

- Slice 1 可独立回滚到 v1 taxonomy
- Slice 2 可保留 contract，不展示 UI
- Slice 3 可关闭 plan block
- Slice 4 可关闭 artifact block
- Slice 5 必须 feature-flag / kill switch
- Slice 6 可退回 deterministic wording
- Slice 7 可退回 v1 Ask mode UI
- Slice 8 可关闭 voice input，保留 typed input
- Slice 9 可关闭 speakable response，保留可视化 response

## 7. 推荐优先级

下一轮最合理的顺序：

1. `Action Intent Taxonomy + Eval`
2. `Action Response Contract`
3. `Draft Plan Generator`
4. `UX Plan Block`
5. `Voice Input Baseline`
6. 再考虑 draft artifact、queue 和 speakable response

不要先做 queue write。先把行动意图和 review boundary 稳住。
