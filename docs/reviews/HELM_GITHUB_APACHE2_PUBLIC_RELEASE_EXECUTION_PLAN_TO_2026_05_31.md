---
status: active
owner: 李建乐
created: 2026-05-18
review_after: 2026-05-31
archive_trigger:
  - GitHub Apache-2.0 public release is completed and a release closeout supersedes this plan
  - The 2026-05-31 release target is explicitly deferred and replaced by a new dated plan
---

# Helm GitHub Apache-2.0 Public Release Execution Plan To 2026-05-31

更新时间：2026-05-26
状态：Execution plan / critical-path countdown
目标版本：`v0.1.0-trial`
唯一目标：在 2026-05-31 前完成 Helm 的 GitHub Apache-2.0 公开发布

## 1. 计划结论

当前可以直接复用的基线已经有三块：

1. `npm run check:public-release` 当前 PASS。
2. public mirror toolchain、receipt schema、Deployment Profile、Tenant Overlay contract 已经落地。
3. open core / cloud / enterprise / tenant-private 的边界文档已经基本冻结。

当前唯一的 P0 release blocker 仍然是历史 secret remediation：

1. 云端旧 RDS 凭据必须先完成轮换或吊销。
2. 公开 Git 历史必须完成 rewrite 并受控 force-push。
3. rewrite 后必须重新生成 clean public mirror evidence。

因此本计划采用单一关键路径：

```text
secret rotation
-> history rewrite decision + maintenance window
-> public mirror candidate + clean receipt
-> public docs / governance / GitHub release surface final review
-> release rehearsal
-> final go/no-go
-> public release
```

如果 2026-05-24 结束前 secret rotation 仍未确认完成，则默认触发红色预警；如果 2026-05-27 结束前 rewritten history 与 mirror-clean receipt 仍未完成，则 2026-05-31 公开发布默认 No-Go。

## 2. 非目标

本计划不做：

1. 不推进 commercial trial runtime。
2. 不推进 enterprise / cloud 私有仓实现。
3. 不新增 marketplace、Pack SDK、billing、SSO、cloud control plane。
4. 不把 `/operating` signal flow fixture prototype 升级成真实 runtime。
5. 不做新的产品功能扩张。
6. 不把 6 月商业化试点准备动作混入 5 月 release 关键路径。

## 3. 当前已知真值

### 3.1 已成立基线

| 项目 | 当前状态 | 证据 |
| --- | --- | --- |
| Public release guard | PASS | `npm run check:public-release` |
| Public mirror build / verify / clean-receipt toolchain | 已落地 | `package.json` scripts + `scripts/build-public-mirror-*.ts` |
| Open core / cloud / enterprise / tenant-private boundary docs | 已落地 | `docs/product/HELM_OPEN_CORE_ENTERPRISE_CLOUD_ARCHITECTURE.md` |
| Deployment Profile contract | 已落地 | `lib/deployment-profile/contract.ts` |
| Tenant Overlay contract | 已落地 | `lib/tenant-overlays/contract.ts` |
| CI baseline secret-history suppression for PR | 已落地 | `.github/workflows/ci.yml` + `scripts/secret-history-check.ts` |

### 3.2 未关闭 blocker

| 项目 | 当前状态 | 说明 |
| --- | --- | --- |
| Historical secret remediation | BLOCKED | `check:secret-history` 对 push / release 仍是硬失败 |
| Real mirror-clean receipt | NOT YET ISSUED | 还缺真实 candidate、真实 receipt id、真实 evidence |
| Public release rehearsal | NOT YET RUN | 还没有完整按 release 顺序走完一次 dry-run |
| GitHub public release surface | PARTIAL | 文档、治理、标签、release notes、公开入口仍需最终人工 review |

## 4. 单负责人执行约束

当前默认只有一个负责人：李建乐。

这意味着本计划里的所有动作默认都由李建乐推动，包括：

1. 做 release 决策。
2. 跑 release guard 和 public mirror toolchain。
3. 协调 secret rotation 与 history rewrite。
4. 检查 public docs / governance / GitHub release surface。
5. 签发 final Go / No-Go。

