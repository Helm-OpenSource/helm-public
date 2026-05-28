> **语言 / Language**：**中文** · [English](WORKING-CONTEXT.en.md)

# Helm Working Context

## 1. 目的

这份文件是 Helm 的短周期执行上下文。

它的作用是把当前工程现实、active queue、主要 blocker 和最近一次有意义的执行提醒留在一个轻量入口里，而不是把这些短周期内容硬塞进 `AGENTS.md`、`README.md` 或 freeze 报告。

长期 truth 仍然应该放在：

- [AGENTS.md](AGENTS.md)
- [README.md](README.md)
- [docs/README.md](docs/README.md)
- [DESIGN.md](DESIGN.md)
- product / review / baseline docs under `/docs`

这份文件应该保持：

- 当前
- 短
- 可执行
- 当 active queue 改变时容易重写

这份文件不应该变成：

- 第二份 README
- baseline freeze 报告
- 历史档案堆
- 对已经落在正式文档里的长期 truth 的重复抄写

## 2. 当前主干执行现实

截至 `2026-05-18`（GTM 切换：开源 + 交付工程师定位）：

- **根定位已切换**：从"对企业的 SaaS 销售口径"切到"对 AI 生态交付工程师的开源 toolkit 口径"；唯一受众层是交付工程师，端客户通过他们落地。新一页 1-pager 见 [docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md)
- **README + docs/README 已对齐新定位**：差异表（vs Coze / 悟空 / Dify / LangGraph / LangChain）、30 分钟 onboarding 锚点、"不卖 SaaS 给端客户"边界写明；试点 CTA 降级为"早期落地伙伴可选路径"
- **AGENTS.md §3 新增两条定位轴**：`delivery-engineer-facing`、`open-source-first`；并在"Helm 当前不是"补一行"SaaS 直销给端客户的产品"
- **Helm Inc 商业模式收敛**：① open-core 维护 ② Helm Cloud（可选托管） ③ Helm Enterprise（私有部署 / 商业 connector / 高级 audit） ④ Certified Delivery Partner 生态认证
- **新增 P0 工作项**：`extensions/case-management-sample/` vertical 参考实现从 tenant-private vertical pack 脱敏抽出，作为 v0.1 公开镜像核心叙事的"带电池整机"证据；positioning collateral track 见 [docs/_planning/HELM_POSITIONING_COLLATERAL_TRACK_V1.md](docs/_planning/HELM_POSITIONING_COLLATERAL_TRACK_V1.md)
- **三个执行决策确认**（2026-05-18 二次确认）：
  1. **`docs/sales/GUANGPU_*` 处置 = 移到 `docs/internal/sales/`**（决策 b）。origin/main 上已落地的销售文档与新口径冲突；独立 PR off origin/main 移动，不影响当前 positioning cascade PR
  2. **Grandfathered direct pilot 政策**：Guangpu 等既存试点客户作为**特殊历史安排**保留 Helm Inc. 直营关系，**不复用**；新客户一律走 Certified DP / Helm Cloud / Helm Enterprise。政策落到 [docs/internal/HELM_GRANDFATHERED_DIRECT_PILOTS_POLICY_V1.md](docs/internal/HELM_GRANDFATHERED_DIRECT_PILOTS_POLICY_V1.md)（internal-only）
  3. **5-31 release 是真实目标**，**不延期**。critical path：① case-management-sample 抽取（5 人天，2026-05-22 截止）→ ② D2 onboarding 实跑验证（5-27 截止）→ ③ D3 cookbook（5-29 截止）→ ④ D4 demo video（5-30 截止）→ ⑤ Go/No-Go（5-30）→ ⑥ release（5-31）。任一节点 No-Go 则全停

截至 `2026-05-02`（Release reality alignment + receipt checklist）：

- **公开承诺已降到可兑现姿态**：README / SECURITY / public roadmap / trial runbook 已撤回不可兑现的 `30/7` 固定保留期承诺与“0 秒 trace 回放”承诺；integration roadmap 已收窄到飞书 / M365 / Google Workspace / Slack / Zoom 五个首批入口；正式口径见 [docs/product/HELM_RELEASE_REALITY_ALIGNMENT.md](docs/product/HELM_RELEASE_REALITY_ALIGNMENT.md)
- **Release hard gates 已进入 `release:check`**：自动链新增 `check:secret-history`；人工门新增 secret-history remediation、on-call policy、audit trace public posture；当前 `release:check` 在隔离库上自动项全绿，但 7 个 receipt 未满足，因此仍按预期 NOT READY
- **Release receipt checklist 已落地**：[docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md](docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md) 把 RDS 轮换、secret-history remediation、Docker smoke、on-call owner approval、audit trace posture、Required Reviewer approval、redacted calibration report 收成 owner action / evidence / env var
- **Degraded-mode health surface 已有第一层**：`/health` 公开只读面显示 DB / LLM / connector / capture / audit trace 当前姿态；它不是 uptime SLA，不暴露租户计数，下一层才是登录后的 workspace-scoped drill-down
- **OPC dogfood 链已降档**：Founder internal gate、dogfood packet、review notes、founder decision、run report、Phase 3V rehearsal 不再单独宣传为完整业务能力；后续合并方向是 `packet-generator` + `rehearsal-runner`
- **Extension seam 已收口为 first-party / private tenant seam**：`lib/extensions/registry.tsx` 不再被描述为第三方 plugin runtime / sandbox / marketplace；真实 sandbox 仍刻意未做
- **本机隔离库验证基线已更新**：`helm2026_ci_verify` 上 `npm run test` 461 files / 3287 tests 通过；`npm run self-check` 21 / 21 通过；`npm run release:check` 自动项全绿，因 7 个 receipt 未满足而 NOT READY

截至 `2026-04-30`（Founder-led P0 release hygiene closeout）：

