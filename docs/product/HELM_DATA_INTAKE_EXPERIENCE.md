---
status: draft
owner: Product / Delivery Engineering / Engineering
created: 2026-06-07
review_after: 2026-06-21
public_safety: Public Core UX contract only. No customer data, credentials, production connector proof, hosted ingest endpoint, automatic writeback, external send, approval execution, or deployment receipt.
---

# Helm Data Intake Experience / Helm 数据接入体验

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

Helm 数据接入体验默认从 **source intake** 开始，而不是从 connector 配置开始。
交付工程师先回答“现在有什么材料、能形成什么经营信号、需要什么最小权限、下一步
如何证明没有越权”，再进入 fixture、dry-run 或只读 connector。

这份契约只覆盖 public Core 的 L0-L2：

```text
L0 diagnostic material
  -> L1 redacted / synthetic fixture
  -> L2 read-only access
  -> review packet
```

它不覆盖 L3 写回、客户可见外发、审批执行、自动派单、正式 memory promotion、
生产连接器授权或客户部署批准。

## 1. 三层体验

| Layer | 交付工程师问题 | 输入 | 产出 | 边界 |
|---|---|---|---|---|
| L0 诊断材料 | 我现在有什么客户材料？ | 会议摘要、IM/email digest、CRM/工单截图、业务系统显式标记 | signal ledger、customer materials request | 无凭据、无客户系统写回、无自动外发 |
| L1 脱敏样本 | 这些材料能否形成可测的经营信号？ | redacted / synthetic CSV、JSON、Markdown 或 fixture | signal-quality report、HSI fixture、review packet | offline、public-safe、eval-backed，不证明生产新鲜度 |
| L2 只读接入 | 是否已经具备最小权限接 read-only connector？ | 最小 OAuth/API scope、dry-run 记录、审计 trace、撤销路径 | read-only ingest、quarantine/failure posture、review packet | 只读采集，不授权写回、外发、审批或部署 |

## 2. 用户旅程

1. `/setup` 先问“现在有什么材料”，而不是“要连接哪个系统”。
2. Helm 推荐 `collectionMode`、`dispositionMode`、下一条验证命令和 forbidden actions。
3. 交付工程师生成或查看 proof package：
   - `MANIFEST.json`
   - `customer-materials.md`
   - `signal-quality-report.md`
   - `hsi-fixture.json`
   - `review-packet.md`
4. 只有 L0/L1 证据清楚后，才在 `/settings?tab=connectors` 进入 L2 只读接入评审。
5. 接入后仍以 read-only ingest、quarantine、failure posture 和 review packet 为核心状态。

## 3. 页面契约

### `/setup`

“信号从哪来”步骤应展示 source intake cards：

- 会议 / workshop 摘要
- IM / 邮件 digest
- CRM / 工单 snapshot
- 脱敏表格
- 业务系统显式标记
- 只读 API 授权

每张卡必须显示：

- 推荐层级：L0 / L1 / L2
- 材料类型
- 采集与处置姿态
- 下一步 CTA
- 边界：不得自动写回、外发、审批、执行或进入正式 memory

Setup 写入的是 workspace 默认偏好；它不是 connector 授权、生产接入、数据处理批准、
客户部署批准或支持承诺。

### `/settings?tab=connectors`

连接器页必须先展示 Resource Access Catalog：

- 诊断材料
- fixture / dry-run evidence
- 最小权限说明
- read-only status（`last read-only ingest` 作为 v2 运行态字段延后）
- quarantine / failure posture
- forbidden actions

既有 connector 操作可以保留，但按钮附近必须说明：连接或同步只代表当前 read-only /
review-first 能力，不代表写回、外发、审批执行或生产部署授权。

## 4. Proof Package Viewer

第一版 viewer 只展示现有 Signal First Mile proof package 的文件清单、用途、eval command
和边界说明。它不上传材料、不生成 hosted endpoint、不调用外部 connector、不修改客户系统。

缺失文件时，viewer 应降级为“待生成 proof package”，并显示：

```bash
node templates/signal-first-mile/run-first-change-proof.js \
  templates/signal-first-mile/selector-input.sample.json \
  /tmp/helm-sfm-first-change-proof
```

## 5. 验证

最小验证链：

```bash
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
```

涉及具体 connector 行为时，追加对应 connector fixture / dry-run / e2e 验证。只改 UX 和
public-safe docs 时，不得声称生产 connector readiness。

## English Reference

Helm data intake starts from source intake, not connector configuration. Delivery
engineers first identify available material, signal value, minimum permission,
and public-safe proof before moving to fixtures, dry-run, or read-only connector
work.

This contract covers L0 diagnostic material, L1 redacted/synthetic fixtures, and
L2 read-only access only. It does not cover writeback, external send, approval
execution, automatic assignment, official memory promotion, production connector
authorization, or customer deployment approval.

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-06-07 | 初版：把数据接入体验从 connector-first 收敛为 L0/L1/L2 source-intake-first 契约，并绑定 `/setup`、`/settings?tab=connectors` 与 Signal First Mile proof package。 |
