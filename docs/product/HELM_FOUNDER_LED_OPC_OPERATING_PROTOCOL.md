---
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-05-30
archive_trigger:
  - 2026-05-31 v0.1.0-trial 发布评审完成后，本文件由 release closeout 复核是否继续作为 active protocol
  - Founder-led OPC 机制被正式 multi-reviewer governance 文档替代后 30 天内归档
  - 自 review_after 起 90 天，无任何 PR 或文档引用本文件
---

# Helm Founder-Led OPC Operating Protocol

更新时间：2026-04-30
状态：Active operating protocol
适用范围：Helm 仍处于 startup / OPC 阶段时，owner、Codex、Claude Code 与后续 reviewer 如何协作推进 GTM / Business Advancement / open-source trial 工作

## 1. 结论

Helm 当前不是成熟组织形态。现阶段项目 owner 仍是唯一最终决策人，所有关键工作由 owner 发起，由 Codex 准备判断材料、拆分任务、审计边界，由 Claude Code 或其他实现代理完成 bounded implementation。

因此，Helm 在 OPC 阶段不把“5 个 Required Reviewer”理解为必须立即配置 5 个全职真人角色。它们先作为 5 个不可省略的评审视角运行：

| 视角 | 当前 OPC 责任 |
| --- | --- |
| Engineering | Codex 准备实现边界、diff review、验证证据；owner 最终拍板 |
| Product | Codex 校准 GTM Must Push 主线与非目标；owner 最终拍板 |
| Security | Codex 审计 membership、capability、tenant、official write 与 secret hygiene；owner 最终拍板 |
| Operations | Codex 准备 rollout、rollback、observability、incident posture；owner 最终拍板 |
| Data Protection | Codex 准备 redaction、PII、retention、export、deletion evidence；owner 最终拍板 |

这不是降低标准，而是把成熟团队治理压缩成 founder-led decision packet，避免 startup 因角色未齐而停止推进，同时避免 AI 或实现代理绕过 owner 决策。

## 2. 角色分工

| 角色 | 职责 | 明确不做 |
| --- | --- | --- |
| Owner / Founder | 最终 Go / Revise / No-Go 决策；接受或拒绝风险；批准 merge、release、customer-facing claim | 不被默认视为所有外部专业 review 的长期替代品 |
| Codex | 项目负责人代理：读 repo truth、拆任务、指挥实现、审计 diff、准备 decision packet、给出合入建议 | 不擅自拍方向，不替 owner 承担最终业务承诺 |
| Claude Code / Worker Agent | 按 work order 实现具体切片，列出文件与验证结果 | 不扩题，不改 schema/API/runtime 边界，除非 work order 明确允许 |
| External / Independent Reviewer | 在安全、隐私、法律、公开 claim、真实客户数据场景中提供独立审查 | 不参与所有内部 docs-only 或 disabled scaffold 任务 |

## 3. 决策分级

### 3.1 Founder Self-Approve

Owner 可以直接拍板，Codex 保留 5 个评审视角的简短审计记录。

适用：

- docs-only planning、requirements、review response、demo script
- synthetic fixture、offline eval、read-only prototype
- disabled-by-default scaffold
- internal reserved tenant dogfooding 前的低风险准备
- 不涉及真实客户数据、不涉及 external claim、不改变 runtime authority 的 UI copy 或 index 更新

最低证据：

- scope / non-goals
- impacted files
- validation slice
- rollback 或 revert 路径

### 3.2 Founder Approval + Evidence Gate

Owner 仍可最终拍板，但必须先看到结构化证据。

适用：

- merge to main / push to remote
- `/mobile` Must Push 数据源切换
- Business Advancement thin read-model adapter allowlist
- Ask Helm asset capture candidate
- public README / cloud trial / release readiness
- company-memory weekly scorecard cadence
- GTM Pilot Workspace / Proof Pack Builder 的 internal active use

最低证据：

- decision packet 完整填写
- redacted / synthetic / local evidence 与真实证据明确区分
- targeted tests + boundary check
- feature flag / rollback proof
- recommendation != commitment / draft != send / proof != public claim 边界检查

### 3.3 Independent Review Required

Owner 不能只靠自审长期替代独立审查。Codex 可以准备材料，但必须引入外部或独立 reviewer，或保持 No-Go。