- **OPC 执行协议已进入第一轮闭环**：第一份 founder decision packet 已驱动 P0 release hygiene，收口证据见 [docs/reviews/HELM_P0_PUBLIC_RELEASE_HYGIENE_CLOSEOUT.md](docs/reviews/HELM_P0_PUBLIC_RELEASE_HYGIENE_CLOSEOUT.md)
- **Public-release guard 当前恢复 PASS**：`npm run check:public-release` 最新扫描 2933 files / 0 blockers；tenant-specific private surface 不再污染 public mirror blocker
- **Business Advancement founder internal gate 已落地**：[docs/reviews/HELM_BUSINESS_ADVANCEMENT_FOUNDER_INTERNAL_GATE_CLOSEOUT.md](docs/reviews/HELM_BUSINESS_ADVANCEMENT_FOUNDER_INTERNAL_GATE_CLOSEOUT.md) 记录 `Go-For-Disabled-Internal-Dogfooding` 仅限 positive fixture；production query、runtime integration、public trial 全部继续 No-Go
- **Business Advancement internal dogfood packet 已落地**：[docs/reviews/HELM_BUSINESS_ADVANCEMENT_INTERNAL_DOGFOOD_PACKET_CLOSEOUT.md](docs/reviews/HELM_BUSINESS_ADVANCEMENT_INTERNAL_DOGFOOD_PACKET_CLOSEOUT.md) 记录 review-only candidate groups 与 stop conditions；下一步是人工内部 dogfooding review notes，不是 runtime integration
- **Business Advancement internal dogfood review notes 已落地**：[docs/reviews/HELM_BUSINESS_ADVANCEMENT_INTERNAL_DOGFOOD_REVIEW_NOTES_CLOSEOUT.md](docs/reviews/HELM_BUSINESS_ADVANCEMENT_INTERNAL_DOGFOOD_REVIEW_NOTES_CLOSEOUT.md) 记录 5 个 review lenses、TPQR family coverage、operator JSON input 与 founder-review summary；positive / issue / sample JSON 仍只到 review notes，不是 runtime integration
- **Business Advancement internal dogfood founder decision 已落地**：[docs/reviews/HELM_BUSINESS_ADVANCEMENT_INTERNAL_DOGFOOD_FOUNDER_DECISION_CLOSEOUT.md](docs/reviews/HELM_BUSINESS_ADVANCEMENT_INTERNAL_DOGFOOD_FOUNDER_DECISION_CLOSEOUT.md) 记录 founder decision gate；positive fixture 最多批准下一轮 disabled internal dogfood iteration，不是 runtime integration
- **Business Advancement internal dogfood run report 已落地**：[docs/reviews/HELM_BUSINESS_ADVANCEMENT_INTERNAL_DOGFOOD_RUN_REPORT_CLOSEOUT.md](docs/reviews/HELM_BUSINESS_ADVANCEMENT_INTERNAL_DOGFOOD_RUN_REPORT_CLOSEOUT.md) 记录 observation notes 到 founder-review-ready summary 的收口；positive / issue fixture 最多到 `Run-Report-Ready`，不是 production query adoption
- **Business Advancement Phase 3V local calibration rehearsal 已落地**：[docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3V_LOCAL_CALIBRATION_REHEARSAL_CLOSEOUT.md](docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3V_LOCAL_CALIBRATION_REHEARSAL_CLOSEOUT.md) 记录远端 DB 不可达后的本地隔离库验证；Phase 3P→3Q→3R→3S 工具链可跑，且 production/runtime 继续 No-Go
- **RDS secret history remediation 已完成本地 dry-run，但 P0 未解除**：[docs/reviews/HELM_RDS_SECRET_HISTORY_REMEDIATION_PLAN.md](docs/reviews/HELM_RDS_SECRET_HISTORY_REMEDIATION_PLAN.md) 记录当前文件树无明文残留、`origin/main` 历史仍可达 3 个 compromised commits、本地 mirror rewrite 后 all-ref / object raw secret hits = 0；正式解除仍需 owner 在阿里云轮换/吊销旧凭据并安排受控 history rewrite

截至 `2026-04-27`（Week 1 冲刺当日推进结束态）：

- **五月开源 + 云端试用 launch plan 已对齐**：四项关键决策（License = Apache-2.0、不同步发布 `extensions/guangpu/`、云端试用不承诺 SLA 但承诺 30/7 数据保留期、Phase 3 runtime adoption 在五月受限解禁）与五周分解见 [docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md)
- **License 决策已落地**：`LICENSE`、`NOTICE`、`package.json` 的 `"license": "Apache-2.0"` 字段已添加
- **Track A 开源前置卫生本日批量落地**：`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`CHANGELOG.md` 起草完成；旧 244K `README.md` (2776 行) 已 `git mv` 到 `docs/HELM_INTERNAL_FREEZE_REFERENCE.md` 并加内部专属 header；新 `README.md` 重写为 ~212 行，按 What / Demo / Quick Start / 当前能做 vs 刻意不做 / Roadmap / Contributing 结构对外读者可读
- **Track B 云端最小集本日批量落地**：`.env.example` 已分层为 `MUST` / `OPTIONAL_AI` / `OPTIONAL_CONNECTORS` 三档；`scripts/validate-env.ts` 重写为三档分级校验（MUST 缺失=fail，OPTIONAL_* 缺失=warn，按 trigger key 只警告启用块的缺失项）；`docker-compose.yml` 与 `Dockerfile` 已落地，目标 `git clone && docker compose up && open http://localhost:3000/mobile` 可见
- **Phase 3 runtime adoption 解禁姿态变化**：原 [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) §5.5 中关于 runtime extractor / production query adoption 的全局禁止条款，被 [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md) §一 列出的解禁范围**部分覆盖**；其余 No-Go 条款（schema 扩张、自动执行、跨 workspace、marketplace）继续生效；OPC 阶段按 [HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md](docs/product/HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md) 执行：内部 disabled scaffold / reserved dogfooding 可由 founder decision packet 覆盖 5 个评审视角，真实 public trial / production data / 隐私 / 安全 / 公开 claim 仍需 evidence gate 或 independent review
- **boundary check / self-check 已对齐 README 瘦身**：`scripts/decision-first-boundary-check.ts` 中 4 个 README-haystack 检查（reconciliation_docs / trial_onboarding / helm_v2_1_runtime_hardening / skill_formal_review_queue / reserved_workspace_host_gating）现在同时读取 `docs/HELM_INTERNAL_FREEZE_REFERENCE.md`；`scripts/helm-self-check-refactored.ts` 的 Reserved Workspace Backfill Assets 检查同步；`scripts/public-release-guard.ts` 新增 `PRIVATE_FILES` 列表，把 `docs/HELM_INTERNAL_FREEZE_REFERENCE.md` 标记为内部专属

