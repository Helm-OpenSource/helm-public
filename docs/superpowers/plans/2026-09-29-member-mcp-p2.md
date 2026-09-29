---
status: active / as-built-record
owner: helm-core
created: 2026-09-29
review_after: 2026-10-29
public_safety: As-built record for member MCP task tools aligned with the
  Stage 1 dispatch chain. No customer data, credential, private endpoint, or
  production-readiness claim.
---

# 成员 MCP P2：派给我的工作包 + 进展回报 —— as-built

## 依赖与合并顺序
- **本切片依赖 #426**（`feat/caio-judgement-task-candidate`：CAIO 判断 → 一把手确认 → Stage 1 工作包派给某位成员）。
  - 本分支合入了 #426，用的是它的 `lib/stage1-owner-loop/member-work-packet-queries.service.ts`。
- 合并顺序：#436（P0）→ #437（P1a）→ #439（P1b）→ #426 → 本 PR。
  - #426 先进 main 时，本 PR 改基到 main 即可，不需要额外改动。

## 与 #426 对齐的决定
1. **任务集合与 #426 一致，不另建任务模型。**
   - `list_my_tasks` 和 `get_task` 直接调用 `listWorkPacketsAssignedToMember`。任务 = 一把手命令里执行人写明是本人（`executionTargetRef = user:<id>`）的工作包。
   - 这与工作台 `/caio/my-work` 是同一个范围。
   - 最初设想的"ActionItem.ownerId = 本人的已批准任务"这条路**不做**：CAIO 派给成员只走 #426 的 Stage 1 链，并行一套任务模型会让一把手看到两条闭环。
2. **回报不写 ExecutionReceipt，也不改任务状态。**
   - 工作包只通过 Stage 1 链关闭：私有执行结果入口、`/approvals` 回执验收、终态核对。
   - 这条链里，入口遇到已有回执时会以 `projection_replay_conflict` 拒绝正式结果。如果成员自报回执抢先写入，反而会挡住正式关闭。
   - 所以成员的 `submit_task_report` 记为一条不可信的候选工作信号：
     - 对象为 `action-item:<工作包的 ActionItem>`；
     - 候选锚点解析到该 ActionItem，在 `/approvals` 里出现在这个工作包旁边，作为验收人的参考证据。
   - 一把手看到的始终是一条闭环。
3. **只能在待回报的工作包上回报**：工作包处于已批准、等待结果（APPROVED）时才接受回报；未批准或已关闭的一律拒绝。
4. **沿用 P0 的冻结作用域名**：`member:task:read` 用于查看，`member:task:receipt` 用于回报；在 P2 里 receipt 的含义是"回报"。
   - 与 P1 的写入权限分开，另设申请选项（"同时申请任务"）。
5. **冻结边界**：`check:member-gateway` 禁止 `lib/member-gateway` 出现 `WorkPacket` 标识。P2 在 `lib/member-mcp` 里，只读已派发的工作包，不能派发，不违反这条约定。
6. **不另建验收页**：验收仍在 `/approvals`。

## 同时交付
- **待人工处理的回应**：P1b 收件行里 needsHuman 或 held 的条目，只在 owner 和管理员的接入管理页显示。
  - 显示内容：成员、提问、回应类型、状态、原因码。
  - 拒绝、暂停、申诉的理由标注"未经核实"，只给 owner 和管理员看。

## 防线
- 权限防火墙：MCP 路由经 `member-work-packet-queries` 与 signal-store，都不会触达 `lib/caio-governance`（`check:caio-terminology` 通过）。
- 两步确认：复用 signal-store 的一次性 challenge，内容被改动即拒绝，重放返回同一回执。
- 成员离职后，读取与回报立即失效。

## 验证
- 单元测试：`task-contract.test.ts`、`tools.test.ts`、`contract.test.ts`、`mcp-protocol.test.ts`。
- MySQL：`member-mcp-task.mysql.test.ts`，已挂进 `test:member-mcp:mysql`。
