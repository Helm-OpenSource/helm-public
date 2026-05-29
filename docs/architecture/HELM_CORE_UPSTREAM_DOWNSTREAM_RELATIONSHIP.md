---
status: active
owner: helm-core
created: 2026-05-29
review_after: 2026-08-29
---
# Helm Core 上下游关系定义（helm-public ↔ helm2026）

## 1. 目的

定义 `helm-public`（公开仓库）与 `helm2026`（私有仓库）的长期协作关系，避免：

1. private 改动反向污染公开仓库
2. core 真值分叉
3. 团队成员对“该在哪个仓库改”的判断不一致

## 2. 角色定位（单一真值）

1. `helm-public` 是 `helm-core` 的唯一上游真值仓库。
2. `helm2026` 是私有下游仓库，承载 tenant-private 扩展与个性化实现。
3. 默认变更方向是 `helm-public -> helm2026`。
4. `helm2026 -> helm-public` 只允许“通用能力回流”，且必须走显式回流 PR。

## 3. 路径边界（仓库级）

下列路径在 `helm2026` 允许 private 内容，且默认不回流到 `helm-public`：

1. `extensions/private/*`
2. `extensions/<tenant-slug>/*`
3. internal docs subtree（internal-only）
4. `app/api/extensions/*`（tenant-private adapter / route）

下列路径视为 `helm-core` shared surface，允许回流候选：

1. `app/*`（不含 tenant-private route）
2. `components/*`
3. `features/*`（不含 tenant-private feature）
4. `lib/*`（不含 tenant-private adapter）
5. `scripts/*`（不含 internal-only orchestration）
6. `docs/*`（public-safe 文档）

## 4. 变更归属判定

按下面顺序判定改动属于哪个仓库：

1. 只要依赖租户私有数据、私有 connector、私有流程、私有 SLA，即归 `helm2026`。
2. 只要是可公开复用、与租户无关的通用能力，即归 `helm-public`。
3. 若同时涉及 core 与 private，拆成两个 PR：
   - 先在 `helm-public` 提 core PR
   - 再在 `helm2026` 落 overlay PR

## 5. 回流准入规则（private -> public）

`helm2026` 改动满足以下条件才允许提回流：

1. 不包含 tenant slug、客户名、私有 host、凭据、internal-only 文案。
2. 不依赖 private 目录、private 环境变量、private 数据结构。
3. 能在 `helm-public` 独立通过验证（至少 `typecheck`、`check:boundaries`、`check:public-release`）。
4. PR 描述必须包含：
   - 回流来源（原私有 PR/commit）
   - 回流范围（哪些文件）
   - 非回流范围（哪些 private 内容刻意不带）

## 6. 禁止事项

1. 禁止从 `helm2026` 直接整体覆盖 `helm-public`。
2. 禁止把 internal-only docs subtree 或 tenant-private 脚本同步进公开仓库。
3. 禁止把 private 信息以“示例/注释”形式写入 shared 路径。
4. 禁止绕过 PR 直接推送 `main`（两边仓库都适用）。

## 7. 运维节奏

1. 每周至少一次 `helm-public -> helm2026` 同步。
2. 每次同步后在 `helm2026` 跑一次最小验收链。
3. 每月一次边界审计：
   - private 路径收敛检查
   - 回流候选列表复核
   - guard 规则更新

## 8. 关联文档

1. [HELM_CORE_SYNC_RUNBOOK.md](/Users/chm/.codex/worktrees/d88c/helm-public/docs/operations/HELM_CORE_SYNC_RUNBOOK.md)
2. [AGENTS.md](/Users/chm/.codex/worktrees/d88c/helm-public/AGENTS.md)
3. [HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md](/Users/chm/.codex/worktrees/d88c/helm-public/docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md)
