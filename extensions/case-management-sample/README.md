---
status: minimum-public-reference
owner: helm-core
created: 2026-05-18
target_release: gate-relative public Core release
public_safety: Intended for the public mirror. No tenant-private references.
---

# Case Management Sample

> Helm 的公开 sample pack 参考实现：把通用案件管理工作流（分案 / 跟进 / 复核 / 闭环）做成可 fork 的工程结构。
>
> A public sample pack reference: case management / customer support / business operations as a forkable, opinionated end-to-end loop.

---

## 这是什么 / What this is

公开 Apache-2.0 sample pack 参考实现，给基于 AI 平台（Coze / 阿里悟空 / Dify / LangGraph）做企业 AI 经营推进系统的**交付工程师**当起点。

A public Apache-2.0 sample pack reference implementation, intended as a starting point for **delivery engineers** building enterprise AI operations systems on top of AI platforms (Coze / Alibaba Wukong / Dify / LangGraph).

定位见 / Positioning: [`docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md`](../../docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md)

抽取 spec / Extraction spec: [`docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md`](../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)

---

## 当前状态 / Current status

**Minimum public reference** — 这是 synthetic public sample pack（provenance under review），不是 production-ready vertical，但已经消除了公开 README / 1-pager 的 dead-link 风险：

- 已有 `tenant.manifest.json` + signals / workers / bi-report manifests
- 已有 `signals/types.ts`，固定 deterministic signal identity、tenant pinning、suggestion-only 边界
- 已有 4 类 public sample fixtures：case / day-board / employee / qc-issue；在 owner 完成 synthetic provenance gate 前，公开口径为 synthetic public sample pack, provenance under review
- 已有一个可运行 case mapper + Vitest，用于展示"从业务记录到 review-first signal"的最小路径
- 已有 worker cookbook：case allocation / case stewardship 两个纯函数 driver + Vitest
- 已有 BI report cookbook：daily activity readout 的 query / schema / metrics / criteria / prompt / template / resource

本目录可以作为 Golden Path 的可读 / 可改起点；不能被描述为 production-ready 模板、客户部署包或已认证 Pack。

---

## 目录结构 / Directory layout

```
extensions/case-management-sample/
├── tenant.manifest.json
├── README.md
├── fixtures/
│   ├── case.sample.json
│   ├── day-board.sample.json
│   ├── employee.sample.json
│   └── qc-issue.sample.json
├── signals/
│   ├── extension.manifest.json
│   ├── README.md
│   ├── types.ts
│   ├── types.test.ts
│   └── case/
│       ├── case-mapper.ts
│       └── case-mapper.test.ts
├── workers/
│   ├── extension.manifest.json
│   ├── README.md
│   ├── worker-modes.ts
│   ├── lifecycle-objectives.ts
│   ├── case-allocation-driver/
│   └── case-stewardship-driver/
└── bi-report/
    ├── extension.manifest.json
    ├── manifest.test.ts
    ├── README.md
    ├── report-skills/daily-activity-readout/
    └── resources/case-management-sample.daily.resource.yaml
```

后续 spec 扩展项：

- additional boundary / route tests
- optional signal mappers for day-board / employee / qc-issue

---

## Minimal Start Here

1. 打开 `fixtures/case.sample.json`。
2. 改一条 synthetic sample case 的非敏感字段，例如 `status`、`severity` 或 `blockers`。
3. 跑：

```bash
npm run pack:fixture-check
npm run eval:headless-signal-interface
```

4. 检查 mapper / eval 是否仍保持 `commitment: "suggestion_only"`、literal `tenantKey` 和 forbidden-action 边界。

不要把真实客户记录、真实邮箱、真实手机号、私有域名、内网 IP、凭据或部署信息放进本目录。

---

## Sanitization 来源 / Provenance

本 vertical 从 tenant-private vertical pack（不在公开镜像）脱敏抽出。具体抽取规则见 [extraction spec §3](../../docs/_planning/CASE_MANAGEMENT_SAMPLE_EXTRACTION_SPEC_V1.md)。

This vertical is sanitized from a tenant-private vertical pack (not in the public mirror). Sanitization rules: see the extraction spec §3.

**Public safety invariants**:

- 不含 tenant-private slug（`public-release-guard` 强制） / no tenant-private slugs (enforced by guard)
- 不含真实客户名 / 员工姓名 / 真实邮箱 / 真实凭据 / no real customer names / employee names / real emails / real credentials
- fixture 口径为 synthetic public sample pack, provenance under review；只有完成 [Golden Path synthetic provenance gate](../../docs/product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md#7-synthetic-provenance-gate) 后，才能升级为 `100% synthetic`

---

## 5 步 fork 给你的客户

1. 复制本目录到你的 vertical 目录，例如 `extensions/acme-case-ops/`。
2. 改 `tenant.manifest.json` 的 `tenantKey`、`displayName`、`rootPath`。
3. 在 `signals/types.ts` 保留 `SignalIdentity` / `SignalScope` / `commitment` 边界，替换 payload domain 字段。
4. 从 `signals/case/case-mapper.ts` 开始，把你的客户业务记录映射成 `SignalCandidate<T>[]`。
5. 用 `fixtures/*.sample.json` 重写 synthetic 样本，再跑测试和 public-release guard。

```bash
npx vitest run extensions/case-management-sample/signals/types.test.ts \
  extensions/case-management-sample/signals/case/case-mapper.test.ts \
  extensions/case-management-sample/workers/case-allocation-driver/decide.test.ts \
  extensions/case-management-sample/workers/case-stewardship-driver/decide.test.ts \
  extensions/case-management-sample/bi-report/manifest.test.ts
npm run check:public-release
```

## Signal schema 改造指引

保留这些 generic 字段：

- `workspaceId`
- `tenantKey`
- `sourceWindowKey`
- `signalKey`
- `severity`
- `scope`
- `confidence`
- `trace`

替换这些 domain 字段：

- case stage
- owner / manager chain shape
- blocker vocabulary
- review packet fields
- downstream connector trace shape

不要替换这些边界：

- `tenantKey` 必须是 literal，不允许 runtime cross-tenant projection
- `sourceWindowKey` 必须 deterministic，不允许 UUID / random / ms timestamp
- `commitment` 默认 `suggestion_only`，不允许 mapper 直接升级成正式承诺

## 一个完整 fixture 演示

`fixtures/case.sample.json` 是最小演示输入。`signals/case/case-mapper.ts` 把其中一条 case record 映射成一个 review-first signal candidate：

```bash
npx vitest run extensions/case-management-sample/signals/case/case-mapper.test.ts
```

## Worker driver 适配指引

- 从 `workers/case-allocation-driver/decide.ts` fork 一个纯函数，不在 driver 里做 IO。
- 保留 `worker-modes.ts` 的 observer-first 规则；`propose_*` 在 observer mode 必须 suppressed。
- 保留 `commitment: "suggestion_only"` 和 `requiresApproval` 边界。
- 从 `workers/case-stewardship-driver/decide.ts` 复制 roster invariant：每个 active case 都要被看见。
- 新增 driver 时同步补 `manifest.ts`、README 和 Vitest。

---

## 边界 / Boundaries

- 不是 production-ready 模板（明确 sample / reference / fork-and-customize）
- 不提供自动派工 / 自动外发路径（`requiresApproval: true` 写死）
- LLM 不进入承诺路径（`OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET` 闭集 + `commitment: "suggestion_only"` 强约束；eval gate 强制）

---

## 反馈 / Feedback

GitHub Issues with label `vertical: case-management-sample`.
