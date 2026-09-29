---
status: active / as-built-record
owner: helm-core
created: 2026-09-29
review_after: 2026-10-29
public_safety: As-built record for member MCP candidate writes (work signals
  and field reports). No customer data, credential, private endpoint, or
  production-readiness claim.
---

# 成员 MCP P1a：工作信号与现场报告（候选写入）—— as-built

日期：2026-09-29；在 P0（`2026-09-29-member-mcp-p0.md`）之上叠加。依据：员工接入 CAIO 规格 §3、成员网关规格 §5/§6.2/§9。

## 范围
- 新工具：
  - `prepare_work_signal` / `submit_work_signal`：信号类型为进展、阻碍、客户信号；
  - `prepare_field_report` / `submit_field_report`：FDE 为首个试点。
- 全部写入都走成员网关已有的 `signal-store.service`，结果是一次性确认码 + 只追加的候选回执。
  - 回执恒为 `candidate: true`、`taint: "untrusted"`，不产生任何授权，也不派发任务。
- 不做：
  - 回应 CAIO 提问：`prompt-response-store` 依赖 `lib/caio-governance`，而权限防火墙禁止 API 路由依赖它，需另行设计（P1b）；
  - 针对他人或业务对象的信号；
  - 证据引用（relatedEvidenceRefs）。

## 决策
1. **写入权限要显式申请。**
   - 申请时勾选"同时申请写入"才会带上 `member:signal:write` 与 `member:report:write`；默认仍只有两项只读权限。
   - 审批页显示每个令牌的权限范围。
   - 权限在两层都检查：协议层不列出、不执行越权工具；写入执行器自己再判一次。
   - 客户端不在放行名单内时，写工具同样不可见、不可执行。
2. **现场报告搭载在工作信号回执上，不扩展冻结的信号类型。**
   - `MEMBER_WORK_SIGNAL_KINDS` 由 `check:member-gateway` 冻结。
   - 现场报告记录为一条工作信号：
     - 案件观察记为客户信号，其余类型记为进展；
     - 摘要为「现场报告·<类型>：<标题>」；
     - 详情的第一段是一个 ```` ```helm-field-report/v1 ```` JSON 块（规范化，字段顺序固定），其后是文字说明。
   - 同样的输入产生同样的载荷，因此 prepare 和 submit 的哈希一致。
3. **指标键只收工作区登记的清单。**
   - 清单来自 `featureFlags.memberMcpFieldReportMetricKeys`，由租户填快检模板 id；Core 无从知道这些 id。
   - 清单为空时只收纯文字报告。
   - 单份报告最多 20 个指标，数值必须是有限数。
4. **目标对象是本人记录 `member-self:<userId>`。**
   - 读取面判定走 `decideMemberReadSurface`，证据如实填写：
     - 在役成员身份（提交时重读，必须仍是 ACTIVE）；
     - 本连接及其写入权限；
     - 与目标的关系 `self:<userId>`；
     - 策略 `member-mcp:self-signal:v1`；
     - 出境许可来自放行名单。
5. **回执编号由确认码确定性派生**（`mmcp-signal:<challengeRef>`）。
   - 同一确认码、同一内容重复提交，返回同一回执（`replayed`）。
   - 内容被改过则以 `challenge_payload_hash_mismatch` 拒绝。

## 上线须知
- 无新迁移，复用 P0 的表和成员网关已有的表。
- 新增工作区开关 `memberMcpFieldReportMetricKeys`（字符串数组，可选）。
- 已签发的 P0 令牌不会自动获得写入权限，要重新申请。

## 验证
- `lib/member-mcp` 单元测试。
- `npm run test:member-mcp:mysql`：在 P0 用例之外，新增工作信号全链路、现场报告、只读连接被拒三组用例。
- `check:boundaries` 全过，包括权限防火墙 caio-terminology 和 conditional-update-cas。
