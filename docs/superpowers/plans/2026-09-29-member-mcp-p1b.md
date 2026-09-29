---
status: active / as-built-record
owner: helm-core
created: 2026-09-29
review_after: 2026-10-29
public_safety: As-built record for member MCP P1b (asynchronous registration of
  member responses to CAIO prompts). No customer data, credential, private
  endpoint, or production-readiness claim.
---

# 成员 MCP P1b：回应 CAIO 提问（异步登记）—— as-built

日期：2026-09-29。依据：owner 2026-09-29 裁定"回应提问采用异步登记，权限防火墙不动"。叠在 P1a（#437）之上。

## 为什么异步
- `prompt-response-store.service` 用 `lib/caio-governance` 校验受保护回应（拒绝 / 暂停 / 申诉）。
- 任何能从 `app/**/route.ts` 到达的代码都不得依赖该模块（权限防火墙，`scripts/check-caio-terminology.ts`）。
- 定时作业由 `app/api/runtime/signals/collect/route.ts` 触发，所以处理器也不能做成登记在 registry 的作业。

## 链路
1. **线上（MCP 路由可达，防火墙干净）**，实现在 `lib/member-mcp/response-intake.ts`：
   - `prepare_prompt_response`：读取提问行（必须发给本人），然后签发一次性确认码。
     确认码复用 signal-store 的通用 challenge（`MemberWorkSignalChallenge`）：
     - object 为 `member-prompt-response:<promptRef>`；
     - 载荷是信号形状的包装，detail 为回应意图的规范 JSON。
     - 这个 challenge 只绑定成员的确认，永远不会被当作工作信号兑现。
   - `submit_prompt_response`：在同一个 Serializable 事务里完成三件事：
     - 用 `judgeMemberWorkSignalSubmission` 判定（外加对象与设备绑定）；
     - 按版本 CAS 消费 challenge；
     - 写入 `MemberPromptResponseInbox`（id = `mmcp-inbox:<challengeRef>`）。
     - 同一确认码重复提交返回同一行；内容被改过以哈希不符拒绝。
   - `get_prompt_response_status`：查看登记状态。
   - 受保护回应只在输入格式、鉴权、权限不对时被线上拒绝；提问已关闭也照收，由处理器转人工。
   - 非受保护回应要求提问仍开放且未过期。
2. **处理器（受控 CLI，防火墙外）**：
   - 入口 `scripts/member-prompt-response-worker.ts`，逻辑在 `lib/member-mcp/response-processor.ts`；只被该 CLI 和测试引用。
   - 按租约 CAS 领取 `received` 行。
   - 回应只能从 `delivered` 发起。成员是自己拉取的提问（owner 裁定未投递提问可见），所以处理器先记一次投递：`deliveryContext` 为非静默、非勿扰；已暂缓的则解除暂缓。
   - acknowledge / refuse / pause / appeal：用同一载荷依次调用 `issueMemberPromptResponseChallenge` 和 `recordMemberPromptResponse`。
     - 受保护回应的 `mandateRef` 取工作区的 `CaioActiveMandateClaim`（要求状态 active 且在有效期内）。
     - routePath 为 `local_fallback`（成员自己的客户端），auditRefs 含收件编号。
   - progress_report / free_text_answer：发起一条针对提问 subjectObjectRef 的工作信号 challenge，然后调用 `respondWithWorkSignal`，再物化为 /approvals 候选。
   - 所有写入 id 都是确定性的，重跑或崩溃后不会重复写。

## 结果状态（闭集码见 `response-contract.ts`）
| 状态 | 含义 |
|---|---|
| `registered` | 已登记，回写回执号，或信号回执号加候选编号 |
| `rejected` | 非受保护回应的终态拒绝，带闭集码（`prompt_closed` / `prompt_expired` / `store_rejected` / `processor_exhausted` 等） |
| `held` | 受保护回应无法被 store 记录（例如提问已关闭），留给人工处理，永不丢弃 |
| `received` + `needsHuman` | 暂时失败或**没有生效的 CAIO mandate**，每轮重试；mandate 生效后自动登记 |

非受保护回应重试 5 次后置为 `processor_exhausted`；受保护回应不会耗尽，只标记需人工。

## P1a 缺口在本 PR 修复
- `materializeMemberWorkSignalCandidate` 此前没有任何生产调用方。成员通过 MCP 提交的信号或现场报告从来不会成为 /approvals 里的可审阅候选。
- 现在 `write-executor` 在提交成功后（包括幂等重放）会物化候选，候选的对象锚点为未解析的 `member-self:<userId>`。
- 回应里的候选类（进展汇报、回答）也会物化。
- 物化失败时回执仍然有效：返回 `candidateMaterialized: false` 和闭集码（`candidate_unsafe_text` / `candidate_invalid` / `candidate_failed`），并在服务端记日志。

## 不做
- `commitment_confirm`：需要外部授权三元组，成员客户端拿不到。
- user-presence 强身份确认：MCP 走 local_fallback 路径。
- 工作台里的"待人工"收件箱页面：进入后续的反馈收件箱。

## 验证
- 单元测试：`lib/member-mcp/response-contract.test.ts` 与 `tools.test.ts`。
- 隔离 MySQL：`lib/member-mcp/member-mcp-response.mysql.test.ts`（进入 `test:member-mcp:mysql`）。
