---
status: archived
owner: helm-core
created: 2026-04-16
review_after: 2026-10-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm v2.1 SWARM-001 Spawn Contract Freeze Report V1

## 结论

`SWARM-001` 到当前这一阶段的冻结结论是：

- `已成形但仍需下一层`

原因很直接：

- 当前已经把 `spawn admission / budget envelope / deny readout / request record / operator readout` 收进同一条 review-first contract spine
- `runThread`、operator debugger、meeting runtime surface 和 `/operating` continuity queue 已经开始共享同一份 swarm spawn truth
- request record 已经形成最小可审计 runtime event，但仍然只到 `requested`，没有进入真实 worker fan-out 或 execution plane
- 这仍然不是 `SWARM-002`，也不是 verifier merge lane、operator swarm dashboard 或 broader authority plane

## 已经完整成立

- `swarmSpawnContract` 已经统一收口 `workspace flag / budget posture / policy deny` 的 admission truth
- `swarmSpawnContract.state` 已经稳定给出 `requestable / blocked_flag / blocked_budget / blocked_policy`
- `swarmSpawnContract.denyReason / denySummary` 已经稳定给出 operator-facing 阻断原因
- 最小 runtime event `swarm.spawn.requested` 已经成立
- `requestRecordState / requestEventId / checkpointId / checkpointKey / requestedAt / requestedBy / sourcePage` 已经接回 contract 与 debugger read model
- meeting runtime surface 已经可以记录最小 `swarm spawn request`
- `/operating` continuity queue 已经把 swarm request lifecycle 提升为显式读口，而不是继续藏在长 meta 串里
- `/operating` continuity queue 已经重新显式露出 repeat-pattern 与 pilot-review 关键读口，相关 remediation analytics e2e 已重新转绿
- `README / docs / PLANS / self-check` 已同步到同一版 discoverability truth

## 已成形但仍需下一层

- 当前只到 `request record`，还没有真实 worker spawn
- 当前还没有 `pending / active / merged` 这类 execution lifecycle
- 当前还没有 nested spawn、pause / resume / kill、worker graph 或 verifier merge lane
- 当前 operator readout 仍然只是 bounded read-model，不是 swarm control plane

## 刻意未做

- 不做 `SWARM-002` read-only worker fan-out
- 不做 verifier / arbiter merge lanes
- 不做 operator swarm dashboard
- 不做 candidate-only consolidation fan-out
- 不做 broad workflow engine
- 不做 team-mode / peer messaging
- 不做 auto-send / broad auto-write / authority 扩面

## 风险项

- `next.config.ts` 仍有既有的 Turbopack/NFT tracing warning；这不是本阶段引入的新失败
- `lint` 仍有 current-main 既有的 `lib/connectors/google.ts` 4 条 warning；这不是本阶段引入的新失败
- 当前 `spawn request` 还没有进入 execution plane，后续如果直接跳 `SWARM-002`，容易在 execution lifecycle 上重新发明状态机

## 必须继续诚实保留的边界

- 这仍然不是真实 swarm worker fan-out
- 这仍然不是 verifier merge lane
- 这仍然不是 operator swarm dashboard
- 这仍然不是 workflow engine
- 这仍然不是 broader authority plane
- recommendation / explanation 仍然不等于 commitment

## 当前基线 / sprint 目标是否清楚

清楚。

当前这条线的冻结目标是：

- 把 `spawn contract + budget envelope + deny readout + request record + operator readout` 冻成 current-main 可验证 truth
- 明确停在 `requested`，不提前进入真实 worker 执行
- 把 `/operating` continuity queue 对 swarm request 与 repeat-pattern analytics 的读口收成稳定 operator surface

## recommendation / commitment 两条主线是否仍保持稳定

保持稳定，仍然是 `A-minus`。

这一阶段没有把：

- swarm request 写成 execution commitment
- operator readout 写成自动 fan-out 承诺
- review-first boundary 写成 broader authority

## 验证

完整标准链在 freeze worktree 通过：

```bash
ALLOW_DB_RESET=true DATABASE_URL=file:./dev.db npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

补充说明：

- `lint` 只有 current-main 既有的 `lib/connectors/google.ts` 4 条 warning，没有错误
- `build` 仍会打印既有的 Turbopack/NFT tracing warning，但构建通过
- 这轮特别复核通过的回归包括：
  - `tests/e2e/continuity-remediation-analytics.spec.ts`
  - `tests/e2e/continuity-recovery.spec.ts`
  - `tests/e2e/demo-flows.spec.ts`
  - `tests/e2e/formal-trial-flow.spec.ts`

## 下一阶段最该做的 5 件事

1. 把 `SWARM-001` 继续收成 request lifecycle freeze，而不是直接跳 execution plane
2. 在 `SWARM-002` 里只做 read-only worker fan-out，不混入 merge lane
3. 把 verifier / arbiter merge lane 保持到独立切片，不混进 `SWARM-002`
4. 在 operator surface 上补更明确的 request history / deny trend readout，但仍不扩 authority
5. 在 canary workspace 下验证 `workspace-flagged + default-off` 的真实治理效果，再决定是否继续推进下一层
