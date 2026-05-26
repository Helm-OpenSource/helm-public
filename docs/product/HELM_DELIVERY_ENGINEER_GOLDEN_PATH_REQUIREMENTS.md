---
status: active
owner: Product / Delivery Engineering / Engineering
created: 2026-05-20
last_reviewed: 2026-05-20
review_after: 2026-06-03
closeout: ../reviews/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_CLOSEOUT.md
archive_trigger:
  - 本需求被实际 delivery engineer onboarding / pack tooling / proof-pack closeout 替代
  - Helm 放弃 delivery-engineer-facing / open-source-first 定位
  - 本需求被误扩展成 hosted platform、marketplace、production connector、auto-execution 或自动外发平面
---

# Helm Delivery Engineer Golden Path Requirements

## 0. Thesis

Helm 对交付工程师友好，不是多给一个配置面板，而是把第一条可交付路径做成可诊断、可复刻、可验收、可解释的工程主线：

```text
clone repo
  -> run local doctor
  -> start local workspace
  -> fork or select a vertical pack
  -> map source fields into synthetic / redacted fixtures
  -> run eval gates
  -> inspect /operating + review packet
  -> generate customer-safe proof pack
  -> rehearse D2 fresh-clone smoke
```

这条线必须服务一个具体人：正在客户现场或交付项目中，把 Coze / 悟空 / Dify / LangGraph / n8n / CRM / IM / 会议 / Excel 等输入，变成受控经营推进系统的 delivery engineer。

当前文件只授权 docs、只读本地诊断、offline checks 和后续工具需求；不授权 schema、API、runtime query、hosted MCP、production connector、credential usage、official write、自动外发、自动审批、自动执行、marketplace 或 LLM final ranking。

## 1. Current repo truth

1. `README.md` 与 `HELM_FOR_DELIVERY_ENGINEERS_V1.md` 已把主受众固定为交付工程师。
2. `extensions/case-management-sample/` 已是 minimum public reference，包含 manifest、4 类 synthetic fixture、case mapper、worker cookbook 和 BI report cookbook minimum slice。
3. `eval:headless-signal-interface` 已作为 Phase 1 offline gate 落地，证明 pack manifest / facade type / boundary / non-scripted sequence 的离线契约。
4. Docker / fresh-clone onboarding smoke 仍是 pending；30 分钟 onboarding 仍只能写成目标路径，不是已验证 SLA。
5. Helm 当前两条"第一个"轨道是**分开**的，不要混读：
   - **第一个真实客户（production landing）**：某 founder-led grandfathered 直连试点租户（tenant-private），2026-05-20 已进入 landing。所属域是催收 / case management；任何会影响该 tenant-private workspace 状态、信号、可见 artifact、外发渠道的 delivery-engineer 工具默认按受控试点 + Required Reviewer 边界处理，不进 Golden Path 公开样板。
   - **第一个完整行业 PACK（public reference）**：D002 美业，公开 / forkable / 行业级 reference，canonical requirements 在当前 worktree 中仍待 owner 真值；到位后 Golden Path 的 first reference pack 切向 D002，`case-management-sample` 退为 generic baseline。
6. 上述两条线互不依赖：tenant-private 客户落地不要求美业 PACK 先完成；Golden Path tooling（`delivery:doctor` / `pack:fixture-check` / 未来 `pack:create`）默认服务 public reference pack 形态；tenant-private 配置走另一条受控通道。
7. 交付工程师最现实的摩擦点仍是：本地起不来、pack 不知道怎么 fork、客户字段不知道怎么安全变 fixture、eval 失败看不懂、客户 proof pack 要手工拼。

## 2. P0 user journey

P0 不从 platform feature 开始，而从交付工程师的 30 到 60 分钟自助路径开始。

| Step | 交付工程师想完成什么 | Helm 应提供什么 | P0 posture |
|---|---|---|---|
| 1 | 判断仓库能不能跑 | `npm run delivery:doctor` | read-only static local check |
| 2 | 看懂从哪里开始 fork | Golden Path requirements + case-management-sample docs | docs + checked-in sample |
| 3 | 验证核心 offline gate | `eval:headless-signal-interface` / `eval:operating-signal-flow` | existing offline eval |
| 4 | 准备客户 fixture | `npm run pack:fixture-check` | read-only static pack check |
| 5 | 给客户看证明 | 后续 `proof-pack:generate` | planned, customer-safe only |
| 6 | 证明 30 分钟路径 | D2 fresh-clone smoke receipt | planned, manual receipt first |