截至 `2026-04-26`：

- 当前真实 Git 工作目录（canonical repo root）：`/Users/tommyqian/Documents/GitHub/helm2026`（基于 `origin/main@208ed1b5c fix: restore continuity runtime review surfaces`）
- 本轮实施 worktree / branch：`/Users/tommyqian/Documents/GitHub/helm2026-market-positioning-upgrade`（branch `codex/market-positioning-upgrade`），仅作本轮市场定位升级文档/上下文切片实施面，不是 canonical repo root
- 根目录 `app/` 仍然是 current-main route owner
- `data/queries.ts` 仍然是 current-main query aggregation seam
- Helm 仍然保持 `workspace-first`、`membership-backed`、`controlled-trial`、`judgement-first`、`decision-first`
- recommendation 不等于 commitment；proactive 不等于自动决策或自动发送权限
- 市场定位本轮已收口为「Helm 经营推进控制台 / 经营推进操作系统（受控试点）」；详细定位、竞争边界、四类短表与下一阶段队列见 [docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md)
- `DESIGN.md` 现在已经是 homepage、dashboard、approvals、operating、detail、settings、setup 和 demo shell 的固定视觉基线
- `Mobile Command Surface` 已实现：`/mobile` 第一屏把 Ask Helm mobile answer、Must Push 必须推进项与 Review / Memory / Operating 承接入口收在同一张窄手机端经营推进入口；本地完整验证已通过
- 旧版本里关于 `DB-backed E2E blocked by ${HELM_DB_HOST} 不可达` 的描述按「历史 / 已 unblocked」处理，不再代表当前主干 blocker
- 旧版本里的 `/Users/qianzhilong/Documents/helm` 路径与 `Mem 未提交切片` 描述按「历史」处理；当前主干已落地 005H/005I/005J + Phase 0–3 freeze 与 continuity runtime review surface 修复

## 3. 当前优先级

**2026-05-18 新增 P0（release blocker，需视为优先于下列 item 1-8）：**

- **case-management-sample 抽取（P0）**：从 tenant-private vertical pack 脱敏抽出 `extensions/case-management-sample/`，作为 v0.1 公开镜像的"带电池整机"证据；缺则 1-pager 与 README §90 秒看到 Helm 都没有 vertical 锚点；spec 待起草
- **Positioning collateral 5-31 ready（P0）**：1-pager（已落） · `docker compose up` 30 分钟 onboarding 实跑验证 · 1 个 vertical cookbook · 短 demo video；track 见 [docs/_planning/HELM_POSITIONING_COLLATERAL_TRACK_V1.md](docs/_planning/HELM_POSITIONING_COLLATERAL_TRACK_V1.md)

当前工程优先级顺序（五月窗口，2026-05-02 release reality 收口后状态）：

