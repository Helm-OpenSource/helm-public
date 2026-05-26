---
status: active
owner: helm-core / security
created: 2026-05-01
review_after: 2026-05-15
archive_trigger:
  - 公共试用（public trial）结束且无 P0 boundary incident，并完成一次外部安全复核留痕
  - 本清单被更正式的 security RFC + guard coverage registry 替代且已接入 `npm run check:boundaries`
  - OWASP/AWS/NIST 等清单出现重大结构变化并完成一次映射重做（含变更记录与回归验证）
---

# Helm Agentic Security — Guard Coverage Map (non-legal)

> 非法律意见。本文件的目标是把“面向 agentic / tool-use 系统的常见风险清单”映射到 Helm **已存在**的 guardrails，并给出可复核证据入口（脚本 / 测试 / 文档）。
>
> 本文件不引入新的 control plane；不改变 Helm 的 controlled-trial / review-first / judgement-first / decision-first / no auto-send / no broad auto-write 边界。

## 1. 结论（今日可执行）

- Helm 已具备一组“可回归的发布与边界守卫”（public release guard / boundary check / regression tests / secret history）。
- 当前最重要的治理策略仍是：**先把风险显式化、把失败分级、把人工确认与审计链做实**，而不是把系统升级成 orchestration 平台。

## 2. Scope 与硬边界（不允许漂移）

- review-first：所有客户可见动作必须经人工复核与审计留痕。
- no auto-send：任何对外发送都必须显式点击确认。
- no broad auto-write：任何“官方写回”必须显式 intent、可审计、可拒绝、可回放。
- no hidden production adoption：planning/offline 产物不得悄悄接入 runtime。

## 3. 风险类别 → Helm 控制项映射（证据驱动）

> 参考框架（不展开引文）：OWASP LLM Top 10、OWASP Agentic Skills Top 10、AWS Agentic AI 安全建议、NIST AI RMF 等。

### 3.1 Prompt injection / 指令污染（含 tool 诱导）

- **主要风险**：把“输入文本/外部内容”当作指令，诱导越权调用、越界写入或对外承诺。
- **Helm 控制项**：
  - recommendation ≠ commitment / 发送前复核（产品硬边界与 presentation contract 回归）。
  - runtime adoption posture 明示 No-Go/Review-only（Phase 3 guardrails）。
- **证据入口**：
  - `npm run check:boundaries`
  - `npm run quality:regression`

### 3.2 Excessive agency / 过度代理权（自动执行、自动承诺、自动外发）

- **主要风险**：在无明确授权下提升系统执行权，或让“解释”变成“承诺”。
- **Helm 控制项**：
  - approvals / review-first surfaces（对外动作必须人工确认）。
  - capability-governed API routes（按 membership role 施加治理门）。
- **证据入口**：
  - `npm run check:boundaries`
  - `npm run test -- lib/memory/write-governance-routes.test.ts lib/auth/insight-governance-routes.test.ts`

### 3.3 Insecure output handling / 不安全输出处理（隐式写入、隐式成功）

- **主要风险**：工具链/接口返回异常但被当作成功；缺字段/错字段/格式漂移导致静默错误写入。
- **Helm 控制项**：
  - inbound payload schema validation（zod safeParse + 明确 400/403/404/500）。
  - 失败分级：hard-fail / review-only / drop-with-audit（不得静默成功）。
- **证据入口**：
  - `npm run test -- lib/memory/write-governance-routes.test.ts lib/auth/insight-governance-routes.test.ts`

### 3.4 Data leakage / 敏感数据泄露（含历史、日志、public mirror）

- **主要风险**：secret 出现在工作区文件、git 历史、public mirror、日志或调试输出。
- **Helm 控制项**：
  - public release guard（静态扫描 public mirror blocker）
  - secret history reachability check（compromised commit 视为 P0）
- **证据入口**：
  - `npm run check:public-release`
  - `npm run check:secret-history`

### 3.5 Supply chain / 依赖与协议升级漂移

- **主要风险**：协议/依赖升级导致隐式行为变化；工具接入不带版本钉住与回归策略。
- **Helm 控制项**：
  - boundary checks + regression tests 把“可观察行为与表述”钉死。
  - connector/tool 的 write intent 必须显式且可审计（不做静默写回）。
- **证据入口**：
  - `npm run check:boundaries`
  - `npm run quality:regression`

## 4. 今日建议的 bounded TODO（不扩 scope）

- 把“隐式故障负样本夹具”覆盖到关键写路径与适配器入口：缺字段、错字段、超时、半成功、分页漂移。
- 将“连续人工确认 → 有界授权先项”的机制收敛成可审计契约：同类确认结果连续超过 5 次（N > 5）一致时才允许进入授权候选；候选必须记录 scope、过期、撤销、回放，并明确禁止覆盖对外发送/承诺/官方写回。

## 5. 标准验证命令（最小集）

```bash
npm run check:public-release
npm run check:secret-history
npm run check:boundaries
npm run quality:regression
npm run test -- lib/memory/write-governance-routes.test.ts lib/auth/insight-governance-routes.test.ts
```

## 6. 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-05-01 | 建立 agentic security guard coverage map 与证据入口 |
