---
status: active
owner: Product / Delivery Engineering / Engineering
created: 2026-05-20
source_requirement: ../product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md
review_after: 2026-11-16
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-26
---

# Helm Delivery Engineer Pack Fixture Check Closeout

## 1. 结论

`pack:fixture-check` 已作为 Golden Path Phase 1 的最小可执行 gate 落地。

它解决的问题是：交付工程师 fork 或调整一个 pack 后，能在进入 HSI eval、public release guard 或客户 demo 前，先用一个只读命令确认 manifest、tenant 对齐、fixture JSON 和基本安全姿态没有明显漂移。

当前状态：**Go to Phase 1.5 pack skeleton creation**。不得把本 gate 写成 runtime loader、production connector approval、raw customer data intake、redaction engine 或 Docker smoke。

## 2. Landed scope

| Artifact | 作用 | Boundary |
|---|---|---|
| `lib/delivery-engineer/pack-fixture-check.ts` | Pack fixture 静态检查纯函数 | read-only, repo-local path only |
| `scripts/pack-fixture-check.ts` | CLI wrapper，支持 `--pack` | no side effect |
| `npm run pack:fixture-check` | 默认检查 `extensions/case-management-sample` | local check only |
| `lib/delivery-engineer/pack-fixture-check.test.ts` | regression test：valid pack、missing family、unsafe marker、path escape | offline Vitest |

## 3. Checks

1. pack path 必须留在 repo root 内。
2. `README.md`、`tenant.manifest.json`、`hsi-pack.manifest.json` 必须存在。
3. HSI manifest 必须能解析并通过 `validateHsiPackManifest`。
4. source kind 必须至少包含一个 non-Salesforce source。
5. signal family 必须覆盖 HSI 六类。
6. review surface 必须**至少**覆盖 `operating_signal_flow_map` 与 `review_packet`（其余 review surface 可选）。check id 为 `hsi-manifest:minimum-review-surfaces`。
7. `tenant.manifest.json.tenantKey` 必须匹配 `hsi-pack.manifest.json.packId`。
8. `implementationChecklistRef` 必须指向存在的 repo 文件。
9. `fixtures/*.json` 必须存在、可解析；数组型 fixture 不能为空。
10. fixture JSON 不得包含通用 credential / cloud-host marker；check id 为 `fixtures:credential-and-cloud-host-marker-scan`，与 `delivery:doctor` 共用 `lib/delivery-engineer/sensitive-markers.ts`，覆盖 AWS / Azure / Tencent / Aliyun / Slack / GitHub / JWT / Bearer / OpenAI 10 类。
11. fixture 目录遍历跳过 symbolic link，防止 fork 后用 symlink 把扫描拖出 pack。

## 4. Validation

本轮已执行：

| Command | Result |
|---|---|
| `npm run pack:fixture-check` | PASS：15 pass / 0 warn / 0 fail |
| `npx vitest run lib/delivery-engineer/pack-fixture-check.test.ts lib/delivery-engineer/golden-path-doctor.test.ts lib/headless-signal-interface/pack-manifest.test.ts` | PASS：3 files / 22 tests |
| `npm run build` | PASS |
| `npm run quality:regression` | PASS：32 files / 127 tests |

完整仓库验证结果见 `HELM_DELIVERY_ENGINEER_GOLDEN_PATH_CLOSEOUT.md`。

## 5. Still not doing

1. 不运行 Docker、DB、Prisma、Next app 或 browser smoke。
2. 不读取 `.env` secret。
3. 不调用 connector、MCP、LLM SDK 或 production API。
4. 不接受任意 raw customer input。
5. 不生成 redaction manifest。
6. 不写入 fixture、report、audit log、DB 或外部系统。
7. 不替代 `eval:headless-signal-interface`、`check:public-release` 或 D2 fresh-clone smoke。

## 6. Remaining risks

1. 它只检查 checked-in fixture JSON，不判断真实客户字段 mapping 是否充分。
2. PII / phone / email 的细粒度 redaction report 仍未实现。
3. `pack:create` 尚未实现，交付工程师仍需手工 fork sample pack。
4. D2 fresh-clone smoke 仍未跑通，30 / 60 分钟 onboarding 仍是目标。

## 7. Change log

| 日期 | 变化 |
|---|---|
| 2026-05-20 | 首版：记录 `pack:fixture-check` Phase 1 read-only static pack gate |
| 2026-05-20 | 第二轮 tightening：marker scan 改 id 为 `fixtures:credential-and-cloud-host-marker-scan` 并扩展到 10 类；review surface 检查改 id 为 `hsi-manifest:minimum-review-surfaces` + title `minimum review surface coverage`；目录遍历跳过 symlink；与 doctor 共享 `lib/delivery-engineer/sensitive-markers.ts`；新增 5 个回归测试覆盖扩展 marker / minimum review surface |
