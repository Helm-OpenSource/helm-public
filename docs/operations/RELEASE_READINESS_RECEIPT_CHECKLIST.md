---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-07-31
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Release Readiness Receipt Checklist

本清单把 `npm run release:check` 的人工 receipt 门收成可执行操作表。它不替代自动验证；它只记录哪些 release hard gate 需要 owner / operator 明确确认。

当前基线：`release:check` 自动链为 17 步；FAST preflight 覆盖 release hygiene、secret-history、boundary/self-check、Agentic Governance offline gate、IGS boundary static gate、IGS determinism gate、Business Advancement trace / ROI gate、Gate Consolidation gate、External Agent Intake P0-REQ-07 gate、typecheck 和 lint。公开发布仍必须等下表 7 个 receipt 全部满足；其中 public mirror clean receipt 推荐用 `npm run public-mirror:clean-receipt -- --receipt-id <id> --source-ref <ref> --mirror-root <candidate>` 生成，并用 `npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:<id>` 单独校验；receipt 必须包含 `npm run public-mirror:build -- --mirror-root <candidate>` 或 `npm run public-mirror:verify -- --mirror-root <candidate>` 的通过记录。

## 一、使用方式

Fast preflight：

```bash
DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026_ci_verify?charset=utf8mb4" \
npm run release:check
```

FAST / FULL 差异：

- FAST 默认跑 17 步中的 13 个自动项，其中六条 governance / offline drift gate 是 `npm run eval:agentic-governance`、`npm run eval:intelligence-growth-boundary-static`、`npm run eval:intelligence-growth-determinism`、`npm run eval:business-advancement-trace-roi`、`npm run eval:gate-consolidation`、`npm run eval:external-agent-intake-p0-req-07`。
- FULL 额外跑 `npm run test`、`npm run build`、`npm run quality:regression`、`npm run e2e`；这四条仍是 `RELEASE_READINESS_FULL=true` 才启用。

Tag 前完整链：

```bash
DATABASE_URL="<release verification database>" \
RELEASE_READINESS_CREDENTIAL_ROTATED="<YYYY-MM-DD>" \
RELEASE_READINESS_SECRET_HISTORY_REMEDIATED="<YYYY-MM-DD or mirror-clean:<receipt-id>>" \
RELEASE_READINESS_DOCKER_SMOKE_PASSED="<YYYY-MM-DD>" \
RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY="<YYYY-MM-DD>" \
RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE="claim_withdrawn" \
RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID="<approvalRecordId or UUID v4>" \
RELEASE_READINESS_CALIBRATION_REPORT="docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md" \
RELEASE_READINESS_FULL=true \
npm run release:check
```

禁止事项：

- 不要把任何新旧密码、token、连接串写入本文件或任何 tracked 文件。
- 不要为了让 `release:check` 通过而填假日期。
- 不要用本地 `check:secret-history` PASS 替代云端凭据轮换或公开镜像 clean receipt。
- 不要把 `claim_withdrawn` 理解成 trace timeline 已完成；它只表示公开“0 秒回放”承诺已撤回。

值格式：

- 日期类 receipt 必须使用真实完成日期 `YYYY-MM-DD`，不能填未来日期或占位文本。
- Secret history receipt 可使用真实完成日期，或使用 `mirror-clean:<receipt-id>` 记录公开镜像 clean receipt；`mirror-clean:<receipt-id>` 必须有 `docs/operations/release-readiness-receipts/<receipt-id>.json`，推荐由 `npm run public-mirror:clean-receipt -- --receipt-id <id> --source-ref <ref> --mirror-root <candidate>` 生成，并用 `npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:<id>` 单独校验；该 JSON 必须能追溯到 `npm run public-mirror:build -- --mirror-root <candidate>` 或 `npm run public-mirror:verify -- --mirror-root <candidate>` 的通过记录。
- Required Reviewer approval 必须使用持久化 approvalRecordId；当前接受 `appr-...` 或 UUID v4。
- Calibration report 必须是 repo 内已存在的 `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md`。

## 二、Receipt 表

