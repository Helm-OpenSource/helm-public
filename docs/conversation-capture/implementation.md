---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Conversation Capture 实施稿

## 文档目的

本文件用于指导“经营分身控制台”交流捕获系统（Conversation Capture System）的工程实现。

目标：
1. 让用户在前台能简单开始记录
2. 让后台自动完成转写、提取、记忆生成和动作生成
3. 让结果回到经营和管理体系
4. 让系统能接手动录音和第三方会议系统接入
5. 在第一阶段先保证闭环成立，再逐步扩展

---

## 当前实现状态

截至 2026-03-15，Conversation Capture 已经进入“阶段 B 第 1 轮”：

已实现：
1. 浏览器录音 MVP
2. 停止录音后上传音频
3. 单 provider ASR 最薄闭环
4. transcript 写入 `sourceType / provider / model`
5. capture 结果页明确展示 transcript 来源
6. capture 结果页展示记忆写回、动作生成、审批与 recommendation 刷新结果
7. 外部 transcript ingest 已支持最小结构化 payload，并复用同一条处理链

当前仍未实现：
1. 实时流式转写
2. 真实 speaker diarization
3. Zoom / 腾讯会议原生音频接入
4. 长音频存储与回放体系

因此，当前模块应被表述为：
- 已具备“浏览器录音 + 非实时转写 + 经营理解处理链”
- 还不是完整的“实时会议录音转写平台”

---

## 一、实现范围

第一阶段只做以下内容：

1. 手动开始记录
2. 结束后进入转写和理解流程
3. 生成：
   - transcript
   - MemoryFacts
   - Commitments
   - Blockers
   - Risks
   - candidate actions
4. 把结果写回：
   - Meeting
   - Contact
   - Opportunity
   - Memory system
   - Recommendation / Approval
5. 页面展示与基本审计

第一阶段不做：
1. 泛上传录音入口
2. 自动全局后台录音
3. 实时会中智能建议
4. 真实对外自动发送
5. 跨平台复杂双向同步

---

## 二、建议新增模块

建议新增目录：

```text
lib/conversation-capture/
  capture-session.service.ts
  transcription.service.ts
  conversation-understanding.service.ts
  conversation-risk.service.ts
  conversation-action-bridge.service.ts

features/conversation-capture/
  start-recording-button.tsx
  capture-session-panel.tsx
  capture-result-panel.tsx
```

如果需要页面，可新增：

```text
app/(workspace)/capture/page.tsx
```

但第一阶段更推荐以“全局入口 + 结果页嵌入现有对象页”的方式实现。

---

## 三、数据模型建议

## 1. CaptureSession
作用：
表示一次录音 / 会话捕获任务。

字段建议：
- id
- workspaceId
- userId
- status
- sourceType
- sourceId
- objectType
- objectId
- startedAt
- endedAt
- durationSeconds
- audioFilePath 或 audioBlobRef
- transcriptStatus
- processingStatus
- errorMessage
- createdAt
- updatedAt

status 建议：
- RECORDING
- PROCESSING
- COMPLETED
- FAILED
- CANCELED

sourceType 建议：
- MANUAL_CAPTURE
- ZOOM
- TENCENT_MEETING
- CALL_CENTER
- OTHER

## 2. ConversationTranscript
作用：
保存转写结果。

字段建议：
- id
- workspaceId
- captureSessionId
- fullText
- segments，Json
- speakerSeparated
- language
- confidence
- createdAt

segments 建议包含：
- speaker
- startedAt
- endedAt
- text

## 3. ConversationInsight
作用：
保存本次会话理解出的高价值结果。

字段建议：
- id
- workspaceId
- captureSessionId
- insightType
- title
- content
- confidence
- relatedContactId
- relatedCompanyId
- relatedOpportunityId
- sourceSegmentRefs，Json
- createdAt

insightType 建议：
- FACT
- COMMITMENT
- BLOCKER
- RISK
- NEXT_ACTION

## 4. ConversationProcessingLog，可选
如果你想把过程拆得更细，可单独加。
第一阶段可先不加，复用 LLMCallLog + AuditLog。

---

## 四、前台交互设计

## 1. 主入口
在以下位置放“开始记录”：

1. 首页固定主入口
2. Contact 页
3. Company 页
4. Opportunity 页
5. Meeting 页

如果从对象页进入，则自动继承上下文：
- objectType
- objectId

## 2. 录音面板
点击后打开 capture session panel，包含：

1. 当前上下文对象
2. 录音中状态
3. 已录时长
4. 暂停 / 结束
5. 简短说明：
   - 本次记录将用于生成纪要、承诺、阻碍和下一步动作

要求：
- 前台尽量简单
- 不要堆配置项
- 不要在第一阶段暴露太多高级设置

## 3. 结束后的处理状态
结束后显示：
1. 正在转写
2. 正在提取经营信号
3. 正在生成建议

处理完成后跳到结果展示：
- Meeting 页面对应模块
- 或一个 capture result panel

---

## 五、后台处理链路

