---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_BUSINESS_ADVANCEMENT_PHASE3_PRIVACY_RETENTION_SPEC_V1

更新时间：2026-04-27
状态：Slice 1 privacy / retention spec accepted for planning-only implementation
适用范围：Business Advancement Product Phase 3 / Ask Helm Interaction Asset Capture

本文件是 [HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md](./HELM_BUSINESS_ADVANCEMENT_PHASE1_3_REQUIREMENTS_DESIGN_V1.md) 的 Slice 1 输出。

它只冻结 Ask Helm interaction asset candidate 的 privacy、retention、deletion、export、visibility 和 reviewer capability 边界。

本文件不批准：

- runtime persistence
- Prisma schema
- API route
- `/search` 或 `/mobile` 页面行为
- DB-backed queue
- raw transcript / raw audio storage
- official write
- auto execution
- formal skill auto-promotion

---

## 1. 总结论

Phase 3 可以继续进入后续设计，但只有在以下 privacy contract 成立后，才允许讨论 candidate fixture / eval：

| 维度 | 冻结结论 |
| --- | --- |
| 默认可见性 | `user_only` |
| 默认保留姿态 | `temporary_review_candidate` |
| user-only TTL | 最长 7 个自然日 |
| reviewer queued TTL | 最长 30 个自然日 |
| promoted lifecycle | 继承目标 review-first object，不继承原始 Ask Helm turn |
| raw audio | 永不保存 |
| unconfirmed transcript | 永不进入 candidate |
| export | 只允许 redacted JSONL / JSON object |
| reviewer 身份 | workspace membership + explicit assignment/capability，不是全局角色 |

核心原则：

```text
query is not fact
answer is not memory
candidate is not authority
review visibility is not workspace-wide visibility
promotion is review-first, not official write
```

---

## 2. Current Repo Truth

已经成立：

- Ask Helm v2 已有 action intent、answer、plan、draft、review packet、handoff、voice transcript checked 等 contract。
- Business Advancement Phase 1A / 1B / 2 已有 planning-only contract、fixtures、offline eval 和 adapter。
- Phase 1-3 总需求文档已把 Ask Helm interaction asset capture 定义为 reviewable candidate。

仍未成立：

- 没有 Ask Helm interaction asset DB schema。
- 没有 candidate persistence。
- 没有 candidate review queue。
- 没有 candidate export route。
- 没有 runtime deletion worker。
- 没有 production read model adoption。

因此，本文件里的字段、状态和 TTL 都是 implementation gate，不是当前 runtime truth。

---

## 3. Data Classification

### 3.1 永不保存

以下内容不得进入 candidate、export、review packet 或 support artifact：

- raw audio
- unconfirmed voice transcript
- complete multi-turn chat history
- secrets、tokens、API keys、passwords
- payment card / bank account raw input
- cross-workspace object text
- unsupported open-domain prompt body
- external system credential / session material

### 3.2 可作为 redacted reference

以下内容可在 candidate 中以脱敏引用或摘要形式出现：

| Content | 允许形态 | 禁止形态 |
| --- | --- | --- |
| `sourceTurnRef` | opaque reference | full prompt text |
| `objectRefs` | typed id / opaque object pointer | cross-workspace labels |
| `evidenceRefs` | existing evidence pointer | raw email / raw transcript body |
| `answerSummary` | short redacted summary | full Ask Helm answer history |
| `boundaryNote` | guard reason | instruction to bypass guard |
| checked transcript | user-confirmed excerpt / summary | raw audio or unconfirmed transcript |

### 3.3 默认降级

如果无法判断数据类别，默认降级为：

```text
visibility = user_only
retentionPosture = not_persisted
promotionTarget = none
```

---

## 4. Visibility Contract

### 4.1 Visibility enum

| Visibility | 可见对象 | 用途 |
| --- | --- | --- |
| `user_only` | candidate actor 本人 | 默认 review-before-share 暂存 |
| `reviewer_only` | explicit assigned reviewer / operator | 指派复核，不代表 workspace-wide |
| `workspace_review_visible` | owner / admin / assigned reviewer | 需要 workspace 级复核的候选 |

### 4.2 Reviewer 身份定义

`reviewer` 不是全局角色，也不是所有 workspace member。

一个 reviewer 必须同时满足：

1. 属于同一 workspace。
2. 具备既有 review / operating / owner / admin capability 中的一种。
3. 被明确分派到该 candidate，或以 workspace owner / admin 身份进入复核。
4. 能访问 candidate 的 `objectRefs` 和 `evidenceRefs`；否则只能看到 redacted shell，不得看到内容摘要。

### 4.3 可见性升级规则

`user_only -> reviewer_only` 只能由以下事件触发：

