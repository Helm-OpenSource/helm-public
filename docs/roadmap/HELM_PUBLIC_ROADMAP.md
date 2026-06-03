---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
public_safety: Public Core roadmap. This is gate-relative planning, not a release-date commitment.
---
# Helm Public Roadmap / Helm 公开路线图

> **语言 / Language**: **中文主文本** + **English reference**

## 中文主文本 / Chinese Main Text

本文描述 Helm 公开 Core 面向 AI 交付工程师的相对门禁路线图。它不是
商业发布批准、生产服务等级承诺、客户部署承诺或仓库可见性批准。

Helm 公开 Core 的北极星是：帮助 AI 交付工程师把客户业务实施里的判断、
证据、复核、边界和交付包工作转成可复刻的工程结构。

路线图原则：建议不是承诺；复核包不是批准、发送、写回、结算或执行；
public Core 必须保持 Apache-2.0、可独立构建且公开安全；Core 不能依赖 Pack 或
Overlay 代码；公开文案使用证据门禁与“现在 / 下一步 / 以后”，不使用发布日期承诺。

“现在”是 public Core 基线与当前工作面；“下一步”是相对门禁推进的 public-Core 改进；
“以后”必须经过独立门禁、仓库路由和负责人批准。Helm Cloud / Helm Enterprise 已就绪、
行业 Pack 加固、客户 Overlay 交付、control-plane 元数据和额外连接器就绪，
都不能被 public Core 路线图自动承诺。

## English Reference

This roadmap describes the public Core path for delivery engineers. It is not a
commercial release approval, production SLA, customer deployment commitment, or
repository visibility approval.

Helm's public Core north star is:

> Help AI delivery engineers turn the judgement, evidence, review, boundary, and
> delivery package work inside customer business implementation into a forkable
> engineering structure.

## Roadmap Principles

1. Recommendation is not commitment.
2. Review packet is not approval, send, write-back, settlement, or execution.
3. Public Core must stay Apache-2.0, independently buildable, and public-safe.
4. Core must not depend on Pack or Overlay code.
5. Public wording uses evidence gates and Now / Next / Later, not launch-date
   promises.

## Now

These items are in the public Core baseline or are the current public-Core
working surface:

- Apache-2.0 Core repository posture: `LICENSE`, `NOTICE`, `package.json`, and
  curated public docs.
- Docker quickstart: `Dockerfile`, `docker-compose.yml`, and fresh-clone review
  receipts under `docs/reviews/`.
- Mainland China / restricted-network local developer path: optional
  `.npmrc.example`, Docker `NPM_REGISTRY` build arg, and docs that keep mirror
  credentials local rather than committed.
- Delivery engineer Golden Path requirements:
  [HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md](../product/HELM_DELIVERY_ENGINEER_GOLDEN_PATH_REQUIREMENTS.md).
- Headless Signal Interface requirements:
  [HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md](../product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md).
- Public sample pack: `extensions/case-management-sample/`, labeled as a
  synthetic public sample pack with provenance under review until the synthetic
  evidence gate is signed off.
- Local checks:

```bash
npm run delivery:doctor
npm run pack:fixture-check
npm run eval:headless-signal-interface
npm run eval:operating-signal-flow
npm run check:public-release
```

Repository visibility is public after public-release checks, history-level
checks, and owner Go/No-Go completed. Future release, tag, announcement, and
visibility changes remain owner-gated.

## Next

These are the next gate-relative public-Core improvements. They are not date
commitments.

- Finish R1/R2 cleanup from the Golden Path requirements: remove frozen legacy
  repository links, placeholder contact values, date-style launch promises, and
  customer-delivery time promises from public entry points.
- Make README's first path the delivery-engineer Golden Path, including a
  concrete "change this line -> run this command -> observe this change"
  walkthrough.
- Complete the synthetic provenance gate for `case-management-sample`, or keep
  the public label at "provenance under review".
- Add fork-and-rename guidance, a standalone "what Helm does not do" page, and a
  forker upgrade story.
- Turn the current "not a production image" Docker boundary into a separate
  production deployment runbook / image decision packet before any customer
  deployment wording is allowed.
- Keep public docs curated through `docs/public-docs-manifest.json` and
  `npm run check:public-docs`.
- Coordinate a read-only split doctor in `helm-control-plane`; do not add
  Pack, Overlay, or control-plane metadata to `helm-public`.

## Later

These directions require separate gates, repository routing, and owner approval:

- Helm Cloud or Enterprise delivery readiness.
- Industry Pack hardening in `helm-packs`.
- Customer Overlay delivery in `helm-overlays`.
- BOM, authorization, deployment registry, health heartbeat, and usage metadata
  in `helm-control-plane`.
- Additional connector readiness after read-first / review-first evidence exists.

## Out Of Scope

The following are not public Core roadmap items:

- Complete workflow, orchestration, or agent platform.
- Runtime marketplace, app store, plugin sandbox, or hosted MCP runtime.
- Complete BI platform.
- Automatic approval, external send, settlement, execution, CRM write-back, or
  customer commitment.
- LLM final ranking on commitment paths.
- Real customer data, private deployment details, credentials, customer tenant
  slugs, private domains, or internal IPs in public paths.
- Core dependencies on Pack or Overlay code.

## Contribution Direction

Good public Core contributions:

- Bug fixes and tests.
- Documentation corrections.
- Public sample pack fixture and mapper improvements that stay synthetic and
  review-first.
- Read-only connector fixtures or dry-run examples.
- Accessibility and local developer experience improvements.

Discuss first:

- Schema changes.
- New runtime surfaces.
- Any write, send, approval, execution, settlement, or external commitment path.
- Anything that might belong in `helm-packs`, `helm-overlays`, or
  `helm-control-plane`.

See [CONTRIBUTING.md](../../CONTRIBUTING.md) and
[AGENTS.md](../../AGENTS.md) before opening a PR.