1. **Release receipt hard gates（P0）**：7 个 receipt 未齐前不得公开发布；执行清单见 [RELEASE_READINESS_RECEIPT_CHECKLIST.md](docs/operations/RELEASE_READINESS_RECEIPT_CHECKLIST.md)
2. **凭据轮换 + history remediation（P0，user-only + maintenance window）**：当前文件树与 `check:secret-history` 均无已知 compromised commit 可达，但正式解除仍需 owner 在阿里云控制台轮换/吊销旧 RDS root 凭据，并形成 public mirror clean / history remediation receipt。新密码与旧值均不应再出现在任何 tracked 文件中
3. **Docker quickstart runtime smoke（user-only）**：本机无 Docker，需在装有 Docker Desktop / OrbStack / colima 的环境跑 `docker compose up --build` 验证 fresh-clone 路径
4. **On-call / response owner approval（P0）**：[ON_CALL_AND_RESPONSE_SLA.md](docs/operations/ON_CALL_AND_RESPONSE_SLA.md) 已落地；公开发布前必须指定 first responder，并确认 1 个工作日 / 7 个工作日目标是可承担的运营负债
5. **Design partner P0（GTM 真值）**：第一个 ≥¥30k design partner 仍是 Pack A / Phase 3 的真实外部信号；当前仍缺 8-10 通验证电话、Top 1 + backup、Week 0 合同 / DPA / 数据清单
6. **Phase 3 runtime adoption 解禁前置**：5 角色 Required Reviewer 框架存在；OPC dogfood 链已降档为待合并；剩 actual `redacted_live_db_snapshot` / calibration report / approval record，真实 public trial / production data 仍需 evidence gate 或 independent review
7. **Degraded-mode health surface 深化**：`/health` 公开只读面已落地；下一层是登录后的 workspace-scoped connector / LLM / capture / audit trace drill-down
8. **Intelligence Growth P0 Offline Gate（P0 offline gate 已落地 / 后续 P1+ No-Go）**：Slice A–D 已全部完成；`lib/intelligence-growth/` 类型契约 + 80 fixture cases（10 维度） + 10 failure taxonomy + offline evaluator CLI（`eval:intelligence-growth` / `eval:intelligence-growth:context` / `eval:intelligence-growth:routing`）+ docs/status/self-check 集成已落地；新增 `eval:intelligence-growth-tenant-signals`，把 10 条 IGS 改进项作为 Helm 内置自身业务发展租户 `helm-business-development` 的 report source 投影为经营信号 candidate（4 Must Push / 6 ReviewRequiredAction / 10 LearningCandidate，越权计数 0）；新增 `eval:intelligence-growth-review-packets`，把 10 条信号承接为 founder approval + required reviewer 的 offline review packet（scope / promotion / runtime authority leak 均为 0）；新增 `eval:intelligence-growth-weekly-scorecard`，把当周所有 review packet 聚合为 founder / operator weekly scorecard（candidate-only，不授权 runtime / DB / write；当前：10 packets、4 ready_for_founder_review、6 needs_required_review、0 blocked、coverage 100%、authority leaks 0）；新增 `eval:intelligence-growth-decision-outcomes`（`evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json` + `lib/evals/intelligence-growth-decision-outcome-evals.ts` + `scripts/intelligence-growth-decision-outcome-evals.ts`），把 founder / operator 决策结果收录为离线 fixture，闭合 review packet → weekly scorecard → 决策结果台账完整反馈环（OFFLINE-ONLY，仅限 helm-business-development；当前：10 条决策记录、decision/evidence/owner/reviewer/boundary coverage 100%、nextLearningCandidateCount 10、unauthorized/raw incidents 0）；新增 **P0+++++ IGS Learning Requeue Gate**（`eval:intelligence-growth-learning-requeue`，`evals/intelligence-growth-learning-requeue/learning-requeue-cases.json` + `lib/evals/intelligence-growth-learning-requeue-evals.ts` + `scripts/intelligence-growth-learning-requeue-evals.ts`），把决策结果台账中的 nextLearningCandidateId 重新入列为下一周期学习候选，完整闭合决策反馈 → 候选重入环（OFFLINE-ONLY，candidate-only，仅限 helm-business-development；当前：10 candidates、expectedCandidateCount 10、candidateCoveragePercent 100、blockedDecisionCandidateCount 3、unexpectedCandidateCount 0、sourcePacketMismatchCount 0、invalidStatusCount 0、unauthorized/raw incidents 0、evidence/owner/boundary coverage 100）；**明确 No-Go**：不做 DB schema，不做 API，不做 UI，不改生产 prompt，不做 schema/policy/write/canonical memory/skill auto-promotion，runtime / self-learning 继续 No-Go；**P1+ 前置条件仍是**：真实流量 + Data Protection review + founder approval
   - **P0++++++ IGS Chain Integrity Gate**：新增 `eval:intelligence-growth-chain`（`lib/evals/intelligence-growth-chain-integrity-evals.ts` + test + CLI wrapper），原生串联 tenant signal → review packet → weekly scorecard → decision outcome ledger → learning requeue 五段 gate；当前通过：10/10/10/10/10 count continuity、executionMode native、continuityPass true、totalUnauthorizedIncidentCount / totalRawDataIncidentCount / totalScopeMismatchCount 均为 0、minimumCoveragePercent 100%；summary injection 默认拒绝，测试需显式 `allowInjectedSummariesForTesting`
   - **P0+++++++ IGS Cycle Advance Gate**：新增 `eval:intelligence-growth-cycle-advance`（`lib/evals/intelligence-growth-cycle-advance-evals.ts` + test + CLI wrapper），把 W18 learning requeue candidates 物化为 W19 next-cycle intake；当前通过：totalIntakeCandidates / expectedIntakeCandidateCount 10/10、intakeCoveragePercent 100%、sourceCandidateMismatchCount / sourcePacketMismatchCount / statusMismatchCount 0、scopeMismatchCount / windowMismatchCount 0、unauthorizedFlagCount / rawCustomerDataIncidentCount 0、evidence/owner/boundary coverage 100%；仍 offline-only / candidate-only
   - **P0++++++++ IGS Fixture Lint Gate**：新增 `eval:intelligence-growth-fixture-lint`（`lib/evals/intelligence-growth-fixture-lint-evals.ts` + test + CLI wrapper），对 80 个核心维度 fixture、10 tenant signal、10 decision outcome、10 learning requeue candidate 做元验证；当前通过：duplicateIdCount / missingIdCount / invalidDimensionCount / invalidDecisionCount 0、orphanReviewPacketReferenceCount / orphanDecisionReferenceCount / orphanRequeueReferenceCount / missingRequeueCandidateCount 0、scopeMismatchCount / windowMismatchCount 0、unauthorizedFlagCount / rawCustomerDataIncidentCount 0；仍 offline-only，不修复 fixture，不生成样本
   - **P0+++++++++ IGS Dimension Saturation Gate**：新增 `eval:intelligence-growth-dimension-saturation`（`lib/evals/intelligence-growth-dimension-saturation-evals.ts` + test + CLI wrapper），验证 W19 next-cycle intake 覆盖全部 10 个智能维度且当前 fixture 每维度只出现一次；当前通过：expectedDimensionCount / coveredDimensionCount 10/10、dimensionCoveragePercent 100、missingDimensions 0、duplicateDimensionCount 0、maxDimensionCandidateCount 1、unauthorized/raw incidents 0；仍 offline-only，不做优先级调度，不生成候选
   - **P0++++++++++ IGS Remediation Roundtrip Gate**：新增 `eval:intelligence-growth-remediation-roundtrip`，验证 continue / revise / blocked / stop 在下一轮不会被错误复活或升级；仍 offline-only，不改变 runtime 行为
   - **P0+++++++++++ IGS Budget Gate**：新增 `eval:intelligence-growth-budget-gate`，验证模型、token、工具、wallclock budget envelope，防止 P0 offline gate 变成无界 agentic run
   - **P0++++++++++++ IGS Determinism Gate**：新增 `eval:intelligence-growth-determinism`，对 core eval + 18 个派生 gate 连跑 3 次，除 allowlisted volatile 字段外不允许输出漂移
   - **P0+++++++++++++ IGS Boundary Static Gate**：新增 `eval:intelligence-growth-boundary-static`，机械拒绝 DB / Prisma、API route、Next server、production query、LLM env 和 network call 进入 IGS P0 离线链
   - **P0++++++++++++++ IGS Eval Replay Snapshot Gate**：新增 `eval:intelligence-growth-eval-replay-snapshot`，固定 18 个 gate 的 contract-level canonical summary，防止 evaluator 输出形状漂移
   - **P0+++++++++++++++ IGS Schema Drift Gate**：新增 `eval:intelligence-growth-schema-drift`，固定 TS union、contracts registry、fixture-lint sentinel、fixture keyset、snapshot keyset 与 snapshot version
   - **P0++++++++++++++++ IGS Failure Taxonomy Coverage Gate**：新增 `eval:intelligence-growth-failure-taxonomy-coverage`，固定 10 个 taxonomy 文档与 30 个负例 fixture 的 failure type 映射
   - **P0+++++++++++++++++ IGS Data Protection Manifest Gate**：新增 `eval:intelligence-growth-data-protection-manifest`，固定 18 个 checked-in IGS fixture JSON 的字段级 redaction manifest；所有 DP 状态仍 pending，gate green 不代表 DPO approval
   - **P0++++++++++++++++++ IGS Approval Readiness Gate**：新增 `eval:intelligence-growth-approval-readiness`，固定 10 个 P1+ approval readiness packet；gate green 不代表 founder / required reviewer approval
   - **P0+++++++++++++++++++ IGS Live Calibration Preflight Gate**：新增 `eval:intelligence-growth-live-calibration-preflight`，固定 10 个 redacted evidence package；gate green 不代表 live calibration approval 或 runtime adoption