我建议拆成四段。

## 5.1 Capture
由 `capture-session.service.ts` 管理：
1. 创建会话
2. 开始记录
3. 结束记录
4. 记录时长和上下文对象

## 5.2 Transcription
由 `transcription.service.ts` 管理：
1. 读取音频
2. 调用转写 provider
3. 生成 transcript 和 segments
4. 写入 ConversationTranscript
5. 写 AuditLog / EventLog

## 5.3 Understanding
由 `conversation-understanding.service.ts` 管理：
1. 读取 transcript
2. 调用 LLM 做结构化提取
3. 输出：
   - facts
   - commitments
   - blockers
   - risks
   - candidate actions
4. 写入：
   - ConversationInsight
   - MemoryFact
   - Commitment
   - Blocker

## 5.4 Action Bridge
由 `conversation-action-bridge.service.ts` 管理：
1. 把 candidate actions 送入 recommendation engine
2. 按 policy 决定：
   - suggest only
   - requires approval
   - auto create internal action
3. 创建 ActionItem / ApprovalTask
4. 写回 timeline / audit / event

---

## 六、LLM 与转写能力接入方式

## 6.1 转写
第一阶段建议通过独立 transcription service 接入。
要求：
1. 支持 speaker-separated transcript
2. 支持时间戳
3. 当前实现里，时间戳与 speaker segments 是“可展示的 transcript 结构”，但 speaker 分离仍是启发式，不应被表述为真实 diarization
3. 支持失败回退
4. 输出标准化结构

如果暂时没有真实转写 provider，可先接 mock / demo provider，但接口要按真实实现设计。

## 6.2 会话理解
依赖现有：
- llm integration architecture
- memory system
- recommendation engine

建议新增 taskType：
- CONVERSATION_FACT_EXTRACTION
- CONVERSATION_COMMITMENT_EXTRACTION
- CONVERSATION_BLOCKER_EXTRACTION
- CONVERSATION_RISK_EXTRACTION
- CONVERSATION_ACTION_EXTRACTION

所有提取结果必须结构化输出，并带 confidence。

---

## 七、输出回写规则

本系统最关键的是不要停在 transcript。

必须回写到现有经营系统。

## 7.1 写回 Meeting
如果当前 capture 关联 Meeting：
- transcript summary
- commitments
- blockers
- actions
- processing status

## 7.2 写回 Contact
如果能识别到联系人：
- relevant MemoryFacts
- commitment linkage
- blocker linkage
- timeline 更新

## 7.3 写回 Opportunity
如果能识别到机会：
- new MemoryFacts
- new Commitments
- new Blockers
- candidate recommendation context

## 7.4 写回 Recommendation / Approval
如果有建议动作：
- recommendation explanation 可引用本次 conversation insights
- 高风险动作进入审批
- 低风险内部动作可自动创建 action item

---

## 八、API 设计

## 8.1 Capture Session

### 开始记录
`POST /api/conversation-capture/start`

请求体：
```json
{
  "objectType": "OPPORTUNITY",
  "objectId": "opp_123",
  "sourceType": "MANUAL_CAPTURE"
}
```

### 结束记录
`POST /api/conversation-capture/:sessionId/stop`

### 获取会话状态
`GET /api/conversation-capture/:sessionId`

### 获取处理结果
`GET /api/conversation-capture/:sessionId/results`

---

## 8.2 外部接入入口

### Zoom / 腾讯会议 / Call Center 通用接入
`POST /api/conversation-capture/ingest`

请求体建议：
```json
{
  "workspaceId": "ws_001",
  "sourceType": "ZOOM",
  "externalMeetingId": "zoom_123",
  "participants": [
    {"name": "李晨", "email": "lichen@example.com"}
  ],
  "startedAt": "2026-03-15T10:00:00.000Z",
  "endedAt": "2026-03-15T10:30:00.000Z",
  "audioUrl": "https://...",
  "relatedOpportunityId": "opp_123",
  "relatedContactId": "contact_001"
}
```

如果暂时不接真实音频 URL，可允许 transcript 直接传入，但不要对普通用户暴露上传入口。

---

## 九、页面联动要求

## 9.1 首页
新增或强化：
1. 开始记录主入口
2. 最近捕获到的高优先级事项
3. 系统刚从会话里识别出的 blocker / commitments

## 9.2 Meeting 页面
必须最强体现：
1. transcript 摘要
2. commitments
3. blockers
4. risks
5. next actions
6. recommendation explanation 引用本次会话结果

## 9.3 Contact 页面
新增：
1. 最近一次会话摘要
2. 从会话中提取的偏好 / 风险
3. 会话带来的推荐动作

## 9.4 Opportunity 页面
新增：
1. 最近一次会话中识别出的 blocker
2. 最近新增 commitments
3. recommendation explanation 引用会话洞察

## 9.5 审批中心
新增：
1. 某 recommendation 的依据来自哪次会话
2. 可查看 conversation-derived supporting facts

---

## 十、必须审计与埋点

