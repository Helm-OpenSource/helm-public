---
status: draft
owner: helm-core
created: 2026-11-04
review_after: 2026-12-04
public_safety: Describes page routes, the page-service contract and guards of a default-off module. No tenant data, people, credentials, deployment identifiers or production receipts.
---

# CAIO 运营关注事项页面

> **语言 / Language**: 中文主文本 + [English reference](HELM_CAIO_ATTENTION_PAGES.en.md)

状态：页面与守卫已成形；生命周期服务与授权 loader 尚未接入时，页面使用默认关闭的桩，不读不写任何事项数据。入口闸门默认 `PAUSED`，本文不构成启用许可。

## 边界

- 系统只生成建议并预填人选与期限；确认派发、提交处置回执、复核关闭都由真人完成。
- 只发站内定向提醒，不自动对外发送。关闭只表示“运营处置已复核”，不计入业务成果。
- 模块不读写通用治理任务表（`check:caio-attention` 守卫）。

## 页面

| 路由 | 内容 |
|---|---|
| `/caio/attention` | 队列：当前成员可读的全部事项，未决（非终态）在前，再按严重度、时间排序，每页 20 条 |
| `/caio/attention/mine` | 我的关注事项：当前已确认命令中作为主责、知悉、升级人或复核人参与的事项 |
| `/caio/attention/[caseId]` | 详情：对象 → 已确认命令及与预填的差异（未确认时显示预填）→ 回执、复核、事件 → 下一步表单 |

下一步表单只按 loader 返回的 `allowedOperations` 显示：确认（可改预填，实时显示与预填的差异）、ack、note、提交处置回执、复核通过/退回；OWNER 另有驳回（仅待确认）、延期（选择延期到的时间）、撤销（处置中、待复核）、重新下达新命令版本（显示与当前命令的差异）、调整复核人。驳回与撤销必须填写原因。这里的 OWNER 指工作区 OWNER 角色，不是“确认这条事项的人”；任一工作区 OWNER 都可执行上述 OWNER 操作。复核表单要求逐条勾选外部证据，复核结论必填。

## 可见性

页面不直接访问数据库，只调用 `getCaioAttentionPageService()`。授权 loader 按 `canReadCaioAttentionCase` 过滤：确认前只有 OWNER 与 ADMIN（只读、每次写 READ 审计事件）可读；确认后是当前命令的参与人与复核人集合。未授权、跨工作区或非 ACTIVE 成员在列表中看不到行，详情返回与“不存在”相同的 404。

## 页面服务契约

定义于 `features/caio-attention/service-contract.ts`，由生命周期服务实现：

- `listCases({ viewer, scope: "queue" | "mine", page, pageSize })`：排序与分页在 loader 内完成。
- `loadCase({ viewer, caseId, sourcePage })`：返回事项视图或 `not_found`；ADMIN 监督读取的审计在 loader 内写入。
- `runCommand(input)`：`confirm`、`reissue`、`defer`、`dismiss`、`cancel`、`assignReviewers`、`ack`、`note`、`submitDisposition`、`reviewAccept`、`reviewReturn`。每个命令携带 `expectedCommandVersion` 与 `clientRequestId`（幂等），复核与调整复核人另带 `reviewerVersion`；`resumeDeferred` 只由系统按延期时间执行，页面不提供；服务在事务内重新校验成员、闸门与 CAS。

接入前 `features/caio-attention/service.ts` 提供默认关闭的桩：列表为空、详情 `not_found`、命令 `service_unavailable`，并导出 `CAIO_ATTENTION_PAGE_SERVICE_BOUND = false`。关闭能力由绑定状态推出：`CAIO_ATTENTION_CLOSE_CAPABILITY_VERSION = BOUND ? 1 : 0`，`capability.json` 必须与之相等（守卫断言），所以未接入时节点心跳上报 0，就绪证明签发另有 `page_service_unbound` 阻断。

## 能力版本与守卫

- 生命周期服务已接入（`lib/caio-attention-runtime/bound-page-service.ts`），`lib/caio-attention/capability.json` 随之为 `closeCapabilityVersion: 1`，表示本发布具备关闭链。探针上报的 `pageServiceBound` 在运行时判定：页面已绑定且 overlay 已注册关注事项 pack（有提醒策略）才为真；未注册时命令一律 `service_unavailable`，就绪证明被 `page_service_unbound` 阻断。入口闸门只有在 `requiredCloseCapability` 为 1 且所有预期节点都上报能力 1 时才放行。
- `npm run check:caio-attention`（接入 CI repo-guards）：模块不引用通用治理任务表；页面层不直接访问数据库；页面只经页面服务读取；能力声明等于绑定状态推出的值且关闭链表单同在；未接入时桩保持关闭。

## 导航入口

工作区侧栏与移动端导航显示“运营关注事项”，只是展示，不授权：服务未接入或成员非 ACTIVE 时隐藏；工作区 OWNER、ADMIN 可见；其他成员只有在至少一条当前已确认命令中参与时才可见。loader 出错时入口隐藏并记一条告警（只记错误名），不影响工作区外壳。