适用：

- 真实客户数据或 public trial 数据的 production runtime adoption
- PII redaction、retention、deletion、export 政策落地
- 公开案例、销售材料、客户 ROI / revenue claim
- credential leak response、secret rotation、security disclosure
- official write、customer-facing send、approval、settlement、payment
- open-source public release 前的 license / security / privacy hardening

最低证据：

- named reviewer 或正式外部审查记录
- reviewer scope 与 capability proof
- signed risk notes
- owner final approval

## 4. Founder Decision Packet

每个非微小任务进入 implementation 前，Codex 必须准备以下 packet。小任务可压缩，但字段不能缺。

```md
## Founder Decision Packet

### Decision
- Requested decision: Go / Revise / No-Go
- Decision class: Founder Self-Approve / Founder Approval + Evidence Gate / Independent Review Required
- Owner final approver:
- Plan version:

### Why Now
- GTM / Must Push / release / security driver:
- What happens if we do not do this now:

### Scope
- In scope:
- Out of scope:
- Files / surfaces likely touched:

### Five Review Lenses
- Engineering:
- Product:
- Security:
- Operations:
- Data Protection:

### Evidence
- Repo truth:
- Test / eval evidence:
- Data source posture: synthetic / redacted / live
- Boundary checks:

### Rollout
- Feature flag / allowlist:
- Rollback:
- Observability:

### Recommendation
- Codex recommendation:
- Residual risk:
```

## 5. Claude Code Work Order

Codex 分派实现时必须写清楚：

1. owner-approved objective
2. write scope
3. files or modules owned by Claude Code
4. files explicitly out of scope
5. forbidden changes
6. validation commands
7. expected final report format

Claude Code 不是独占 repo 的代理。它必须假设同一工作区可能有 owner 或 Codex 的并行改动，不得 revert 其他人的改动，不得自行扩大实施范围。

## 6. 当前 Helm P0 队列的 OPC 解释

| 工作 | OPC 决策级别 | 当前姿态 |
| --- | --- | --- |
| Founder-led protocol / docs / decision packet | Founder Self-Approve | 可立即落地 |
| GTM Pilot Workspace Mode | Founder Approval + Evidence Gate | internal reserved tenant 优先 |
| Proof Pack Builder | Founder Approval + Evidence Gate | proof claim 默认 internal，不公开 |
| Company-memory weekly scorecard | Founder Approval + Evidence Gate | 先用 offline eval / proxy，不能写成 production analytics |
| Business Advancement TPQR-001/003/004 adapter | Founder Approval + Evidence Gate | 可做到 disabled-by-default / allowlist-ready |
| Public trial cloud release | Independent Review Required | 至少 privacy / security / legal checklist 过门 |
| Production query adoption with live customer data | Independent Review Required | redacted live evidence + owner approval + reviewer proof |
| Customer-facing claim / ROI case | Independent Review Required | proof pack review + customer authorization |

## 7. 不可让步边界

即使处于 OPC 阶段，也不放松以下边界：

1. recommendation != commitment
2. explanation != approval
3. draft != send
4. proof != public claim
5. Ask Helm != chat product
6. Must Push ranking must be deterministic
7. no broad auto-write / auto-send / auto-approval
8. no cross-workspace aggregation
9. no schema expansion without independent plan
10. no production adoption without evidence

## 8. 升级触发

出现任一条件，Founder Self-Approve 自动升级为 Founder Approval + Evidence Gate 或 Independent Review Required：

- 接触真实客户数据、PII、凭据或支付信息
- 输出会被客户、投资人、合作伙伴看到
- 改变 production query、runtime authority、official write 或 visibility
- 影响 public release、license、security、data policy
- 触发 tenant / workspace / membership / capability 边界
- 现有 test / boundary / release guard 失败

## 9. 验证与收口

每个推进切片结束时，Codex 必须给 owner：

1. 变更摘要
2. 5 个评审视角结论
3. 验证结果
4. 没跑的验证及原因
5. 是否建议 merge / push / release
6. 剩余风险与下一步

没有验证结果，不算完成。没有 owner 最终决策，不算正式 Go。

## 10. 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-04-30 | 首版：把 Helm startup / OPC 现实收成 founder-led decision packet 与 5 review lenses 机制 |
