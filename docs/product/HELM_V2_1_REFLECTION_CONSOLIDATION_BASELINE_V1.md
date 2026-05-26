---
status: active
owner: helm-core
created: 2026-04-09
review_after: 2026-07-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_V2_1_REFLECTION_CONSOLIDATION_BASELINE_V1

## 目的

冻结 Helm v2.1 当前这条很窄的 `Reflection / Consolidation v1` truth：

- 把 trusted runtime state 收成 reviewable 的 carry-forward summary
- 让 `meeting human_confirmed -> reflection job -> SessionNotebook summary` 形成一条可见闭环
- 在 `/meetings/[id]` 与 `/operating` 上把 reflection queue 和 consolidation queue 分开表达

这不是 dreaming engine，也不是自动长期记忆改写器。

## 已经完整成立

1. `meeting_reflection` 已作为受控 job 类型进入现有 `ConsolidationJob` substrate，不新增大 schema。
2. human-confirmed meeting review 之后会自动排一条 reflection job；operator 也可以手动排队。
3. reflection 会只基于 trusted runtime state、verification posture、promoted facts、problem-space next steps 生成 notebook-friendly summary。
4. reflection 现在也会同步写一条 `VERIFIED` 的 carry-forward `MemoryCandidate`，作为后续 pattern / memory work 的 review-safe 输入。
5. workspace operator surface 现在除了 `reflection queue` 之外，还能单独看到 review-safe 的 `reflection carry-forward` candidates。
6. `/memory` 现在也会显式展示这些 reflection carry-forward candidates，作为记忆时间线之上的 runtime-to-memory 过渡层。
7. owner / admin / operator 现在可以在 `/operating`、`/memory` 与 `/meetings/[id]` 上显式 dismiss 这些 carry-forward candidates；dismiss 会把结果写进显式 promotion ledger 和 audit / event，但不会改写 canonical truth。
8. owner / admin / operator / reviewer 现在也可以显式 accept 这些 carry-forward candidates；accept 只会把它们推进到显式 runtime promotion ledger 和 continuity truth，不会静默改写 canonical object truth。
9. `app/api/helm-v2/runtime/reflection/*` 现在也有独立 queue / list / pause-resume contract，`accept` / `dismiss` 都有独立受治理 route，不再只挂在 consolidation 命名下。
10. reflection 继续保留 review-first、candidate-only、evidence-first 边界。

## 已成形但仍需下一层

1. 当前只覆盖 `meeting_reflection`，还没有 `retro_reflection`、`execution_reflection` 或 nightly sweep。
2. 当前输出主要是 `SessionNotebook` carry-forward summary 与 reflection job summary，还不是 canonical delta object。
3. 当前已经有显式 accept / dismiss flow，但还没有更细粒度的 multi-step delta apply lifecycle。
4. 当前虽然有独立 API contract 和 carry-forward readout，但底层仍复用 `ConsolidationJob` substrate，还不是独立 persisted reflection object。
5. `/memory` 目前支持 accept / dismiss，但仍不会在该页直接改写 canonical memory truth。
6. 当前没有把 reflection 直接接到 pattern extraction、strategy suggestion 或 goal/campaign delta write-back。

## 刻意未做

1. 不做 dreaming engine。
2. 不做 untrusted 自动 promotion。
3. 不做 canonical truth 自动改写。
4. 不做 Goal / KPI / policy 自动更新。
5. 不做 customer-facing wording synthesis 或外发。

## 风险项

1. reflection summary 仍然依赖现有 notebook / verification / promoted facts 质量，不能替代更深层 canonical goal system。
2. 当前复用了 `ConsolidationJob` 容器，后续如果 reflection delta 需要独立审查状态，可能还要补专门对象。
3. 当前 API 虽然已经把 reflection queue/status/accept/dismiss contract 收正，但依旧没有真正的 delta apply workflow。
4. 当前虽然已经能在 `/operating`、`/memory` 与 `/meetings/[id]` 看见 carry-forward candidates，并做 accept / dismiss，但 lifecycle 仍然停在 review-safe runtime promotion，不是 canonical memory rewrite。
5. 当前 operator surface 已经解决“看见”“排队”和“显式 accept / dismiss”，但还没有解决 reflection result 的更深一级 object / campaign delta apply lifecycle。
