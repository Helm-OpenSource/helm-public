---
status: active
owner: helm-core
created: 2026-05-29
review_after: 2026-08-29
---
# Helm Core 上下游关系定义（helm-public ↔ helm2026）

## 1. 目的

本文件定义 `helm-public`（公开仓库）与 `helm2026`（私有仓库）的长期协作关系，避免：

1. private 改动反向污染公开仓库
2. core 真值分叉
3. 团队成员对“该在哪个仓库改”的判断不一致

## 2. 角色定位（单一真值）

1. `helm-public` 是 `helm-core` 的唯一公开上游真值仓库。
2. `helm2026` 是私有下游仓库，承载 tenant-private 扩展、内部证据、客户特定实现与受控试点 overlay。
3. 默认变更方向是 `helm-public -> helm2026`。
4. `helm2026 -> helm-public` 只允许“通用能力回流”，且必须走显式回流 PR。
5. 当前已验证同步机制是 public mirror / selective patch / PR 流程；`git subtree` 不作为默认流程，除非另有 owner 批准并更新本文件与 runbook。

## 3. 路径边界（仓库级）

`helm2026` 允许 private 内容存在于 tenant extension、internal evidence、commercial-private asset、private adapter 与 local artifact root 中；这些内容默认不回流到 `helm-public`。

`scripts/public-release-guard.ts` 的 private-root / private-file 常量是 public mirror 排除和扫描的机器化真值；本文件只描述治理边界，不复制完整 denylist，避免公开流程文档和 guard 形成两份真值。

下列路径视为 `helm-core` shared surface，允许作为回流候选：

1. `app/*`（不含 tenant-private route）
2. `components/*`
3. `features/*`（不含 tenant-private feature）
4. `lib/*`（不含 tenant-private adapter）
5. `scripts/*`（不含 internal-only orchestration）
6. `docs/*`（public-safe 文档，不含 internal-only docs root）
7. `tests/*`（只含 public-safe fixtures / assertions）
8. `.github/*`（只含公开仓可运行的 CI / community workflow）

## 4. 变更归属判定

按下面顺序判定改动属于哪个仓库：

1. 只要依赖租户私有数据、私有 connector、私有流程、私有 SLA、内部证据或客户特定承诺，即归 `helm2026`。
2. 只要是可公开复用、与租户无关、能独立通过 `helm-public` 验证的通用能力，即归 `helm-public`。
3. 若同时涉及 core 与 private，拆成两个 PR：
   - 先在 `helm-public` 提 core PR
   - 再在 `helm2026` 落 overlay PR
4. 若无法拆分，默认留在 `helm2026`，直到 private 依赖被抽离并形成 public-safe 回流候选。

## 5. 回流准入规则（private -> public）

`helm2026` 改动满足以下条件才允许提回流：

1. 不包含 tenant slug、客户名、私有 host、凭据、internal-only 文案。
2. 不依赖 private 目录、private 环境变量、private 数据结构或 source-only 未跟踪文件。
3. 能在 `helm-public` 独立通过验证，至少包括：
   - `npm run check:public-release`
   - `npm run check:boundaries`
   - `npm run typecheck`
   - 与改动相关的 targeted tests
4. PR 描述必须包含：
   - 回流来源（原私有分支 / PR / commit / mirror source ref）
   - 回流范围（哪些能力、哪些文件族）
   - 非回流范围（哪些 private 内容刻意不带）
   - 验证结果与无法运行项

## 6. 禁止事项

1. 禁止从 `helm2026` 直接整体覆盖 `helm-public`。
2. 禁止把 internal-only docs、tenant-private route、tenant-private scripts 或 source-local artifact 同步进公开仓库。
3. 禁止把 private 信息以“示例 / 注释 / receipt / screenshot / fixture”形式写入 shared 路径。
4. 禁止绕过 PR 直接推送 `main`（两边仓库都适用）。
5. 禁止把 `public-mirror:build` 生成的 candidate 当作已发布 release；正式 release 仍受 `release:check` manual acknowledgements 约束。

## 7. 运维节奏

1. 每周至少一次 `helm-public -> helm2026` 同步窗口。
2. 每次同步后在 `helm2026` 跑一次最小验收链，并修复 private overlay drift。
3. `helm2026 -> helm-public` 回流按需触发，每次只做一个主题。
4. 每月一次边界审计：
   - private 路径收敛检查
   - 回流候选列表复核
   - `scripts/public-release-guard.ts` 与 public mirror 工具链规则复核

## 8. 关联文档

1. [HELM_CORE_SYNC_RUNBOOK.md](../operations/HELM_CORE_SYNC_RUNBOOK.md)
2. [AGENTS.md](../../AGENTS.md)
3. [HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md](../product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)
4. [HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE.md](../product/HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE.md)