9. **Phase 3 thin read-model adapter 实现**：仅 TPQR-001/003/004 可继续，必须保持 feature flag、deterministic ranking、review-first、no schema / no official write / no auto execution
10. **数据保留落地**：法务签署前不对外承诺 30/7；产品层仍需 retention status、自助导出、删除证明与最终数据政策对齐
11. **MySQL 1020 hardening 收口**：dailyUsageSnapshot / recommendationLog / membership 路径在新增 audit write 后必须不再产生 1020 trace
12. **Final Review + 公开发布**：只有 release hard gates 全部满足后才能进入

继续保持的长期优先项：

- 维持 current-main truth、docs 和 validation surfaces 与「经营推进控制台」定位口径一致
- 按 `DESIGN.md` 逐步改造最高信号的产品界面，而不是做 broad UI rewrite
- 继续把 auth / governance / approval 边界保持在 controlled-trial infrastructure 口径，不写成平台扩张

## 4. 当前约束与非目标

日常实现时持续保持可见：

- plugin runtime 仍然没有真正 sandbox
- future-real auth 仍然不是完整生产级认证
- Helm 仍然不是完整 enterprise multi-org / multi-role / multi-tenant 平台
- Helm 仍然不是完整 workflow engine、orchestration platform、BI platform 或 auto-execution plane
- 没有 broad auto-write；默认没有 send authority
- continuity 当前按 `stable & maintained` 理解（基线提交 `208ed1b5c` 已恢复 continuity runtime review surfaces）；只有出现真实 regression、risk 或 guard drift 时才重新打开
- Memory 写入链路仍是 review-first / read-only operator substrate，不自动 retry、不自动改写 canonical facts、不扩 recommendation / commitment authority
- bounded retry executor 仍只接受人工确认，只写一个 reconstructed `MemoryFact`，不重跑 meeting pipeline，不创建 commitment / blocker / recommendation，不自动发送
- **Phase 3 runtime adoption 五月受限解禁**：仅 TPQR-001 / TPQR-003 / TPQR-004 三条 thin read-model adapter 允许接入 production query 路径；TPQR-002 / TPQR-005 继续 No-Go；schema 扩张、official write、自动执行、LLM 最终排序、跨 workspace 聚合、SkillSuggestionCandidate 自动晋升、Ask Helm 多轮聊天历史持久化继续禁止；内部推进按 founder-led decision packet 覆盖 5 个评审视角，真实 public trial / production data 仍需 6 项硬前置 + independent review（详见 `HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md` 与 `HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md`）

## 5. 当前开发纪律

所有非微小任务仍然按下面顺序推进：

1. `plan`
2. `implementation`
3. `validation`
4. `report`

默认验证链仍然是：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

如果某次任务没有跑完整链路，任务报告必须说明：

- 哪些命令没跑
- 为什么没跑
- 剩余风险是什么

## 6. 最近一次有意义的本地完整验证（2026-04-26）

以下结果来自 Mobile Command Surface 实现切片之后的 isolated full-validation 跑批：

- `npm run db:reset`：通过（隔离环境）
- targeted continuity E2E：6 用例通过
- `npm run check:boundaries`：通过
- `npm run typecheck`：通过
- `npm run test`：2667 测试通过
- `npm run build`：通过
- `npm run quality:regression`：181 测试通过
- `npm run e2e`：34 用例全部通过

## 6.1 本日（2026-04-27）Week 1 + Week 2 §三 #11 推进切片验证

仅跑工程影响范围内的快速切片，未跑全链 db:reset / build / e2e / quality:regression（本日改动以 docs / config / shared-layer slug 清理 / 守卫脚本为主，不触及核心运行时业务路径）：

- `npm run validate:env`：MUST tier 通过（CONNECTOR_TOKEN_SECRET 弱值告警为预期）
- `npm run typecheck`：通过
- `npm run lint`：0 errors / 7 pre-existing warnings
- `npm run check:boundaries`：194 / 194 PASS；`tenant_slug_shared_layer_reverse_block` 现在 0 new violations + 7 grandfathered（从 35 减少）
- `npm run self-check`：20 / 21 PASS；剩余 1 项 `Database Configuration` 失败为本地 `.env` 残留 `file:./dev.db`（pre-existing）
- `npm run check:public-release`：**PASS** — 2725 files / 0 blockers（本日 601 → 0）
- impacted vitest（tenant-resources / monitor-substrate / google connector / system-mail / approvals / dashboard / extensions/guangpu/bi-report/tests / lib/llm + extension / 7 文件 / 22 test）：全绿