如果某一步实际上需要他人协助，本计划中的“李建乐”应理解为：

1. 李建乐亲自执行该动作，或
2. 李建乐发起并跟踪该动作，直到拿到可验证结果。

## 5. 倒排关键路径

### Milestone A：2026-05-19 前完成 release freeze 对齐

**目标**

把 5 月 31 日公开发布的唯一目标、关键 blocker、日程和停止条件固定下来，避免继续并行掺入产品扩张任务。

**任务**

1. 李建乐确认 2026-05-31 是公开发布 target date，不与商业化试点准备混跑。
2. 李建乐确认最终公开仓的发布路径是：
   - 先修复 secret history
   - 再生成 public mirror
   - 再执行 GitHub release
3. 李建乐把本计划作为唯一执行底稿固定下来。
4. 李建乐明确 maintenance window 的预选日期，建议锁定在 2026-05-23 至 2026-05-26 之间。

**前置依赖**

无。

**验收口径**

1. 本计划文档被接受为唯一 release 倒排计划。
2. 李建乐确认自己是唯一 release owner。
3. maintenance window 有预选日期。

**风险**

1. 如果李建乐继续把 6 月商业化动作混入当前节奏，关键路径会失焦。
2. 如果 maintenance window 没有预选日期，secret-history rewrite 会继续拖延。

**失败回退**

若 2026-05-19 前无法明确 window，本次发布目标降级为 planning-only，不再对 2026-05-31 做外部承诺。

### Milestone B：2026-05-20 前完成 secret rotation 决策与执行启动

**目标**

把历史 secret remediation 从“知道要做”推进到“云端已开始处理”。

**任务**

1. 李建乐盘点旧 RDS root credential 当前是否仍可用。
2. 李建乐执行或推动凭据轮换或吊销，优先改为 least-privilege app account。
3. 李建乐更新或推动更新内部 secret store、部署环境或停用旧变量。
4. 李建乐拿到无 secret 的 rotation receipt。
5. 李建乐确认 rotation receipt 足以支持下一步 history rewrite。

**前置依赖**

1. maintenance window 预选日期存在。
2. 该动作的实际执行渠道已明确，不存在“等别人认领”的状态。

**执行清单**

- [HELM_SECRET_ROTATION_AND_RELEASE_UNBLOCK_CHECKLIST_2026_05_20.md](../operations/HELM_SECRET_ROTATION_AND_RELEASE_UNBLOCK_CHECKLIST_2026_05_20.md)

**验收口径**

1. 旧凭据“已吊销或已验证不可再用”的事实被确认。
2. rotation receipt 存在，且不写入任何 raw secret。
3. `docs/reviews/HELM_RDS_SECRET_HISTORY_REMEDIATION_PLAN.md` 可引用该 receipt。

**风险**

1. 如果旧凭据仍被生产或内部脚本依赖，轮换会被拖延。
2. 如果 receipt 不完整，后续 force-push 的风险审批无法通过。

**失败回退**

若 2026-05-20 前仍无法启动 rotation，则立即重新评估 2026-05-31 公开发布是否保留。

**2026-05-20 当前状态更新**

当前 Milestone B 还不能标记为 `completed`，但仓库内能完成的准备与验证已经补齐：

1. `npm run check:public-release`：PASS。
2. `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history`：PASS，确认当前分支没有引入新的已知 compromised commit；`87` 条 baseline-known finding 被抑制。
3. `npm run check:secret-history`：FAIL，当前 release source 仍有 `87` 条已知 compromised commit reachability finding。
4. `main` 最新代码已合入当前执行分支后，新增的内部私有文档路径公开引用已被修复，public release guard 恢复到可发布基线。

当前仍未完成、且不能在本仓库内伪造完成的事项只有 4 件：

1. 确认旧 RDS credential 当前是否仍活跃。
2. 完成云端 rotation / revocation。
3. 验证旧 credential 已不可再连接。
4. 形成真实 non-secret rotation receipt。

因此 Milestone B 当前状态应视为：

- `blocked with explicit reason: cloud-side rotation evidence not yet recorded`

明日动作维持不变：

