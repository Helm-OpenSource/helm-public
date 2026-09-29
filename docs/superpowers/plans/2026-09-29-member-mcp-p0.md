---
status: active / as-built-record
owner: helm-core
created: 2026-09-29
review_after: 2026-10-29
public_safety: As-built record for the member MCP read-only entry. No customer
  data, credential, private endpoint, or production-readiness claim.
---

# 成员 MCP P0：员工 AI 工具接入 CAIO（只读）—— as-built

日期：2026-09-29
依据：成员网关规格 `docs/superpowers/specs/2026-08-19-member-workbuddy-caio-gateway-design.md` §6；
owner 2026-09-29 的四项裁定：
- 入口放在线上应用；
- 先只建议、不派发；
- owner 和主管都可以批令牌，主管只能批本组；
- 本机 MCP 维持现状。

## 范围
- 同事用自己的 Codex（ChatGPT）、QwenWork、Claude Code、WorkBuddy，通过应用内 MCP 入口 `/api/mcp/member`
  （Streamable HTTP + JSON-RPC）读取两类数据：本人简报，以及 CAIO 发给本人的提问。
- 工具：`get_my_brief`、`list_my_pending_prompts`、`get_my_prompt`。
- P0 **只读**。只写三类东西：连接自身的生命周期字段、使用与限流元数据、审计记录。
- 不做：回应提问、工作信号、现场报告、任务派发与回执、OAuth 设备码。

## 决策

1. **新表 `MemberAgentConnection` 与 `MemberAgentApproverGrant`，不复用 `ExternalAgentConnection`。**
   - 后者强制绑定观察计划和只读业务源，只有 OWNER/ADMIN 能管理，服务的是"外部 AI 读业务源"。
   - 迁移 `20260929120000_member_agent_connection` 是纯增量：只建两张表，不改任何已有表。
   - 上线前必须登记进 BOM 的 `coreMigrations`。

2. **审批权限。**
   - 新能力 `APPROVE_MEMBER_AGENT_CONNECTIONS` 授给 OWNER 和 ADMIN，他们可以批所有人。
   - 主管要按 groupTag **显式指定**（`MemberAgentApproverGrant`），不从角色推断。
     依据是 2026-09-29 的生产只读实测：带 groupTag 的 34 人全是一线 OPERATOR 委外坐席（7 组）；
     催收主管等没有 groupTag。
   - 除 OWNER 外，任何人不能批自己的申请。
   - **收权不受成员状态限制**：驳回和吊销在成员离开后仍然可以做；**批准**则要求成员仍是 ACTIVE。

3. **生命周期。**
   - 状态流转：requested → approved → active（成员本人领取）→ revoked；分支状态 rejected。
   - 领取窗口 7 天。令牌前缀 `hmm_`，只显示一次，只存 sha256，30 天有效。
   - 已过期、领取已过期这两种状态由时钟推导，不落库。
   - 所有状态变更都是 Serializable 事务内的版本 CAS，由 `check:conditional-update-cas` 覆盖。

4. **开关与出境许可。**
   - 环境变量 `HELM_MEMBER_MCP_ENABLED=true` 且工作区 `featureFlags.memberMcp === true`，两者都满足才开。
   - `featureFlags.memberMcpApprovedClients` 是客户端类型白名单。
   - 客户端不在名单内时：
     - 不能申请；
     - tools/list 返回空；
     - tools/call 返回 `provider_not_approved`，并且不放行数据。

5. **每次调用都重新核对以下各项。**
   - 两个开关；
   - 令牌状态与到期时间；
   - 成员仍是 ACTIVE（在役成员身份）；
   - 每分钟 60 次限流。

6. **信封。**
   - 结果一律包成 `MemberToolEnvelope`，并过 `validateMemberToolEnvelope`。
   - 投影策略为 `member-mcp:self-record` v1：P0 只返回调用者本人的记录。
   - 提问摘要在 CAIO 发放时已经完成投影；classifiedAt 取提问的发放时刻，聚合数据取读取时刻。
   - 从 P1 起，涉及他人或业务对象的读取走七元交集（`decideMemberReadSurface`）。

7. **未投递的提问对成员可见（owner 2026-09-29 裁定）。**
   - `list_my_pending_prompts` 包含 `pending`，也就是尚未投递的提问。
   - 成员主动拉取自己的队列不算打扰，所以静默期和勿扰不适用；读取不改变提问状态。
   - 这是对规格 §6.3"受监督投递"的有意放宽，仅适用于成员本人主动读取；主动推送仍走 P1 的 `poll_my_prompts` 与投递判定。

7b. **放行名单（owner 2026-09-29 裁定）：四家全放**——`memberMcpApprovedClients: ["codex","qwenwork","claude_code","workbuddy"]`。
   - Codex 与 Claude Code 的厂商在境外，提问摘要会出境；页面对这两家标注"境外"并提示审批人。
   - 名单是工作区级的，不能按人区分；把关靠逐个令牌的审批（owner 或本组主管）。

8. **权限防火墙。** 工具执行器直接读 `MemberPrompt` 表，不经过 `prompt-store.service`。
   原因是后者会引入 `lib/caio-governance`，而 API 代码不得依赖它（`check:caio-terminology`）。

## 页面
- `/settings/ai-access`：所有 ACTIVE 成员可见。
- 成员视角：申请、领取、吊销。
- 审批区：按能力或主管指定显示。
- owner 和管理员另外可以指定、撤销主管。
- 页面**尚未挂进导航**。

## 验证
- 单元测试：`lib/member-mcp/*.test.ts`。
- 隔离 MySQL：`npm run test:member-mcp:mysql`，挂在 CI 的 Member Gateway MySQL 作业里。
- `check:boundaries` 全过。