## 6.2 本日新增的 shared-layer ↔ tenant 解耦 seam

- `lib/extensions/registry.tsx`（唯一允许 compile-time 引用 `@/extensions/<tenant>/*` 的 shared-layer 文件，listed in `POLICY_DESCRIPTOR_ALLOW_LIST`）：
  - `resolveReportsExtensions(workspace)` — `app/(workspace)/reports/page.tsx` 用
  - `resolveImportsExtensions(workspace)` — `app/(workspace)/imports/page.tsx` 用
  - `resolveApprovalsExtensions(workspace)` — `features/approvals/page-loader.ts` 用
  - `logReportsExtensionPageView(event)` — 路由侧的 page-view-event 委托
- `BI_REPORT_ODPS_KNOWLEDGE_PATH` env var：`lib/bi-report-skill/odps-knowledge.ts` 路径配置化，租户 knowledge 文件由 env 注入
- 公开 mirror 生成时（Week 5）若 `extensions/<tenant>/` 不存在，可选 (a) `lib/extensions/registry.tsx` 替换为 stub 或 (b) 改为 dynamic import + try/catch graceful fallback；当前静态 import 在私有 mirror 下完全工作

## 6.3 2026-04-30 P0 release hygiene 验证

- `git diff --check`：通过
- `npm run check:public-release`：**PASS** — 2912 files / 0 blockers
- `npm run typecheck`：通过
- impacted vitest（row-level signal postprocessor / DingTalk placeholder / settings dry-run detail / trial reserved workspace negative path）：4 文件 / 20 tests 通过
- `npm run check:boundaries`：仍 FAIL，但当前失败为既有 legacy UI / boundary marker drift；`tenant_slug_shared_layer_reverse_block` 已 PASS（0 new violations）

## 6.4 2026-04-30 Business Advancement founder internal gate 验证

- `npm run test -- features/business-advancement/founder-internal-gate.test.ts`：1 文件 / 9 tests 通过
- `npx tsx scripts/business-advancement-founder-internal-gate.ts`：default fixture 返回 `Revise`，生产 / runtime / public trial 全部 blocked
- `npx tsx scripts/business-advancement-founder-internal-gate.ts --positive-fixture --expect-go`：positive fixture 返回 `Go-For-Disabled-Internal-Dogfooding`，仍不允许 production query adoption / runtime integration / public trial
- `npm run typecheck`：通过

## 6.5 2026-04-30 Business Advancement internal dogfood packet 验证

- `npm run test -- features/business-advancement/internal-dogfood-packet.test.ts features/business-advancement/founder-internal-gate.test.ts`：2 文件 / 18 tests 通过
- `npx tsx scripts/business-advancement-internal-dogfood-packet.ts`：default fixture 返回 `Blocked`
- `npx tsx scripts/business-advancement-internal-dogfood-packet.ts --positive-fixture --expect-ready`：positive fixture 返回 `Ready-For-Internal-Dogfooding`，输出 TPQR-001/003/004 review-only candidate groups
- `npx eslint --max-warnings 0 features/business-advancement/internal-dogfood-packet.ts features/business-advancement/internal-dogfood-packet.test.ts scripts/business-advancement-internal-dogfood-packet.ts`：通过
- `npm run typecheck`：通过
- `npm run check:public-release`：通过，2921 files / 0 blockers
- `npm run check:boundaries`：失败于既有 marker drift；本片相关的 doc lifecycle、Phase 3 runtime No-Go、tenant slug shared-layer reverse block 均通过

## 6.6 2026-04-30 Business Advancement internal dogfood review notes 验证

- `npm run test -- features/business-advancement/internal-dogfood-review-notes.test.ts features/business-advancement/internal-dogfood-packet.test.ts`：2 文件 / 23 tests 通过
- `npm run business-advancement:internal-dogfood-review-notes`：default fixture 返回 `Blocked`
- `npm run business-advancement:internal-dogfood-review-notes -- --positive-fixture --expect-ready`：positive fixture 返回 `Ready-For-Founder-Review`，生产 / runtime / public trial 全部 blocked
- `npm run business-advancement:internal-dogfood-review-notes -- --issue-fixture --expect-ready`：issue fixture 返回 `Ready-For-Founder-Review` + `Revise-Before-Next-Internal-Dogfood`，仍不允许 production query adoption / runtime integration / public trial
- `npm run business-advancement:internal-dogfood-review-notes -- --input-file features/business-advancement/internal-dogfood-review-notes.sample.json --expect-ready`：operator JSON sample 返回 `Ready-For-Founder-Review`，JSON 不能携带 production / runtime / public authority 字段
- `npx eslint --max-warnings 0 features/business-advancement/internal-dogfood-review-notes.ts features/business-advancement/internal-dogfood-review-notes.test.ts scripts/business-advancement-internal-dogfood-review-notes.ts`：通过
- `npm run typecheck`：通过
- `npm run check:public-release`：通过，2929 files / 0 blockers
- `npm run check:boundaries`：失败于既有 marker drift；本片相关的 doc lifecycle、Phase 3 runtime No-Go、tenant slug shared-layer reverse block 均通过

## 6.7 2026-04-30 Business Advancement Phase 3V local calibration rehearsal 验证