- actor 主动提交复核。
- actor 保存 review packet。
- actor 请求 handoff。
- boundary hit 明确需要人工复核且 candidate 已通过 privacy classification。

`reviewer_only -> workspace_review_visible` 只能由 owner / admin 或 assigned reviewer 明确升级，且必须记录升级理由。

不允许：

- 因 repeated intent 自动变成 workspace-wide。
- 因 high confidence 自动变成 workspace-wide。
- 因 boundary hit 自动给所有 workspace member 可见。
- 因 LLM 判断自动升级可见性。

---

## 5. Retention Contract

### 5.1 Retention enum

| Retention posture | 含义 | 默认 TTL |
| --- | --- | --- |
| `not_persisted` | 不落候选，只允许即时响应或 aggregate guard metric | 0 |
| `temporary_review_candidate` | 暂存 reviewable candidate | 7 / 30 natural days |
| `promoted_after_review_only` | reviewer 确认后进入目标 review-first object | target lifecycle |

### 5.2 TTL matrix

| Candidate state | Visibility | TTL clock | 最大保留 |
| --- | --- | --- | --- |
| denied / not captured | none | response completed | 0 |
| captured user-only | `user_only` | `capturedAt` | 7 个自然日 |
| reviewer queued | `reviewer_only` / `workspace_review_visible` | `queuedAt` | 30 个自然日 |
| dismissed | none or actor-only receipt | `dismissedAt` | 不保留 content |
| deleted | none | `deletedAt` | 不保留 content |
| expired | none | `expiresAt` | 不保留 content |
| promoted | target object visibility | target object lifecycle | 不继承 source turn |

TTL 使用自然日，而不是工作日。原因是 privacy deletion 需要可预测、可审计、易实现。

R1 的工作日问题处理方式：abandonment detection 属于 Slice 3 threshold spec，不属于本 Slice 的 retention clock。若未来 abandonment 观察窗口跨周末或非工作日，默认不得仅因周末沉默升级到 reviewer / workspace visibility；可在 Slice 3 中评估 `3 business days`，但 privacy TTL 仍保持自然日。

### 5.3 Promoted lifecycle

promotion 只允许进入 review-first target：

- `AdvancementSignal`
- `MemoryCandidate`
- `SkillSuggestion`
- `ReviewRequiredAction`

promotion 后：

- 原始 Ask Helm turn 不随 target object 持久化。
- target 只能保存 redacted summary、objectRefs、evidenceRefs、boundaryNote、review reason。
- checked transcript 只能以 reviewer-approved excerpt / summary 进入 target。
- `SkillSuggestion` 不自动成为 formal skill。
- `ReviewRequiredAction` 不自动成为 official write。

---

## 6. Deletion Contract

### 6.1 删除触发

以下任一事件必须删除 candidate content：

1. actor dismiss / delete。
2. assigned reviewer dismiss。
3. TTL 到期。
4. workspace access revoked。
5. membership revoked or disabled。
6. source object deleted or no longer accessible。
7. source object workspace mismatch。
8. privacy export / delete request 要求删除。
9. cross-workspace classification failed。
10. unsupported open-domain classification failed。
11. sensitive data scanner 发现 secret / credential / payment raw input。
12. reviewer capability removed。

### 6.2 删除结果

删除后允许保留的只有非内容化审计事实，且本文件不批准新增 audit schema：

| 可保留 | 不可保留 |
| --- | --- |
| deletion event type | prompt text |
| deletion timestamp | answer text |
| actor/reviewer opaque id | transcript text |
| candidate opaque hash | raw audio |
| reason code | object labels from inaccessible workspace |

如果未来需要 deletion receipt，只能证明“某候选被删除/过期/撤回”，不能恢复候选内容。

---

## 7. Export Contract

### 7.1 Export scope

导出权限不得超过可见权限：

| Actor | 可导出内容 |
| --- | --- |
| candidate actor | 自己的 `user_only` candidate redacted export |
| assigned reviewer | 被明确分派的 candidate redacted export |
| workspace owner / admin | workspace review-visible candidate redacted export |
| ordinary member | 默认不可导出 |

### 7.2 Canonical export format

首选格式：JSONL，一行一个 redacted candidate。

允许字段：

```json
{
  "candidateId": "opaque-candidate-id",
  "workspaceId": "opaque-workspace-id",
  "capturedAt": "2026-04-27T00:00:00.000Z",
  "expiresAt": "2026-05-04T00:00:00.000Z",
  "assetType": "boundary_hit_candidate",
  "intentType": "review_required_execution",
  "visibility": "user_only",
  "retentionPosture": "temporary_review_candidate",
  "objectRefs": [],
  "evidenceRefs": [],
  "captureReason": "review_required_boundary_hit",
  "boundaryNote": "review required; no official write",
  "promotionTarget": "ReviewRequiredAction",
  "status": "captured",
  "redactionSummary": "raw prompt, raw audio, unconfirmed transcript, secrets removed"
}
```