- 先拿到云端旧 credential 状态与 rotation / revocation 证据，再决定是否进入 rewrite rehearsal。

### Milestone C：2026-05-21 至 2026-05-23 完成历史 rewrite 演练与正式窗口准备

**目标**

把 “可 dry-run rewrite” 推进到 “准备正式 rewrite”。

**任务**

1. 李建乐在 fresh mirror clone 里按既有 remediation plan 再跑一次 rewrite rehearsal。
2. 李建乐记录 rewrite 前后：
   - compromised commit 命中数
   - raw secret object hits
   - rewritten main head
3. 李建乐对 rehearsal 结果做第二次独立复核。
4. 李建乐批准正式 maintenance window。
5. 李建乐导出受影响 refs / branches inventory。
6. 李建乐通知协作者停止向 `main` 合并，并准备 rebase / recovery。

**前置依赖**

1. secret rotation 已确认完成。
2. 李建乐已决定进入 rewrite 窗口。

**验收口径**

1. rewrite rehearsal 再次证明 0 history hit 可达成。
2. maintenance window 正式锁定。
3. collaborator communication message 已准备好。

**风险**

1. 如果协作者继续向 `main` 合并，rewrite window 风险会显著放大。
2. 如果 rehearsal 和上次 dry-run 结果不一致，需要重新定位替换规则。

**失败回退**

如果 rehearsal 再次失败，暂停 release，先修复 rewrite procedure，不进入 5 月底发布。

**2026-05-22 当前状态更新**

截至今天，Milestone C 不能按“green”推进，原因不是 rewrite procedure 本身，而是 Milestone B 的硬前置仍未关闭。

今天已经补齐的 repo-side 准备项：

1. rewrite 受影响 refs inventory 已导出：
   - [HELM_PUBLIC_RELEASE_REWRITE_REF_INVENTORY_2026_05_22.md](../internal/HELM_PUBLIC_RELEASE_REWRITE_REF_INVENTORY_2026_05_22.md)
2. collaborator freeze / recovery notice template 已准备：
   - [HELM_PUBLIC_RELEASE_FREEZE_AND_HISTORY_REWRITE_NOTICE_TEMPLATE_2026_05.md](../internal/HELM_PUBLIC_RELEASE_FREEZE_AND_HISTORY_REWRITE_NOTICE_TEMPLATE_2026_05.md)
3. 当前环境再次确认：
   - `aliyun` CLI 不存在
   - Aliyun / RDS 相关环境变量不存在
4. 今日验证结果已确认：
   - `npm run check:public-release`：PASS（scanned `3824` files）
   - `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history`：PASS（`108` baseline-known findings suppressed）
   - `npm run check:secret-history`：FAIL（`108` known compromised commit reachability findings）

截至今天仍不能标记完成的事项：

1. secret rotation receipt 仍未记录入仓。
2. 旧 credential invalidation evidence 仍不存在。
3. rewrite rehearsal 不能在违背前置条件的情况下被视为正式完成。
4. formal maintenance window 不能在 rotation evidence 缺失时被视为正式批准。

因此，Milestone C 当前状态应视为：

- `blocked with explicit reason: Milestone B unresolved; cloud-side rotation evidence still missing`

截至今天的 release 级判断：

1. 2026-05-20 的 rotation 里程碑已 miss，公开发布节奏进入红色预警。
2. 如果到 2026-05-24 结束前仍无 rotation receipt，则 2026-05-31 目标默认 No-Go。
3. 当前只能继续做 rewrite prep，不能把 prep artifact 写成 rewrite execution 已启动。

### Milestone D：2026-05-24 至 2026-05-25 完成正式 rewrite 与 post-rewrite 校验

**目标**

关闭当前最大的 P0 blocker：公开 git history 中的 secret reachability。

**任务**

1. 李建乐在 maintenance window 内执行正式 mirror rewrite。
2. 李建乐执行受控 force-push。
3. 李建乐在 push 后立即运行：
   - `npm run check:secret-history`
   - `git log --all -S <redacted>`
   - object database raw secret scan
4. 李建乐对 post-rewrite 结果做第二次独立复核。
5. 李建乐向协作者发送 recovery instructions。