## 3. Requirements

### DEGP-01：`delivery:doctor`

`delivery:doctor` 是 Golden Path 的第一块可执行能力。

它必须：

1. 只读检查本地 repo 文件，不连接网络、不启动 Docker、不连接 DB、不读取生产凭据。
2. 检查 README / delivery-engineer positioning / HSI requirements / case-management-sample / HSI eval files / package scripts 是否存在。
3. 检查 `case-management-sample` 核心样本文件不含通用 credential / cloud-host marker；tenant-private slug 仍由 `check:public-release` 负责。
4. 检查 targeted sample tests 是否存在，但不替代真正 test run。
5. 明确 D2 fresh-clone smoke receipt 是否存在；没有 receipt 时只给 warn，不让 30 分钟目标变成承诺。
6. 输出 JSON summary：`version`、`boundary`、`passed`、`counts`、`checks[]`、`nextCommands[]`。

它不得：

1. 运行 `docker compose up`。
2. 运行 Prisma migration / seed。
3. 读取 `.env` 中的 secret value。
4. 调第三方 connector、MCP server、LLM SDK 或 production API。
5. 写入文件、DB、audit log 或外部系统。

### DEGP-02：`pack:create`（planned）

后续 `pack:create` 应从 `case-management-sample` 或 owner 确认的 first vertical 生成新 pack skeleton。

P1 minimum：

0. **必须先有 checked-in `pack-create-allowlist`**（`lib/delivery-engineer/pack-create-allowlist.ts` 或同义）明确列出可作为 fork 起点的 pack 路径，初版仅含 `extensions/case-management-sample`；任何不在该 allowlist 内的路径必须被命令直接 refused，避免误从 tenant-private extension 拷贝。允许新增 source pack 的唯一方式是更新此 allowlist + 同步 review，不接受 CLI flag override。
1. 接收 `--pack-id`、`--display-name`、`--vertical-kind`、`--source-kind`。
2. 复制 public-safe sample structure，而不是复制 tenant-private extension。
3. 自动改 manifest id、display name、fixture namespace、README title。
4. 默认生成 synthetic fixture placeholders。
5. 生成 next command list：fixture check、HSI eval、public release guard。

No-Go：

1. 不生成 schema migration。
2. 不生成 production connector credentials。
3. 不把 customer raw data 写入 repo。
4. 不接受 allowlist 之外的 source pack；不通过 CLI flag 旁路 allowlist；不依靠 reviewer 临时口头授权代替 allowlist 更新。

### DEGP-03：`pack:fixture-check`

`pack:fixture-check` 负责让交付工程师在客户数据进入 Helm 之前先过本地安全闸。当前已落地 Phase 1 read-only static check，默认检查 `extensions/case-management-sample`，也支持 `--pack <path>` 指向 repo 内其他 fork pack。

当前 Phase 1 minimum：

1. pack path 必须留在当前 repo 内，防止误读本机其他目录。
2. 检查 `README.md`、`tenant.manifest.json`、`hsi-pack.manifest.json` 是否存在。
3. 解析 tenant manifest 与 HSI pack manifest，并调用 `validateHsiPackManifest`。
4. 检查 non-Salesforce source coverage、六类 signal family、`/operating` + review packet surface、tenantKey / packId 对齐、implementation checklist ref 存在。
5. 扫描 `fixtures/*.json`，要求 JSON 可解析；数组型 fixture 不得为空。
6. 扫描通用 credential / cloud-host marker；tenant-private slug 仍交给 `check:public-release`。
7. 输出 JSON summary：`version`、`boundary`、`packPath`、`passed`、`counts`、`checks[]`、`nextCommands[]`。

仍未做：

1. JSON / CSV / transcript text 任意输入 intake。
2. PII / phone / email 细粒度 redaction report。
3. field mapping coverage：required / optional / unmapped / unsafe。
4. redaction manifest draft。
5. 任何 raw customer data 持久化。

### DEGP-04：`proof-pack:generate`（planned）

后续 proof pack generator 负责把交付结果打包成客户可审查材料，而不是平台营销材料。

P2 minimum：

1. 收集 eval receipt、doctor summary、Signal Flow posture、review packet example、boundary ledger、data posture note、rollback note。
2. 默认 customer-safe，不包含 raw payload、secret、PII、prompt replay 或 third-party credential。
3. 输出本地 markdown / JSON artifact。
4. 明确 claim level：`demo_evidence`、`offline_contract_passed`、`fresh_clone_smoke_passed`、`runtime_not_authorized`。

