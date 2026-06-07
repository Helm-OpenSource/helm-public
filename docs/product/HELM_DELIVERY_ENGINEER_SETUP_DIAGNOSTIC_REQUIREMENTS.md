---
status: draft
owner: Product / Delivery Engineering / Engineering
created: 2026-06-07
review_after: 2026-06-21
public_safety: Public Core setup diagnostic requirements only. No customer data, credentials, generated proof-package reads, connector runtime, hosted ingest endpoint, writeback, external send, approval execution, official memory promotion, or deployment proof.
---

# Helm Delivery Engineer Setup Diagnostic Requirements / Helm 交付工程师初始化诊断要求

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本要求把交付工程师第一次 fork、初始化和数据来源诊断收敛成一个 **read-only
setup diagnostic**，而不是新的控制台、执行面或接入运行时。

第一版只回答四个问题：

1. 当前 public Core 文件、脚本和文档是否齐备？
2. 数据接入是否仍按 source intake 进入：L0 诊断材料、L1 fixture / dry-run、
   L2 只读接入？
3. 下一步应该跑哪条本地命令？
4. 哪些动作仍然明确禁止：writeback、external send、approval execution、
   official memory promotion、customer deployment proof？

这份要求是 [Delivery Engineer Golden Path requirements](HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md)
和 [Data Intake Experience](HELM_DATA_INTAKE_EXPERIENCE.md) 的下一层，不替代它们。

## 1. 范围

### Always

- 扩展现有 `npm run delivery:doctor`。
- 保持 doctor 边界为 `read_only_local_repo_static_check`。
- 只检查仓库内 allowlist 文件和 `package.json` scripts。
- 在 `/setup` 展示 L0 / L1 / L2 当前选择分布和下一步命令。
- 把下一步命令作为 guidance text 展示，不做按钮执行。
- 同步 `docs/public-docs-manifest.json`、`docs/README.md` 和 doctor `REQUIRED_FILES`。

### Never

- 不新增 `.helm/setup.contract.json` 或新的根目录契约格式。
- 不读取 `/tmp/helm-sfm-first-change-proof` 或任何 generated proof package
  输出目录。
- 不上传客户材料，不扫描任意本地路径，不读取真实客户文件。
- 不新增 DB schema、connector runtime、hosted ingest endpoint、OAuth rollout、
  writeback、external send、approval execution 或 official memory promotion。
- 不声明生产 connector readiness、客户授权、客户部署批准或商业交付 ready。
- 不触碰 `helm-packs`、`helm-overlays`、`helm-control-plane` 或 `helm2026`。

## 2. Doctor 要求

`npm run delivery:doctor` 必须新增 source-intake 静态检查，但不重造输出 schema。
它继续使用现有：

- `DeliveryDoctorCheck.nextAction`
- `DeliveryDoctorSummary.nextCommands`
- `boundary: "read_only_local_repo_static_check"`

新增检查应覆盖：

| 检查 | 通过条件 | 失败时 nextAction |
|---|---|---|
| setup diagnostic doc | 本文存在，并包含 source intake、L0 / L1 / L2、read-only 和 forbidden-action markers | 恢复本文后再声明 setup diagnostic readiness |
| proof package static assets | `templates/signal-first-mile/run-first-change-proof.js`、`selector-input.sample.json`、`signal-quality-eval.js` 存在，且 generator 包含 `MANIFEST.json`、`customer-materials.md`、`signal-quality-report.md`、`hsi-fixture.json`、`review-packet.md` markers | 恢复仓内 Signal First Mile 静态资产 |
| L0 / L1 / L2 contract | `HELM_DATA_INTAKE_EXPERIENCE.md` 和 `features/settings/data-intake-ux.ts` 仍暴露 L0 / L1 / L2 | 恢复 L0 诊断、L1 fixture / dry-run、L2 只读接入口径 |
| forbidden-action boundary | 文档和 UX 仍说明 writeback、external send、approval、deployment 边界 | 恢复禁止动作文案 |

Doctor 可以输出以下 next command：

```bash
node templates/signal-first-mile/run-first-change-proof.js templates/signal-first-mile/selector-input.sample.json /tmp/helm-sfm-first-change-proof
npm run eval:signal-first-mile-quality
npm run eval:headless-signal-interface
```

这只是交付工程师本地指导。Doctor 不运行这些命令，也不读取它们的输出。

## 3. `/setup` 要求

`/setup` 的数据来源诊断步骤必须继续保持 guidance-only：

- 显示当前选择在 L0 / L1 / L2 中的分布。
- 显示 recommended next command。
- 命令块必须是文本，不是执行按钮。
- 文案必须说明 setup 保存的是 source-intake guidance，不是 connector 授权、
  生产采集、写回、外发、审批执行或客户部署。

## 4. Proof Package 边界

Proof package viewer 和 doctor 第一版都只处理 **仓内静态契约**：

- 允许：展示应该生成哪些文件、怎样生成、下一条 eval 命令。
- 禁止：stat `/tmp` 输出、读取 generated files、上传文件、创建 hosted endpoint、
  调用 connector、判断客户材料是否齐备。

缺失 proof package 只能表达为“setup state / 待生成”，不能表达为 connector failure、
deployment blocker 或 production readiness gap。

## 5. 验收

Focused validation:

```bash
npm run test -- lib/delivery-engineer/golden-path-doctor.test.ts features/settings/setup-user-orientation-contract.test.ts features/settings/data-intake-settings-surface-contract.test.ts
```

Public Core validation:

```bash
npm run delivery:doctor
npm run check:public-docs
npm run check:public-release
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
```

若只改本文档、doctor 静态检查和 setup guidance，不得宣称生产 connector readiness。

## English Reference

This requirement defines a read-only setup diagnostic for delivery engineers. It
extends the existing Golden Path doctor and setup source-intake guidance. It is
not a new control plane, execution surface, connector runtime, or deployment
proof.

The first slice covers static repo checks, the L0/L1/L2 source-intake ladder,
next-command guidance, and explicit forbidden-action boundaries only. The doctor
must not inspect generated proof-package output or arbitrary local paths.

## 变更记录

| 日期 | 变化 |
|---|---|
| 2026-06-07 | 初版：定义交付工程师初始化诊断的 read-only doctor、`/setup` guidance、proof package copy-only 边界和验证命令。 |
