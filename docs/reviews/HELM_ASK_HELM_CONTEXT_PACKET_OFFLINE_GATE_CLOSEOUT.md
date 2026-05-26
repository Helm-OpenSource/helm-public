---
status: archived
owner: helm-core
created: 2026-05-03
review_after: 2026-10-30
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Ask Helm Context Packet Offline Gate Closeout

## 1. 结论

本轮把 Ask Helm 的全局 context audit 第一刀收口为 **offline-only Context Packet gate**。

它解决的问题是：在引入 Ask Helm LLM prompt、记忆注入策略或多轮交互前，先让每次回答所需的上下文变得可见、可检验、可复跑。

本轮不改变 `/search?mode=ask` 运行时行为，不调用 LLM，不接 DB / API / UI，不保存 raw prompt，不写 MemoryCandidate / canonical fact，不启用多轮持久化。

## 2. 已落地能力

1. `AskHelmContextPacket` 契约：记录 workspace scope、输入摘要、intent、retrieval plan、included / excluded context、memory injection policy、boundary contract、prompt contract、redacted replay posture 与 authority flags。
2. 记忆注入策略：只允许 reviewed + active + object-relevant + fresh + non-contradictory memory summary token 进入 included context。
3. 负例审计：raw prompt、secret-like string、cross-workspace leakage、official write、auto execution、未复核 / 撤销 / 归档 memory 注入、缺 evidence、缺 redaction posture、过宽 context 均会触发 failure。
4. Fixture-backed eval：`evals/ask-helm/context-packet-cases.json` 覆盖 good plan、高风险执行降级、cross-workspace deny、open-domain deny、memory exclusion、raw leak、over-broad context 和 authority leak。
5. 聚合验证入口：`npm run eval:ask-helm-context-packet`，并接入 `npm run eval:ask-helm`。

## 3. 验证入口

```bash
npm run eval:ask-helm-context-packet
npx vitest run lib/evals/ask-helm-context-packet-evals.test.ts
npm run eval:ask-helm
```

## 4. 刻意未做

1. 不注册生产 `ask-helm-answer` LLM prompt。
2. 不把 Context Packet 写入数据库或 audit log。
3. 不在 `/search` 页面展示 Context Packet。
4. 不把 candidate / revoked / archived memory 注入 Ask Helm。
5. 不开启多轮聊天历史持久化。
6. 不改变 Ask Helm read-only interpreter 的运行时输出。

## 5. 下一阶段建议

1. 第二刀做 `AskHelmSearchPlan`：把检索来源、拒绝来源和 token budget 解释为更细的 plan。
2. 第三刀做 `AskHelmMemoryInjectionPolicy` live-readiness：先接 redacted replay，不接生产 DB。
3. 第四刀再注册 `ask-helm-answer` prompt contract，LLM 只能解释和压缩，不做最终排序或承诺。
4. 多轮只允许 object-anchored case thread，且必须显式 carry-forward / superseded context / boundary；继续禁止通用聊天历史。

## 6. 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-05-03 | 首版：新增 Ask Helm Context Packet offline gate、fixture、evaluator、CLI 和索引同步 |