**前置依赖**

1. rotation receipt 已确认。
2. maintenance window 生效。
3. collaborator freeze 已通知。

**验收口径**

1. `npm run check:secret-history` 在 release source 上 PASS。
2. 已知 3 个 compromised commits 不再从公开 refs 可达。
3. post-rewrite 结果经过李建乐的二次复核后确认通过。

**风险**

1. force-push 可能影响协作者本地分支。
2. 如果 rewrite 后仍有 object hit，必须立即停止发布链。

**失败回退**

若 post-rewrite 任一检查失败，不继续 public mirror、receipt、GitHub release；优先修 history，再重新开窗口。

### Milestone E：2026-05-25 至 2026-05-27 完成 real public mirror candidate 与 clean receipt

**目标**

把当前已经可用的 toolchain 变成真实 release evidence。

**任务**

1. 李建乐选择 release source ref。
2. 李建乐执行 `public-mirror:build` 生成真实 candidate。
3. 李建乐执行 `public-mirror:verify`。
4. 李建乐执行 `public-mirror:clean-receipt` 生成真实 receipt。
5. 李建乐再次执行 `public-mirror:clean-receipt:check` 作为独立复核。
6. 李建乐运行 `release:check`，确认 receipt 被完整读取。

**前置依赖**

1. post-rewrite `check:secret-history` 已 PASS。
2. release source ref 已冻结。

**验收口径**

1. 真实 `mirror-clean:<receipt-id>` 存在。
2. release receipt evidence 可追溯到 build / verify / clean-receipt。
3. public mirror candidate 不含 tenant-private、internal、commercial-private roots / files。

**风险**

1. rewrite 后如果 docs / scripts / package projection 出现新问题，会拖慢节奏。
2. 如果 receipt command evidence 记录了本机私有路径，需要重新生成。

**失败回退**

若 mirror candidate 失败，只允许修 public-safe hygiene，不允许顺手引入功能改动。

### Milestone F：2026-05-26 至 2026-05-28 完成 public GitHub surface 最终人工审校

**目标**

确保公开仓首页、治理、贡献、法律、品牌、运行入口在对外表达上不越界。

**任务**

1. 李建乐检查 README、docs/README、GOVERNANCE、CONTRIBUTING、roadmap、public trial 文案。
2. 李建乐按 legal / brand 口径检查：
   - Apache-2.0 表述是否准确
   - trademark / brand 使用边界是否一致
   - 没有把 recommendation 写成 commitment
   - 没有把 public trial target 写成 SLA
3. 李建乐修复 public-safe wording、dead link、release note 入口问题。
4. 李建乐检查 `.env.example`、`.dockerignore`、public package manifest 是否与公开姿态一致。
5. 李建乐准备 GitHub release notes draft、tag、公开说明。

**前置依赖**

1. mirror candidate 已通过。
2. clean receipt 已存在。

**验收口径**

1. 所有 public entry docs 均通过人工审校。
2. 没有 private path、customer-specific 名称、误导性商业承诺。
3. GitHub release notes draft ready。

**风险**

1. 文案层最容易出现“看起来没问题但外部会误解”的情况。
2. 如果 release notes 抢先写入 6 月商业化承诺，会破坏 5 月目标边界。

**失败回退**

若 public wording 仍有争议，先降级表述，不等待“写得更漂亮”；边界清楚优先于营销感。

**2026-05-26 当前状态更新**

截至今天，Milestone F 里“仓库内能完成的 public surface 人工审校”已经完成，但它不能把整个 release 链从 `No-Go` 拉回 `Go`。

今天已完成的 repo-side 审校与修复：

1. 已产出人工审校记录：
   - [HELM_PUBLIC_GITHUB_SURFACE_REVIEW_2026_05_26.md](HELM_PUBLIC_GITHUB_SURFACE_REVIEW_2026_05_26.md)
2. 已修复 public-facing 文案中的 GitHub 占位符与入口问题：
   - `README.md`
   - `docs/pilot/PUBLIC_TRIAL_RUNBOOK.md`
   - `docs/launch/HELM_V0_1_0_TRIAL_LAUNCH_POST_DRAFT_V1.md`
