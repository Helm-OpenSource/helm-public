# Routing Intelligence Failure Taxonomy

## 一、Failure 分类

| Failure Type | Description | Expected Handling | Not Allowed |
|---|---|---|---|
| zero_signal_routing | Must_push or review channel selected with zero signal aliases | Escalate to `rejected`; no evidentiary basis for routing decision | Auto-fallback to watch channel |
| conflict_majority | More than 50% of signals are conflicting | Escalate to `review_required`; routing reliability is too low to trust | Auto-resolve conflicts by majority vote |
| full_conflict | All signals are conflicting | Escalate to `rejected`; routing is fully ambiguous | Use the most recent signal to break the tie |
| llm_final_routing | Routing decision was made or influenced by LLM final-ranking | Escalate to `rejected`; routing must remain deterministic | Allow LLM-ranked routing as a fallback |
| channel_downgrade_suppressed | A signal set warranting watch is incorrectly escalated to must_push | Escalate to `review_required`; false positive risk is high | Auto-accept the must_push routing |
| channel_upgrade_suppressed | A signal set warranting must_push is incorrectly placed in watch | Flag as `watch_only`; route to human adjudication for upgrade decision | Auto-upgrade to must_push |
| workspace_isolation_breach | Signal alias references a workspace not matching the eval workspace | Escalate to `rejected`; workspace isolation boundary violated | Auto-remap signal workspace |
| conflict_count_exceeds_total | conflictingSignalCount > signalAliasCount | Escalate to `rejected`; data integrity violation in routing input | Trust the conflicting count as valid |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first：路由逻辑变更必须经人工复核
- 路由逻辑保持 deterministic：不允许 LLM 做最终排序
- no-auto-promote：路由质量 eval 结果只作为 learning candidate，不自动晋升