### AuditLog
必须记录：
1. CaptureSession 创建
2. CaptureSession 结束
3. Transcript 写入
4. Conversation insights 生成
5. MemoryFact / Commitment / Blocker 回写
6. ApprovalTask / ActionItem 创建
7. 外部 ingest 请求处理

### EventLog
建议记录：
1. capture_started
2. capture_stopped
3. transcript_generated
4. conversation_insights_generated
5. conversation_results_viewed
6. conversation_action_created
7. conversation_ingest_received

---

## 十一、README 更新要求

README 必须新增“Conversation Capture System”一节，说明：

1. 这是什么
2. 当前支持哪些场景
3. 为什么不做普通用户录音上传
4. 如何演示
5. 如何与 recommendation / memory / approval 联动
6. 外部系统如何通过 API / CLI 接入

---

## 十二、Codex 直接实施指令

下面这段可以直接贴给 Codex。

```text
现在开始实现“经营分身控制台”的 Conversation Capture System 第一阶段。

目标：
在产品中加入一个现场入口，让用户可以开始记录一次重要交流，后台自动完成转写、经营理解、记忆生成和动作生成，并把结果回到经营和管理闭环里。

先不要直接编码。
请先阅读：
- AGENTS.md
- docs/product/product-principles.md
- docs/product/roadmap.md
- docs/product/intelligence-roadmap.md
- docs/memory-system/implementation.md
- docs/recommendation-engine/implementation.md
- docs/llm/llm-integration-implementation.md
- docs/evolution/adaptive-evolution-system-implementation.md，如果已有

然后输出《Conversation Capture System 第一阶段实施计划》，按 P0、P1、P2 排优先级。
计划中必须写清：
1. 新增哪些数据模型
2. 新增哪些服务
3. 新增哪些 API
4. 哪些页面会增强
5. 如何与 memory / recommendation / llm / approval 集成
6. 如何验证

输出计划后再开始编码。
编码前创建 Git checkpoint。
编码后创建 Git checkpoint。

本轮必须完成：

一、数据模型
新增：
1. CaptureSession
2. ConversationTranscript
3. ConversationInsight

二、服务层
新增：
1. lib/conversation-capture/capture-session.service.ts
2. lib/conversation-capture/transcription.service.ts
3. lib/conversation-capture/conversation-understanding.service.ts
4. lib/conversation-capture/conversation-risk.service.ts
5. lib/conversation-capture/conversation-action-bridge.service.ts

三、前台交互
新增：
1. 首页明显位置的“开始记录”入口
2. 一个 capture session panel
3. 结束后处理状态
4. 结果展示面板或嵌入现有页面

四、处理链
必须打通：
1. 开始记录
2. 结束记录
3. transcript 生成
4. facts / commitments / blockers / risks 提取
5. 写回 memory system
6. 生成 recommendation 输入
7. 需要时创建 approval / action item

五、API
至少新增：
1. POST /api/conversation-capture/start
2. POST /api/conversation-capture/:sessionId/stop
3. GET /api/conversation-capture/:sessionId
4. GET /api/conversation-capture/:sessionId/results
5. POST /api/conversation-capture/ingest

六、页面增强
增强：
1. 首页
2. Meeting 页面
3. Contact 页面
4. Opportunity 页面
5. 审批中心

七、约束
1. 不做普通用户“上传录音文件”入口
2. 对企业和第三方场景保留 ingest API / CLI 思路
3. 高风险动作不能自动越权执行
4. transcript / insight 失败不能破坏主流程
5. 必须写 AuditLog / EventLog

八、验收路径
至少验证：
1. 手动开始记录 → 结束 → 得到 transcript
2. transcript 能生成 facts / commitments / blockers
3. 结果能写回 Meeting / Contact / Opportunity
4. recommendation explanation 能引用会话结果
5. 高风险动作进入审批
6. 首页能看到来自最近会话的高优先级事项
7. README 更新说明

如果必须取舍，优先级如下：
1. CaptureSession
2. transcript → structured insights
3. 写回 memory system
4. recommendation / approval bridge
5. 页面可见化
6. 外部 ingest 接口
```

---

## 十三、验收标准

本轮完成后，至少满足以下条件：

1. 用户可在前台明显位置发起一次“开始记录”
2. 会话结束后，系统能得到 transcript
3. transcript 能生成至少：
   - facts
   - commitments
   - blockers
4. 这些结果能回到 Meeting / Contact / Opportunity
5. recommendation explanation 能引用这些结果
6. 审批中心能看到来自会话的高风险动作
7. 首页能看到从会话里识别出的高优先级事项
8. 全过程有审计和事件记录

---

## 十四、最终判断

Conversation Capture System 第一阶段成立的标志，不是产品里出现了录音按钮。

真正成立的标志是：

1. 用户在现场开启一次记录后
2. 系统能够自动理解这次交流里的经营信号
3. 并把这些结果真正回到经营和管理体系中
4. 最终形成 recommendation、审批和推进闭环

只有这样，这项能力才不是附属功能，而是经营分身的现场入口。
