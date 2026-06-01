# external-resource-kit

> 状态：Phase 1 contract templates only. No runtime, no DB write, no external provider access, no UI surface.

本目录承载 Helm 外部资源接入的 **planning contract templates 与 dry-run fixtures**。它是公开 Core 的 public-safe kit companion，服务于 [HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md](../docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md) 与 [HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md) 定义的 review-first 交付闭环。

## 不做什么

- 不放 `query.sql / prompt.md / metrics.json / result-criteria.json / message-template.md / subscription.example.json / sample-input.json` —— 这些归 [`report-skills/`](../report-skills/README.md)
- 不放租户专属 connector / route / SQL / credential / 字段映射 —— 这些归 `extensions/<tenant-key>/` 或私有租户仓库
- 不连生产 provider，不写主库，不改外部系统
- 不授权 runtime extractor / schema migration / API route / UI 行为 / official write / 自动发送 / 自动审批 / 自动执行

## 目录结构

```text
external-resource-kit/
  README.md                          # 本文件
  templates/                         # Phase 1 contract schemas（无业务实例）
    resource-intake.json             # §5.1
    source-contract.json             # §5.2
    mapping.json                     # §5.3
    signal-rules.json                # §5.4
    review-packet.json               # §5.5
  examples/                          # Phase 1–2 实例（owner sign-off 后才能新增）
    <resource-key>/
      source-contract.json
      sample-payload.json
      mapping.json
      signal-rules.json
      dry-run-result.json
      review-packet.json
```

`examples/synthetic-demo/` 是 synthetic-only 首个公开示例。新增 example 必须由 owner 提供 business owner / sample provenance plan / generic-vs-tenant 标注后才能进入本目录。

## 快速试运行

通用 dry-run evaluator 接受任意例子目录，按 `signal-rules.json` 对 `sample-payload.json` 做确定性评估，并写出 `dry-run-result.json` 与 `review-packets.json`。不连 provider，不写 DB，不调用 LLM。

```bash
npm run kit:dry-run -- --example external-resource-kit/examples/synthetic-demo
```

`examples/synthetic-demo/` 是 synthetic-only 演示（无任何租户数据），覆盖 5 类 rejection（`workspace_boundary / sensitivity / missing_evidence / stale_source / write_authority`）+ candidate / watch-only / skip 全部 disposition；输入 10 行，预期产出 3 candidate、1 watch-only、1 skip、5 rejected。

dry-run 拒绝在 `extensions/<tenant>/` 路径下运行；租户专属示例走租户专属流程。

## 文件职责

| 文件 | 服务阶段 | 关键约束 |
|---|---|---|
| `templates/resource-intake.json` | Phase 0 inventory | `nonGoals` 显式列出本资源不承担的事 |
| `templates/source-contract.json` | Phase 1 contract | source-of-truth posture、freshness、redaction、audit、failure modes 必须答清 |
| `templates/mapping.json` | Phase 1 contract | 外部字段 → projection / evidence；冲突与缺失字段策略必须显式 |
| `templates/signal-rules.json` | Phase 1 contract | deterministic eligibility / threshold / severity / dedupe / rejection 规则；rejection 必须按 5 类 taxonomy 标 `rejectionCategory` |
| `templates/review-packet.json` | Phase 2 dry-run + Phase 4 adoption | review packet 的最小治理单元；包含 allowed / forbidden actions 与 rollback path |

## 与 `report-skills/` 的分工

| 内容 | Owner |
|---|---|
| 通用 method、contract schema、mapping rule schema、review-packet schema | `external-resource-kit/`（本目录） |
| 通用 BI 报表 skill 的 `query.sql / schema / metrics / criteria / prompt / template` | [`report-skills/`](../report-skills/README.md) |
| 租户专属 connector、route、SQL、字段映射、凭据说明、客户源系统约定 | `extensions/<tenant-key>/` 或私有租户仓库 |

`external-resource-kit/` 可在 source contract / mapping 中通过 `reportSkillKey / reportSkillVersion` 引用 `report-skills/` truth，但不复制或分叉 `report-skills/` 的 SQL / prompt / criteria。

## Phase Gate

- **Phase 0 Inventory** → 产出 `resource-intake.json`（每个候选资源一份）+ 四类资源清单 + owner / 权限 / 数据敏感性清单。
- **Phase 1 Contract** → 产出 `source-contract.json / mapping.json / signal-rules.json` + ≥3 positive、≥3 rejected、≥2 watch-only sample，每条带 provenance + redaction note + expected rule result。
- **Phase 2 Dry-run** → 产出 `dry-run-result.json / review-packet.json / rejection-report.json`（无 provider call、无 DB write）。
- **Phase 3+** 不在本目录承担，需独立 review。

## 验证门槛

本目录改动不替代 [AGENTS.md](../AGENTS.md) §10 验证链。涉及代码实现时仍按 §10 顺序执行。

## 参考

- Public Core 信号接口：[HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md](../docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md)
- Golden Path 要求：[HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
- 商业边界：[HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md](../docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)
- 公开仓工作规则：[AGENTS.md](../AGENTS.md)
