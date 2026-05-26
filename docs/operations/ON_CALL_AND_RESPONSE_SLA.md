---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-05-31
archive_trigger:
  - 公开试点响应机制迁移到正式 ToS / Support Policy
  - Helm 不再承诺公开试点人工响应目标
---

# Helm 试点响应与值班机制

本文件定义 `v0.1.0-trial` 之前允许公开表达的响应目标、值班责任和失败降级口径。它不是商业 SLA，不承诺 24x7，不提供赔偿或服务额度。

## 一、适用范围

适用于：

- 试点申请首次答复
- `integration:` issue 人工回复
- 公开试点普通反馈
- 安全漏洞披露的分流提醒
- P0 / P1 试点事故的内部升级

不适用于：

- 正式商业客户 SLA
- 企业支持合同
- 7x24 on-call
- 客户生产数据处理承诺

## 二、工作日定义

- 工作日：周一至周五，UTC+8，排除中国大陆法定节假日。
- 工作时间：09:00-18:00 UTC+8。
- 非工作时间收到的问题，从下一个工作日 09:00 起算。
- 若公开页面写了“1 个工作日”或“7 个工作日”，必须按本定义解释。

## 三、响应目标

| 入口 | 目标 | First responder | 升级 |
| --- | --- | --- | --- |
| 试点申请 | 1 个工作日内首次答复 | Founder / helm-core owner | 超过 0.5 个工作日未认领，升级 owner |
| 通过试点后的首次 1:1 | 7 天内安排，取决于双方日程 | Founder / GTM owner | 无可用窗口时给出下一候选周 |
| `integration:` issue | 7 个工作日内人工回复 | Maintainer on duty | 超过 5 个工作日未回复，升级 maintainer owner |
| 普通 trial feedback | 2 个工作日内 triage | Trial support on duty | P1/P0 立即升级 |
| 安全漏洞披露 | 按 SECURITY.md：3 个工作日确认、7 个工作日初评 | Security reviewer | P0/P1 进入 incident 模式 |

## 四、P0 / P1 升级规则

P0 条件：

- 凭据泄露或疑似泄露
- 跨 workspace 数据访问或隔离失败
- 数据完整性事件
- 公开试点环境不可用超过 15 分钟
- retention / deletion 失败影响用户权利

P1 条件：

- 关键连接器或 LLM 路径持续失败但未造成数据越界
- 审计 trace 写入失败或关键 audit chain 断裂
- release hard gate 出现阻断但尚未公开影响用户

升级路径：

1. First responder 在 15 分钟内标记 P0/P1。
2. Operations lead 与 owner 进入同一事件线程。
3. P0 默认先止血：关闭相关 feature flag、撤回公开承诺入口、暂停新试点邀请。
4. 事件结束后必须补一份 `docs/reviews/` incident closeout 或在 `docs/STATUS.md` 风险项更新证据。

## 五、失败时的公开口径

当 Helm 没有按目标响应时，不能编造“已处理”。使用以下口径：

```text
我们没有在目标窗口内完成回复。Helm 当前仍是受控试点，不是商业 SLA。
这条请求已升级给 owner；我们会先确认是否仍适合进入试点，再给出下一步。
```

当集成请求不进入近期路线图时：

```text
这条 integration 请求已收到，但当前不会进入 P0/P1。
原因是它暂时不能直接支撑“会议 / CRM / 邮箱 → Must Push → Review Action”的首批闭环。
欢迎补充真实客户用例、数据流向和治理边界后重新评估。
```

## 六、Release Gate

公开发布前，`npm run release:check` 必须显式确认：

- `RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY=<YYYY-MM-DD>`
- first responder 已有人承担
- owner 知道 1 个工作日 / 7 个工作日目标是运营负债
- 若无法承担，README 必须改成 best-effort，不得继续写目标窗口