### DEGP-05：D2 fresh-clone smoke receipt

D2 smoke 是把 30 分钟 onboarding 从目标变成可引用事实的唯一入口。

Minimum receipt：

1. OS / runtime / Node / Docker context。
2. Clone source、commit hash、env posture。
3. 实际命令与耗时。
4. `/operating`、`/approvals`、`/memory` 可见性。
5. `delivery:doctor`、HSI eval、Signal Flow eval、public-release guard 结果。
6. 失败项和降级声明。

## 4. Acceptance metrics

| Metric | P0 / P1 target |
|---|---|
| `delivery:doctor` fail count | 0 in current repo |
| `delivery:doctor` side effects | 0 network / DB / Docker / external write |
| `pack:fixture-check` fail count | 0 for `extensions/case-management-sample` |
| `pack:fixture-check` side effects | 0 network / DB / Docker / external write |
| Required Golden Path files | present |
| Required package scripts | present |
| case-management-sample generic unsafe marker hits | 0 |
| D2 smoke receipt | warn until real clean-checkout run exists |
| Runtime / production connector authorization | 0 |
| Official write / auto-send / auto-approve | 0 |

## 5. Phased plan

| Phase | Goal | Allowed | Not allowed | DoD |
|---|---|---|---|---|
| Phase 0 | Requirements + first doctor | docs, read-only static doctor, unit test, package script | Docker run, DB, connector, hosted MCP | `npm run delivery:doctor` returns JSON with 0 fail in repo |
| Phase 1 | Pack fixture static gate | `pack:fixture-check`, manifest / fixture / boundary posture checks | schema migration, production connector, raw data persistence | sample pack fixture check returns JSON with 0 fail |
| Phase 1.5 | Pack skeleton creation | `pack:create` local file generation, synthetic placeholders | schema migration, production connector | generated pack passes fixture and HSI eval |
| Phase 2 | Fixture safety loop | richer local fixture check, redaction manifest draft | raw customer data persistence by default | unsafe samples fail before eval |
| Phase 3 | Proof pack | local customer-safe artifact generation | public claim auto-publish, external send | proof pack contains eval receipt and boundary ledger |
| Phase 4 | D2 smoke | clean checkout rehearsal and receipt | treating targets as SLA before receipt | 30 / 60 minute claims are proven or downgraded |

## 6. Deliberately not doing

1. 不做 hosted marketplace。
2. 不做 production connector adoption。
3. 不做 hosted MCP server。
4. 不做 schema migration。
5. 不做 Pack DSL 平台。
6. 不做自动外发、自动审批、自动执行。
7. 不把 `delivery:doctor` 或 `pack:fixture-check` 当成真实 Docker / DB smoke。
8. 不把 proof pack 生成当成客户承诺或 SLA。

## 7. Sources

- `README.md`：delivery-engineer positioning、30 分钟 onboarding、open-core / forkable 差异。
- `docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md`：1-pager 与 onboarding anchor。
- `docs/product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md`：HSI pack contract、facade boundary、D2 smoke boundary。
- `docs/reviews/HELM_HEADLESS_SIGNAL_INTERFACE_CLAUDE_REVIEW.md`：Claude / owner review 与 HSI Phase 1 offline closeout。
- `docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md`：case-management-sample D2 smoke / full integration pending truth。
- `extensions/case-management-sample/README.md`：minimum public reference truth。

## 8. Change log

| 日期 | 变化 |
|---|---|
| 2026-05-20 | Phase 1：新增 `pack:fixture-check` 只读静态 pack 检查，覆盖 HSI manifest、tenant alignment、fixture JSON、安全 marker 和 review surface 姿态 |
| 2026-05-20 | 首版：把交付工程师友好能力收敛成 Golden Path，定义 `delivery:doctor`、`pack:create`、`pack:fixture-check`、`proof-pack:generate` 与 D2 smoke receipt 的分阶段边界 |
| 2026-05-20 | DEGP-02 收紧：明确 `pack:create` P1 minimum 第 0 项必须先有 checked-in `pack-create-allowlist`，且 CLI flag 不得绕过；扩展 No-Go 第 4 项防止口头授权代替 allowlist 更新 |
| 2026-05-20 | §1 显式拆分两条"第一个"轨道：**第一个真实客户** = founder-led grandfathered tenant-private 直连试点（已 landing，production-affecting 边界激活）；**第一个完整行业 PACK** = D002 美业（public reference、待 owner 真值）；两条线互不依赖；Golden Path tooling 默认服务 public reference pack 形态 |