禁止导出字段：

- raw prompt
- raw audio
- unconfirmed transcript
- complete checked transcript unless explicitly reviewer-approved excerpt
- full answer history
- secrets / tokens / credentials
- payment details
- inaccessible object labels
- cross-workspace data

### 7.3 Export cache posture

任何未来 export surface 必须是 private / no-store posture。

本文件不批准 export route；它只定义 future route 的 minimum contract。

---

## 8. Voice Transcript Contract

Voice input 必须按三层处理：

| State | 允许 |
| --- | --- |
| raw audio | 不保存，不导出，不进入 candidate |
| unconfirmed transcript | 只可用于当前 turn 展示确认，不进入 candidate |
| checked transcript | 可生成 redacted summary / reviewer-approved excerpt |

checked transcript 仍不等于 official memory。它只能作为 candidate evidence 的来源摘要，且受同一 TTL / deletion / export 规则约束。

---

## 9. Boundary Hit Contract

boundary hit 可以形成 `boundary_hit_candidate`，但只在以下范围内使用：

- explanation of why review is required
- product friction analysis
- guard quality review
- ReviewRequiredAction candidate

boundary hit 不允许：

- 绕过 guard。
- 提升 capability。
- 自动创建 official write。
- 自动发送、审批、付款、写回。
- 把普通 unsupported open-domain prompt 变成 active candidate。

如果 boundary hit 同时包含 secret / credential / payment raw input，privacy deletion 优先于 candidate creation。

---

## 10. Non-Blocking Review Suggestions Allocation

二次评审中的可选建议按以下方式分配：

| 建议 | 本 Slice 处理 | 后续归属 |
| --- | --- | --- |
| R1 abandonment 24h vs 3 business days | privacy TTL 继续用自然日；周末沉默不得自动升级 visibility | Slice 3 threshold spec |
| R2 reviewer 身份定义 | 已定义为 membership + capability + assignment，不是全局角色 | 本 Slice 已关闭 |
| R3 deterministic confidence fallback | 本 Slice 不定义 confidence algorithm | Slice 3 threshold spec |

---

## 11. Acceptance Criteria

本 Slice 完成条件：

1. TTL 明确为 user-only 7 natural days、reviewer queued 30 natural days、promoted target lifecycle。
2. 删除触发覆盖 dismiss、delete、revoke、source inaccessible、TTL expiry、privacy request、classification failure。
3. export contract 明确 redacted JSONL / JSON object、允许字段和禁止字段。
4. `workspace_review_visible` 限定为 owner / admin / assigned reviewer，不给普通成员。
5. reviewer 身份不被定义为全局角色。
6. raw audio / unconfirmed transcript 永不进入 candidate。
7. checked transcript 只能作为 redacted summary / approved excerpt。
8. boundary hit 不可绕过 guard。
9. 文件不批准 schema、API、runtime persistence、page behavior 或 official write。

---

## 12. Stop Conditions

出现以下任一情况，必须停止 Slice 1 后续实施：

1. 需要新增 Prisma schema 才能表达本 spec。
2. 需要新增 export route。
3. 需要新增 deletion worker。
4. 需要存 raw audio。
5. 需要存 unconfirmed transcript。
6. 需要持久化完整多轮聊天历史。
7. 需要 owner / admin / assigned reviewer 之外的人默认看到 candidate。
8. 需要把 boundary hit 用作 guard bypass。
9. 需要把 checked transcript 直接写成 official memory。
10. 需要把 promoted candidate 写成 official write。

---

## 13. Verification

本 Slice 为 docs-only spec，验证命令：

```bash
git diff --check
npm run self-check
npm run check:boundaries
```

预期：

- 文档 whitespace / conflict marker 检查通过。
- boundary guard 仍保持 recommendation / commitment / no auto execution 边界。
- 如本地缺少 `DATABASE_URL`，`self-check` 允许只失败在 Database Configuration，并作为环境问题记录。

---

## 14. 下一步

下一刀进入 Slice 2：`Phase 1-3 Dedupe / Merge Strategy`。

Slice 2 必须冻结：

1. conceptual fingerprint。
2. repeated intent folding。
3. Ask Helm candidate 到 existing `AdvancementSignal` / `MustPushItem` 的 evidence attachment。
4. boundary hit 只能增加 review reason，不能提升权限。
5. dedupe 后仍能 dismiss / delete / leave unpromoted。