3. 已移除 `CONTRIBUTING.md` 对 internal-only docs 的公开死链引用，改为公开边界文档。
4. 今日验证结果继续保持：
   - `npm run check:public-release`：PASS（scanned `3823` files）
   - `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history`：PASS（`108` baseline-known findings suppressed）
   - `npm run check:secret-history`：FAIL（`108` known compromised commit reachability findings）

截至今天仍不能标记完成的事项：

1. Milestone D 未完成：没有 cloud-side rotation receipt，也没有 post-rewrite PASS evidence。
2. Milestone E 未完成：没有真实 public mirror candidate，也没有真实 `mirror-clean:<receipt-id>`。
3. 因为前置条件未满足，Milestone F 的 release-level 验收口径仍不能成立。

因此，Milestone F 当前状态应视为：

- `repo-side review completed; release-level acceptance blocked by unmet Milestone D/E prerequisites`

截至今天的 release 级判断：

1. 2026-05-24 的 secret-history stop condition 已触发，公开发布当前仍处于 active No-Go。
2. 今天完成的 public docs / governance / branding 审校，只能作为 release packet 的一部分，不能替代 rewrite / receipt 证据。
3. 若不先关闭 secret rotation、history rewrite 与 real mirror-clean receipt，2026-05-31 发布目标不得恢复为 Go。

### Milestone G：2026-05-28 至 2026-05-29 完成完整 release rehearsal

**目标**

在不真正对外发布的前提下，把公开发布链完整走一遍。

**任务**