| Gate | Env var | 当前状态 | Owner action | Evidence |
| --- | --- | --- | --- | --- |
| RDS credential rotated | `RELEASE_READINESS_CREDENTIAL_ROTATED` | 风险项 | Owner 在阿里云控制台轮换/吊销旧 RDS root 凭据，并更新内部 secret store | 不含密钥值的运维回执日期 |
| Secret history remediated | `RELEASE_READINESS_SECRET_HISTORY_REMEDIATED` | 风险项 | 云端凭据已失效后，执行受控 history rewrite 或发布 public mirror clean receipt | `check:secret-history` PASS + `npm run public-mirror:clean-receipt -- --receipt-id <id> --source-ref <ref> --mirror-root <candidate>` PASS + `npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:<id>` PASS + `docs/operations/release-readiness-receipts/<receipt-id>.json` |
| Docker smoke passed | `RELEASE_READINESS_DOCKER_SMOKE_PASSED` | 风险项 | 在 Docker Desktop / OrbStack / colima 主机跑 fresh-clone `docker compose up --build` smoke | 运行日期 + 关键截图 / 日志摘要 |
| On-call response policy ready | `RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY` | 待 owner 批准 | Owner 明确 first responder、升级路径、工作日定义、失败口径可承担 | [ON_CALL_AND_RESPONSE_SLA.md](ON_CALL_AND_RESPONSE_SLA.md) owner approval |
| Audit trace public posture | `RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE` | 可选 `claim_withdrawn` | 若 trace timeline 未完成，保持公开承诺撤回；若完成，再改为 `visualization_ready` | README / SECURITY / roadmap 已撤回 0 秒回放承诺；或 trace UI 验收记录 |
| Required reviewer approval | `RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID` | 风险项 | 生成并持久化 Phase 3 Required Reviewer approval record | approvalRecordId |
| Redacted calibration report | `RELEASE_READINESS_CALIBRATION_REPORT` | 风险项 | 用脱敏真实数据完成 calibration report，且文件路径存在 | `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_REDACTED_LIVE_CALIBRATION_REPORT_V1.md` |

## 三、Codex 可代办 / 不可代办

Codex 可代办：

- 维护 `release:check`、public-release guard、secret-history guard。
- 维护 `public-mirror:build`、`public-mirror:preflight`、`public-mirror:verify`、`public-mirror:clean-receipt`、`public-mirror:clean-receipt:check` 与 public mirror clean receipt 的验证入口。
- 维护接入 release FAST preflight 的 Agentic Governance / Intelligence Growth offline eval gates。
- 起草或更新 release evidence 文档、runbook 和状态表。
- 在本机隔离库跑验证并记录自动项结果。
- 根据 owner 给出的无密钥 receipt 更新文档或 release evidence。

Codex 不可代办：

- 轮换云端 RDS 凭据。
- 接触或记录真实 secret 值。
- 代替 owner 承担 on-call。
- 伪造 Docker 主机 smoke。
- 伪造 Required Reviewer approval 或真实数据 calibration。

## 四、当前推荐顺序

1. Owner 先完成 RDS 凭据轮换；没有这一步，secret history rewrite 不能安全执行。
2. 完成受控 history remediation 或 public mirror clean receipt。
3. 指定 on-call first responder，并确认响应目标是否可承担。
4. 在 Docker 主机跑 fresh-clone smoke。
5. 并行推进 Required Reviewer approval 与 redacted calibration report。
6. 若 trace timeline 不在本次发布范围，保持 `RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE=claim_withdrawn`。

## 五、最近自动验证基线

2026-05-03 在本 worktree 完成 release governance smoke：

- `npm run test -- lib/release-readiness-check.test.ts`：1 file / 7 tests 通过。
- `npm run eval:agentic-governance`、`npm run eval:intelligence-growth-boundary-static`、`npm run eval:intelligence-growth-determinism`：全部通过。
- `npm run release:check`：使用进程级本地 throwaway `CONNECTOR_TOKEN_SECRET` 只为满足 MUST env preflight；FAST 自动项 10 / 10 通过，FULL-only 4 项跳过，因 7 个 receipt 未满足，按预期返回 NOT READY。

2026-05-02 在本机隔离库 `helm2026_ci_verify` 上完成：

- `npm run db:reset`：通过；当前 `db:prepare/reset` 只执行 `extensions/**/sql/*.sql` setup SQL，避免 private tenant ODPS/QuickBI `report-skills/**/query.sql` 被 MySQL 执行。
- `npm run test`：461 files / 3287 tests 通过。
- `npm run self-check`：21 / 21 通过。
- `npm run release:check`：自动项全部通过；因 7 个 receipt 未满足，按预期返回 NOT READY。
