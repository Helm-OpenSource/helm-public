---
status: active
owner: 李建乐
created: 2026-05-19
review_after: 2026-05-20
archive_trigger:
  - 2026-05-20 secret rotation / revocation is confirmed complete
  - A newer dated checklist replaces this start checklist
---

# Helm Secret Rotation And Release Unblock Checklist 2026-05-20

更新时间：2026-05-19
适用日期：2026-05-20
目标：启动并确认 `secret rotation / revocation`，把 public release 的唯一 P0 blocker 从“未启动”推进到“已处理并可留档”
边界：本清单只覆盖 rotation / revocation 启动与证据收集，不覆盖 rewrite、force-push、public mirror clean receipt 或 GitHub release

## 1. 完成定义

2026-05-20 这一步只有在以下 5 条都成立时，才算完成：

1. 已确认历史暴露的旧 RDS credential 当前是否仍可用。
2. 已执行轮换或吊销动作。
3. 已确认旧 credential 不能再连接。
4. 已拿到无 secret 的 rotation receipt。
5. 已把结果登记回 release 计划或 remediation 文档。

只完成“知道要轮换”或“已经让别人去处理”都不算完成。

## 2. 今日必须产出的输出物

今天必须至少产出这 4 个输出物：

1. 一条明确结论：
   - `旧 credential 已吊销`
   - 或 `旧 credential 已轮换且旧值不可用`
2. 一份无 secret 的 rotation receipt
3. 一条对 release 计划的状态更新
4. 一条对后续 rewrite 的 Go / No-Go 判断：
   - `Go to rewrite rehearsal`
   - 或 `No-Go, wait for rotation evidence`

## 3. 执行清单

### Step A：确认当前暴露对象

- [ ] 核对历史 remediation 文档中记录的 fingerprint、commit 和风险范围：
  - [HELM_RDS_SECRET_HISTORY_REMEDIATION_PLAN.md](../reviews/HELM_RDS_SECRET_HISTORY_REMEDIATION_PLAN.md)
- [ ] 明确这次要处理的是“历史暴露的旧 RDS credential”，不是泛化为全部数据库配置
- [ ] 在私人工作记录里登记：
  - credential 类型
  - 所属环境
  - 当前负责人
  - 当前系统是否仍依赖它

**通过标准**

1. 已经确认要轮换的对象唯一且范围清楚。
2. 不会把别的数据库口令误当作本次对象。

**失败即停**

如果连要处理的 credential 具体是哪一个都无法确认，今天不得进入 release-unblock 完成态。

### Step B：确认旧 credential 是否仍然活跃

- [ ] 通过实际 owner 或运维渠道确认旧 credential 是否仍在使用
- [ ] 若无法直接登录基础设施后台，至少要拿到 owner 的明确回复：
  - `仍在使用`
  - `已不再使用`
  - `状态不明`
- [ ] 把结论登记为三态之一，不允许写成模糊话术

**通过标准**

1. 已得到“仍活跃 / 已废弃 / 状态不明”三选一结论。
2. 不是口头猜测，而是有可追踪来源。

**失败即停**

如果状态仍不明，今天只能给 `No-Go`，不能继续声称 release blocker 在推进。

### Step C：执行轮换或吊销

- [ ] 如果旧 credential 仍活跃，执行轮换或吊销
- [ ] 优先目标：
  - 停止继续使用 root
  - 改为 least-privilege app account
- [ ] 如果无法当天切换到新 app account，至少先确保旧 credential 已失效
- [ ] 同步更新实际还在使用该 credential 的部署环境、secret store 或配置引用

**通过标准**

1. 旧 credential 已经失效，或已被替换。
2. 任何仍依赖旧 credential 的活跃配置都已更新或显式停用。

**失败即停**

如果只是“新值创建了，但旧值还可用”，今天不算完成。

### Step D：验证旧 credential 不可用

- [ ] 用不暴露 raw secret 的方式确认旧 credential 不能再连接
- [ ] 记录验证结果：
  - 验证时间
  - 验证人
  - 验证方式
  - 结果：PASS / FAIL
- [ ] 不把真实 secret 写进仓库、工单、截图或文档

**通过标准**

1. 存在“旧值不可用”的验证记录。
2. 记录中不含 raw secret。

**失败即停**

如果无法确认旧值失效，今天不得进入 rewrite 阶段。

### Step E：形成 rotation receipt

- [ ] 在仓库中只记录 non-secret rotation receipt
- [ ] receipt 至少要包含：
  - 日期：`2026-05-20`
  - 对象：historical RDS credential
  - 处理动作：rotated / revoked
  - 结果：old credential invalid
  - 下一步：go to rewrite rehearsal / wait for more evidence
- [ ] receipt 不得包含：
  - raw password
  - 可逆 token
  - 连接串原文
  - 云厂商后台截图中的 secret 部分

**建议落点**

1. 优先补到现有 remediation 文档的 validation / status 段落
2. 或另建一份 receipt 文档并从 remediation plan 引用

### Step F：更新 release 状态

- [ ] 回写 release 计划：
  - [HELM_GITHUB_APACHE2_PUBLIC_RELEASE_EXECUTION_PLAN_TO_2026_05_31.md](../reviews/HELM_GITHUB_APACHE2_PUBLIC_RELEASE_EXECUTION_PLAN_TO_2026_05_31.md)
- [ ] 把 Milestone B 状态更新为：
  - `completed`
  - 或 `blocked with explicit reason`
- [ ] 给出明日动作：
  - `rewrite rehearsal`
  - 或 `继续追 rotation evidence`

## 4. 建议执行顺序

```text
1. 确认暴露对象
2. 确认旧 credential 是否仍活跃
3. 执行轮换或吊销
4. 验证旧 credential 不可用
5. 形成 non-secret receipt
6. 回写 release 计划和 remediation 状态
```

不要先写 receipt，再去补验证；顺序不能反。

## 5. 今日 Go / No-Go 判定

### Go

只有同时满足以下条件，才能在 2026-05-20 结束时给 `Go to rewrite rehearsal`：

1. 旧 credential 已失效
2. rotation receipt 已形成
3. 仓库内没有写入任何 raw secret

### No-Go

出现以下任一情况，今天必须给 `No-Go`：

1. 旧 credential 是否仍活跃无法确认
2. 已创建新值，但旧值仍可用
3. 只有口头确认，没有可追踪证据
4. receipt 含 secret

## 6. 今日结束时建议汇报格式

```text
2026-05-20 secret rotation / revocation 状态：
- 对象：historical RDS credential
- 当前结论：rotated / revoked / blocked
- 旧值是否已确认失效：yes / no
- receipt：ready / missing
- 对 release 的判断：Go to rewrite rehearsal / No-Go
- 明日动作：<one line>
```

## 7. 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-05-19 | 首版：为 `2026-05-20` 的 secret rotation / revocation 启动动作提供单日可执行 checklist |