- 远端 dev/RDS 探测：Prisma 报 configured remote database server unreachable；具体 host 不写入本次新增记录
- `DATABASE_URL="${LOCAL_DATABASE_URL}" DB_RESET_ALLOWLIST='helm2026_ba_calibration' npm run db:reset`：首次未设置 `HELM_SKIP_EXTENSION_SQL=1` 时 extension SQL 因 `Unknown data type: 'STRING'` 失败；设置 `HELM_SKIP_EXTENSION_SQL=1` 后 migration + seed 通过
- `npm run test -- features/business-advancement/phase3v-local-calibration-rehearsal.test.ts features/business-advancement/phase3p-redacted-snapshot-collector.test.ts features/business-advancement/phase3u-live-calibration-unblock-preflight.test.ts`：3 文件 / 115 tests 通过
- `DATABASE_URL="${LOCAL_DATABASE_URL}" npm run business-advancement:phase3v-local-calibration-rehearsal -- --reference-clock-iso '2026-04-30T00:00:00.000Z' --take 100`：通过；`sampleKind=local_development_snapshot`，Phase 3Q intake pass，Phase 3R/3S 按预期 blocked / No-Go
- `npx eslint --max-warnings 0 scripts/business-advancement-phase3v-local-calibration-rehearsal.ts features/business-advancement/phase3v-local-calibration-rehearsal.test.ts`：通过
- `npm run typecheck`：通过
- `npm run check:public-release`：通过，2924 files / 0 blockers
- `npm run check:boundaries`：失败于既有 marker drift；Phase 3V 新文档 lifecycle、Phase 3 runtime No-Go、tenant slug shared-layer reverse block 均通过

## 6.8 2026-04-30 Business Advancement internal dogfood founder decision 验证

- `npm run test -- features/business-advancement/internal-dogfood-founder-decision.test.ts features/business-advancement/internal-dogfood-review-notes.test.ts`：2 文件 / 23 tests 通过
- `npm run business-advancement:internal-dogfood-founder-decision`：default fixture 返回 `Blocked`
- `npm run business-advancement:internal-dogfood-founder-decision -- --positive-fixture --expect-approve`：positive fixture 返回 `Approve-Next-Disabled-Internal-Dogfood-Iteration`，生产 / runtime / public trial 全部 blocked
- `npm run business-advancement:internal-dogfood-founder-decision -- --issue-fixture`：issue fixture 返回 `Revise-Before-Next-Iteration`，仍不允许 production query adoption / runtime integration / public trial
- `npx eslint --max-warnings 0 features/business-advancement/internal-dogfood-founder-decision.ts features/business-advancement/internal-dogfood-founder-decision.test.ts scripts/business-advancement-internal-dogfood-founder-decision.ts`：通过
- `npm run typecheck`：通过
- `npm run check:public-release`：通过，2933 files / 0 blockers
- `npm run check:boundaries`：失败于既有 marker drift；本片相关的 doc lifecycle、Phase 3 runtime No-Go、tenant slug shared-layer reverse block 均通过

## 6.9 2026-04-30 Business Advancement internal dogfood run report 验证

- `npm run test -- features/business-advancement/internal-dogfood-run-report.test.ts`：1 文件 / 11 tests 通过
- `npm run business-advancement:internal-dogfood-run-report -- --positive-fixture --expect-ready`：positive fixture 返回 `Run-Report-Ready` + `Continue-Disabled-Internal-Dogfooding`，生产 / runtime / public trial 全部 blocked
- `npm run business-advancement:internal-dogfood-run-report -- --issue-fixture --expect-ready`：issue fixture 返回 `Run-Report-Ready` + `Revise-Before-Next-Internal-Dogfood`，仍不允许 production query adoption / runtime integration / public trial
- `npm run business-advancement:internal-dogfood-run-report -- --stop-fixture`：stop fixture 返回 `Blocked` + `Stop-And-Return-To-Calibration`
- `npx eslint --max-warnings 0 features/business-advancement/internal-dogfood-run-report.ts features/business-advancement/internal-dogfood-run-report.test.ts scripts/business-advancement-internal-dogfood-run-report.ts`：通过
- `npm run test -- features/business-advancement/internal-dogfood-run-report.test.ts features/business-advancement/internal-dogfood-founder-decision.test.ts features/business-advancement/internal-dogfood-review-notes.test.ts features/business-advancement/internal-dogfood-packet.test.ts features/business-advancement/founder-internal-gate.test.ts`：5 文件 / 52 tests 通过
- `npm run typecheck`：通过；首次失败原因是 stale `.next/types/* 2.ts` duplicate generated files，清理生成物后通过
- `npm run lint`：通过，0 errors / 3 既有 warnings（来自一个既有 private tenant process script）
- `npm run build`：通过；保留既有 Turbopack NFT trace warning
- `npm run check:public-release`：通过，2937 files / 0 blockers；期间外部生成的未跟踪 sales/brand/partner 草稿已移出 repo
- `git diff --check`：通过
- `npm run check:boundaries`：失败于既有 marker drift；本片相关的 doc lifecycle、Phase 3 runtime No-Go、tenant slug shared-layer reverse block 均通过
- `npm run test`：失败于既有 README/docs index marker drift 与本机 DB 缺失（`Database helm2026 does not exist`）；本片 5-file targeted BA dogfood chain 通过
- `npm run quality:regression`：失败于既有 README/docs index marker drift
- `npm run self-check`：失败于本机 `DATABASE_URL` / Database Configuration 未配置
- `npm run db:reset` / `npm run e2e`：未跑；本片无 schema/DB 改动，且本机 DB 未配置，避免对不明确 DB 目标做破坏性 reset

## 6.10 2026-05-01 UI/UX/copy precision pass closeout 验证

`docs/reviews/HELM_UI_UX_COPY_PRECISION_PASS_CLOSEOUT_20260501.md` 收口报告记录 14.5h / ~100 commit / 19 PR 的精修路径。最终门禁：