1. 李建乐跑一次完整 release checklist：
   - `npm run check:public-release`
   - `npm run check:secret-history`
   - `npm run self-check`
   - `npm run check:boundaries`
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test`
   - `npm run build`
2. 李建乐从 release source ref 再生成一次 candidate，并确认 receipt 仍一致。
3. 李建乐做 final dry-run review。
4. 李建乐参加一次 30 分钟 final Go / No-Go 预审。

**前置依赖**

1. mirror-clean receipt 已存在。
2. public docs 已人工审校完成。

**验收口径**

1. release checklist 没有新的红灯。
2. 所有 blocker 都有明确处理状态。
3. 李建乐对 2026-05-31 的发布输入有足够材料。

**风险**

1. 全量测试可能暴露与公开发布无关的旧问题，需要李建乐判断是否阻断 release。
2. 如果 `check:boundaries` 或 `self-check` 出现回归，不能靠跳过检查发布。

**失败回退**

如果 rehearsal 中出现新 blocker，优先按“是否阻断公开发布”分类；不阻断的记入 post-release backlog，不在 5 月最后两天扩 scope。

### Milestone H：2026-05-30 完成 final Go / No-Go 审批

**目标**

在正式公开发布前，做最后一次决策。

**任务**

1. 李建乐主持 final Go / No-Go review。
2. 李建乐整理 release packet：
   - secret rotation receipt
   - post-rewrite validation
   - mirror-clean receipt
   - public release guard pass evidence
   - docs / governance review result
   - release rehearsal result
3. 李建乐在决策前只回答两件事：
   - 当前能不能公开
   - 公开后最可能出什么问题
4. 李建乐作出 Go / No-Go 决策。

**前置依赖**

所有前序里程碑完成。

**验收口径**

1. 存在一份 final decision packet。
2. Go / No-Go 有明确书面结论。
3. No-Go 情况下，明确延后原因和重新开闸条件。

**风险**

1. 如果关键证据不成包，决策会变成口头感觉判断。
2. 如果李建乐仍无法确认 public safety，则必须 No-Go。

**失败回退**

No-Go 时不得带着未关闭 secret/history 问题硬发；直接把 release target 顺延到新计划。

### Milestone I：2026-05-31 执行 GitHub Apache-2.0 公开发布

**目标**

完成 GitHub 对外发布动作，并留下 release closeout。

**任务**

1. 李建乐创建 release tag 和 GitHub release。
2. 李建乐发布 public mirror / source snapshot。
3. 李建乐检查 release assets、README、license、notice、docs links。
4. 李建乐产出 release closeout 文档。
5. 李建乐对外只发布 Apache-2.0 public release，不混写 6 月商业化承诺。

**前置依赖**

1. final Go 已签发。
2. GitHub release notes 已完成。

**验收口径**

1. GitHub public release 可访问。
2. Apache-2.0 许可证、公开入口文档、release notes 一致。
3. release closeout 入库。

**风险**

1. 发布当天最容易临时加文案或资产，导致 public-safe drift。
2. 公开后外部会立即关注“这是不是 SaaS / 是不是稳定版 / 能不能商用”，需要坚持既有边界。

**失败回退**

若发布当天发现 release asset 错误，优先撤回或修 release artifact，不用口头解释替代技术修复。

## 6. 每日 / 每两日执行清单

| 日期 | 必做项 | 当日通过标准 |
| --- | --- | --- |
| 2026-05-18 | 确认本计划、锁 maintenance window 候选 | window 候选明确 |
| 2026-05-19 | 完成 release freeze 对齐、发出协作通知草稿 | freeze 范围与通知模板 ready |
| 2026-05-20 | 启动并确认 secret rotation | old credential invalidated or revoked |
| 2026-05-21 | 再跑 rewrite rehearsal、导出 refs inventory | rehearsal evidence ready |
| 2026-05-22 | 复核 rehearsal、锁正式窗口 | maintenance window approved |
| 2026-05-23 | 停 main 合并、执行正式 rewrite 准备 | rewrite start condition green |
| 2026-05-24 | 执行 rewrite + force-push + post checks | `check:secret-history` PASS |
| 2026-05-25 | 生成 real mirror candidate 与 clean receipt | `mirror-clean:<receipt-id>` created |
| 2026-05-26 | 完成 public docs / governance / branding 审校 | public surface review PASS |
| 2026-05-27 | 修正审校发现，锁定 release source ref | release ref frozen |
| 2026-05-28 | 跑完整 release rehearsal | release checklist no new blocker |
| 2026-05-29 | 预审 final Go / No-Go packet | packet complete |
| 2026-05-30 | 正式 final Go / No-Go | signed Go or explicit No-Go |
| 2026-05-31 | GitHub public release + closeout | release published |

## 7. 强制停止条件

出现以下任一情况，默认停止 2026-05-31 发布：

1. 2026-05-24 后 secret rotation 仍未确认。
2. 2026-05-24 后 `check:secret-history` 仍 FAIL。
3. 2026-05-27 后还没有真实 `mirror-clean:<receipt-id>`。
4. public docs / governance / README 仍存在 private path、customer name、误导性商业承诺。
5. 李建乐无法在 2026-05-30 前签发 final Go。

## 8. 验收命令清单

公开发布前至少要有以下命令结果或等价证据：

```bash
npm run check:public-release
npm run check:secret-history
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run public-mirror:build -- --mirror-root <candidate>
npm run public-mirror:verify -- --mirror-root <candidate>
npm run public-mirror:clean-receipt -- --receipt-id <id> --source-ref <ref> --mirror-root <candidate>
npm run public-mirror:clean-receipt:check -- --receipt mirror-clean:<id>
npm run release:check
```

如果某条命令因环境限制不能跑，必须补：

1. 未运行原因。
2. 替代证据。
3. 剩余风险。
4. 谁接受该风险。

## 9. 输出物清单

2026-05-31 发布前必须至少具备：

1. secret rotation receipt
2. post-rewrite validation evidence
3. real mirror-clean receipt
4. public release rehearsal record
5. final Go / No-Go decision packet
6. GitHub release notes draft
7. release closeout

## 10. 6 月目标（不进入 5 月关键路径）

以下事项只作为 6 月目标记录：

1. 公开发布后商业化试点承接动作
2. design partner / public trial intake 运营动作
3. enterprise / cloud 私有仓进一步拆分
4. Tenant Overlay runtime loader 下一层
5. `/operating` signal flow runtime readiness 后续工作

## 11. 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-05-18 | 首版：按 2026-05-31 GitHub Apache-2.0 public release 倒排关键路径，明确 secret remediation 是唯一 P0 blocker，并把 6 月商业化承接动作降级为后续目标 |