- `npm run typecheck`：✅ pass
- `npm run lint`：✅ 0 errors / 0 warnings（从 0 errors / 3 warnings 收紧）
- `npm run check:public-release`：**PASS** — 3090 files / 0 blockers
- `npm run check:boundaries`：✅ **all rules pass**（之前的 README/docs index marker drift / 5 条角色对话 + external 叙事兜底 marker 都已被修正——boundary check 中的预期字符串与文件已经同步到 de-Englishize 后的 CN 文案）
- `npm run quality:regression`：✅ 51 文件 / 181 tests 全绿
- 主要 P0 已落地：DingTalk live invite approval gate / `AuditLog` `traceId` 三列 + AsyncLocalStorage trace context / README 集成表真值化（Salesforce → Alpha；LLM → 仅 OpenAI；会议 → ASR-only）

## 6.11 2026-05-02 release reality + receipt checklist 验证

- `git diff --check`：通过
- `npm run check:secret-history`：通过，无已知 compromised commits 可达
- `npm run check:boundaries`：通过
- `npm run typecheck`：通过
- `npm run lint`：通过
- `DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026_ci_verify?charset=utf8mb4" DB_RESET_ALLOWLIST=helm2026_ci_verify HELM_SKIP_EXTENSION_SQL=1 npm run db:reset`：通过；不设置 `HELM_SKIP_EXTENSION_SQL=1` 时 Guangpu ODPS SQL 会被 MySQL 执行并报 `Unknown data type: 'STRING'`
- `DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026_ci_verify?charset=utf8mb4" npm run test`：461 files / 3287 tests 通过
- `DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026_ci_verify?charset=utf8mb4" npm run self-check`：21 / 21 通过
- `DATABASE_URL="mysql://root:root@127.0.0.1:3306/helm2026_ci_verify?charset=utf8mb4" npm run release:check`：自动项全部通过；7 个人工 receipt 未满足，按预期 `NOT READY`

## 7. 当前残留风险

1. **Release receipt 未齐**：`release:check` 自动项已可通过，但 7 个人工 receipt 未满足；公开发布仍是 No-Go
2. **MySQL 1020 concurrency warning trace**：在 E2E 跑批期间出现于 `dailyUsageSnapshot`、`recommendationLog`、`membership` 周边；最终 assertion 全部通过，但 hardening 仍未关闭，不能因为通过 assertion 就视为已解决；五月 Phase 3 解禁需要新增 `AuditEvent.metadata` 写入，必须先收口此项
3. **RDS secret history P0 未正式解除**：本地 `check:secret-history` 已 PASS，但正式 release 仍需要云端凭据轮换回执和受控 history remediation / public mirror clean receipt
4. **本机默认 DB 仍非稳定验证目标**：共享 `helm2026` 库存在历史迁移状态问题；当前推荐继续用隔离库 `helm2026_ci_verify` 跑验证，避免污染共享库
5. plugin runtime sandbox 缺位
6. future-real auth 不是完整 enterprise SSO / SCIM
7. broad auto-write、auto-send、auto-execution 仍未授权
8. Phase 3 runtime adoption 五月解禁前提条件未齐：Phase 3V 只证明本地工具链 rehearsal；internal dogfood review notes / founder decision gate / run report 只证明内部复核与 OPC 决策结构可机器验证；actual `redacted_live_db_snapshot` 仍未输出，public trial / production data 所需 independent review 未启动
9. shared `helm2026` DB 旧 failed migration / view-base-table blocker 仍存在；migration-state repair 属于独立任务
10. **private tenant signals UI 仍未物理迁移**：当前 public-release guard 已把它归入 private surface，五月前仍需决定是否做 route 物理搬迁或 public mirror stub
11. **公开试用数据政策未与法务对齐**：30/7 仅是目标草案；正式公开试点以法务签署、工作区契约和产品 UI 落地为准

## 8. Repo-Local Codex Config 说明

repo-local Codex 默认约定现在放在：

- [.codex/config.toml](.codex/config.toml)
- [.codex/hooks.json](.codex/hooks.json)
- `scripts/codex-hooks/*`

当前意图：

- `standard` profile = 普通仓库开发任务
- `strict` profile = 更高风险的 cross-module / hardening / release-adjacent 任务
- `explorer` agent = read-first codebase exploration
- `reviewer` agent = correctness / regression / boundary review
- `docs_researcher` agent = README / docs / baseline / freeze drift tracing
- `repo-local hooks` = 最小 guardrail 层，当前覆盖 `no-verify`、`git push` 目标/dirty/upstream 提醒、配置保护、设计质量检查、`console.log/console.error/debugger/TODO: remove before merge` 检查、窄 `SessionStart` bootstrap、Stop 阶段 validation 提醒

实践提醒：

- 当前 Codex app/runtime 里已经存在 project-layer config 支持
- 当前 hooks 依赖 `.codex/config.toml` 里的 `features.codex_hooks = true`
- 但部分 standalone CLI utility command 看起来不会像 interactive / app-backed project session 那样明显透出 project profile
- 所以 `.codex/config.toml` 和 `.codex/hooks.json` 应优先被理解为真实 Helm 工作流里的 repo-local project layer，而不是 one-off CLI 行为测试的唯一依据

## 9. 更新规则

出现下面这些变化时更新本文件：

- 当前 engineering queue 改变
- 最重要 blocker 改变
- 当前 validation posture 发生明显变化
- repo-local execution contract 改变

不要只为了镜像 stable product docs 而更新这份文件。

一旦某条结论已经变成 durable truth，就把它移到：

- `AGENTS.md`
- `README.md`
- `docs/README.md`
- `DESIGN.md`
- the relevant product / review / baseline doc

## 10. 短清单

开始一个 substantial task 前：

1. 读 `AGENTS.md`
2. 读 `README.md`
3. 读 `docs/README.md`
4. 如果涉及 UI，读 `DESIGN.md`
5. 如果任务依赖当前 active queue 或当前执行姿态，再读这份文件

关闭一个 substantial task 前：

1. 如果行为或工作流变了，更新 docs/indexes
2. 跑正确的 validation slice
3. 明确写出没跑什么
4. 只有当前短周期上下文真的变了，才更新这份文件
