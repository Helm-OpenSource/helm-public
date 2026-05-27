---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Ask Helm Natural Language Entry Implementation Plan V1

更新时间：2026-04-25
状态：Complete
当前切片：`Slice 6 complete: validation + stop conditions`

## 1. Purpose

这份计划用于把 [HELM_ASK_HELM_NATURAL_LANGUAGE_ENTRY_REQUIREMENTS_V1.md](../product/HELM_ASK_HELM_NATURAL_LANGUAGE_ENTRY_REQUIREMENTS_V1.md) 收口成一条最小可实施、最小可验证、最小可回滚的执行线。

当前目标不是“给 Helm 再做一个聊天产品”，而是把现有：

- `/search`
- workspace context
- business memory
- system knowledge
- LLM explanation

收成一个 `workspace-scoped / read-only first / action-first` 的自然语言入口。

## 2. Product Principles / Priority Mapping

本计划显式引用：

1. [HELM_PRODUCT_PRINCIPLES_V1.md](../product/HELM_PRODUCT_PRINCIPLES_V1.md)
2. [HELM_PRODUCT_PRIORITY_MAPPING_V1.md](../product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md)
3. [HELM_ASK_HELM_NATURAL_LANGUAGE_ENTRY_REQUIREMENTS_V1.md](../product/HELM_ASK_HELM_NATURAL_LANGUAGE_ENTRY_REQUIREMENTS_V1.md)

### 2.1 接到哪条真实业务闭环

这条线接的是：

`workspace entry -> search or ask -> object/memory/help understanding -> next deep link -> real operating surface`

它服务的是：

- 对象定位
- 当前状态理解
- 推荐解释
- 系统用法解释
- 下一步路由

它不是新的：

- chat center
- workflow engine
- approval cockpit
- execution authority surface

### 2.2 服务的是决策、执行、审计还是复盘

这条线主要服务：

- 决策：帮助用户理解当前状态、建议和边界
- 执行：把用户更快送到正确的工作页面
- 审计：让回答继续基于 workspace truth 和 review-first boundary

它不直接服务：

- 自动执行
- 审批替代
- 对外发送
- 跨租户知识问答

### 2.3 为什么应该现在做，而不是继续扩功能

因为当前仓库已经有：

1. `/search`
2. `workspace profileType + focusAreas + member definition`
3. `/memory`
4. LLM enhancement

但这些能力仍然是分散使用的。

如果不先把入口收口，后续很容易走向两种错误方向：

1. 把 `/search` 扩成更重的对象搜索，但没有自然语言解释层
2. 直接再做一套 chat UI，偏离 Helm 的产品定位

所以现在做 implementation planning 的优先级，来自“收口现有价值”，不是来自“新增 AI 花活”。

## 3. 当前代码与文档锚点

### 3.1 当前正式主链

- [app/(workspace)/search/page.tsx](../../app/(workspace)/search/page.tsx)
- [features/search/queries.ts](../../features/search/queries.ts)
- [features/memory/page-loader.ts](../../features/memory/page-loader.ts)
- [features/dashboard/current-role-foundation-card.tsx](../../features/dashboard/current-role-foundation-card.tsx)
- [components/layout/topbar.tsx](../../components/layout/topbar.tsx)
- [components/layout/command-palette.tsx](../../components/layout/command-palette.tsx)

### 3.2 当前规则与边界锚点

- [HELM_ASK_HELM_NATURAL_LANGUAGE_ENTRY_REQUIREMENTS_V1.md](../product/HELM_ASK_HELM_NATURAL_LANGUAGE_ENTRY_REQUIREMENTS_V1.md)
- [HELM_DEFINITION_ASSIST_BASELINE_V1.md](../product/HELM_DEFINITION_ASSIST_BASELINE_V1.md)
- [HELM_ROLE_PRESET_FOUNDATION_AND_STARTER_SKILL_BASELINE_V1.md](../product/HELM_ROLE_PRESET_FOUNDATION_AND_STARTER_SKILL_BASELINE_V1.md)
- [llm-integration-architecture.md](../llm/llm-integration-architecture.md)
- [LLM_GEMMA_DEFAULT_AND_MODEL_SWITCH_V1.md](../llm/LLM_GEMMA_DEFAULT_AND_MODEL_SWITCH_V1.md)

## 4. 关键假设

1. `Ask Helm v1` 的主入口继续挂在 `/search`，不新增独立聊天中心
2. 第一阶段只做 read-only，不新增 write path
3. 第一阶段不引入新的 vector store
4. 第一阶段可以先用 deterministic classifier 或 very-lightweight LLM classification，不要求一开始就做复杂 agent routing
5. `runtime knowledge pack` 必须是显式 schema，不允许直接把 repo docs dump 给模型
6. 对象结果、系统解释、下一步 deep link 三者必须同时成立，否则不算好入口

## 5. 最小实施切片

### Slice 0 - Requirements Freeze（当前）

目标：

- 冻结问题范围
- 冻结 query intent taxonomy
- 冻结 runtime knowledge pack 最小 schema
- 冻结 response contract
- 冻结非目标和权限边界

交付：

- requirements 文档
- implementation plan 文档
- `README.md`
- `docs/README.md`

### Slice 1 - Query Intent Taxonomy + Offline Eval

状态：Complete，见 [HELM_ASK_HELM_QUERY_INTENT_TAXONOMY_V1.md](HELM_ASK_HELM_QUERY_INTENT_TAXONOMY_V1.md)。

目标：

- 先把自然语言 query 分类问题收口，不直接进入 API/页面实现

做法：

1. 建立一份 `Ask Helm query sample set`
2. 为每条样本人工标注：
   - `intentType`
   - `needsObjectContext`
   - `needsMemory`
   - `needsSystemKnowledge`
   - `expectedPrimaryTarget`
3. 先做离线 classifier 评估：
   - rule-based baseline
   - keyword + object alias baseline
   - optional lightweight LLM classifier baseline
4. 只有当离线分类结果可接受，才进入页面集成

完成标准：

- 有一份稳定样本集
- 支持类型与 `out_of_scope` 的区分清楚
- baseline 准确率接近或达到 requirements 里写的 80%

建议交付物：

- `docs/reviews/HELM_ASK_HELM_QUERY_INTENT_TAXONOMY_V1.md`
- `evals/ask-helm/query-intents.json`

### Slice 2 - Runtime Knowledge Pack Loader

状态：Complete，见 [HELM_ASK_HELM_KNOWLEDGE_PACK_LOADER_V1.md](HELM_ASK_HELM_KNOWLEDGE_PACK_LOADER_V1.md)。

目标：

- 不让 Ask Helm 退化成 docs dump

做法：

1. 新增最小 `AskHelmKnowledgePack` contract
2. 第一阶段只覆盖 5 个核心页面：
   - `/search`
   - `/memory`
   - `/approvals`
   - `/operating`
   - `/settings`
3. 按 schema 显式写入：
   - page responsibilities
   - boundaries
   - feature availability
   - common operations
   - deep link map
4. 让 loader 支持：
   - workspace-scoped feature availability merge
   - tenant extension availability merge
   - read-only resolution

完成标准：

- Ask Helm 能显式读取结构化 knowledge pack
- 不依赖直接喂给模型整篇文档
- 每个页面至少有：
   - 它负责什么
   - 不负责什么
   - 当前 canonical for 哪类问题

### Slice 3 - Read-only Query Interpreter

状态：Complete，见 [HELM_ASK_HELM_READ_ONLY_INTERPRETER_V1.md](HELM_ASK_HELM_READ_ONLY_INTERPRETER_V1.md)。

目标：

- 做出一个最窄的问答解释器，但不进聊天产品

做法：

1. 输入：
   - raw natural language query
   - current workspace
   - optional current page / current object
2. 输出：
   - classified intent
   - retrieval plan
   - response contract
3. retrieval 只允许：
   - object search
   - memory summary
   - workspace context
   - knowledge pack
4. LLM 只在需要时负责：
   - rewrite
   - explanation
   - next-step wording

完成标准：

- 当前 query 能稳定落到一个 intent
- 返回结构符合 `AskHelmResponse`
- 没有 write path

### Slice 4 - `/search` Dual-Mode UX

状态：Complete，见 [HELM_ASK_HELM_SEARCH_DUAL_MODE_UX_V1.md](HELM_ASK_HELM_SEARCH_DUAL_MODE_UX_V1.md)。

目标：

- 把 Ask Helm 接到现有 `/search`，而不是新做聊天中心

做法：

1. 顶部搜索框引入模式切换：
   - `搜索对象`
   - `问 Helm`
2. `/search` 页面支持：
   - object mode
   - ask mode
   - mixed query mode
3. UI 层级固定为：
   - related objects
   - answer
   - next step
   - boundary note
4. 保持 action-first：
   - object result 优先
   - explanation 次之
   - 最终一定要有 page/object target

完成标准：

- `/search` 没有被做成聊天室
- Ask Helm 没有替代 detail / memory / approvals / operating
- 混合 query 仍能稳定落到对象或下一步

### Slice 5 - Access Control + Capability-aware Help Scope

状态：Complete，见 [HELM_ASK_HELM_ACCESS_SCOPE_V1.md](HELM_ASK_HELM_ACCESS_SCOPE_V1.md)。

目标：

- 把权限边界做实，而不是只写在文档里

做法：

1. 强制 `workspace membership` 检查
2. 强制对象级读权限检查
3. 对 help scope 做 capability-aware 裁剪：
   - 普通成员可见：
     - 页面职责
     - 常见操作
     - why recommendation
     - why blocked
   - 不进入默认 help layer：
     - settlement
     - reserved-only internal truth
     - 敏感治理后台真值

完成标准：

- Ask Helm 不会因为自然语言入口而绕过现有 page/object visibility
- 帮助知识层不会意外暴露 reserved-only truth

### Slice 6 - Validation + Stop Conditions

状态：Complete，见 [HELM_ASK_HELM_VALIDATION_AND_STOP_CONDITIONS_V1.md](HELM_ASK_HELM_VALIDATION_AND_STOP_CONDITIONS_V1.md)。

目标：

- 在进入更深一层实现前，先定义清楚什么情况下应暂停

做法：

1. 定义 go/no-go 指标
2. 定义 mixed query 误判容忍度
3. 定义跨租户/越权/误承诺 作为最高优先级 blocker

停止条件：

1. classifier 长时间无法稳定区分 supported vs out_of_scope
2. knowledge pack 仍高度依赖自由文档拼装，无法结构化
3. `/search` 双模 UI 让对象搜索显著变差
4. Ask Helm 回答经常缺少明确 next step

## 6. 验证方案

### 6.1 文档阶段（当前）

至少验证：

```bash
git diff --check
set -a; source .env.local >/dev/null 2>&1; set +a; npm run self-check
npm run check:boundaries
```

### 6.2 真正进入实现后

至少补：

```bash
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
```

建议新增定向验证：

1. query taxonomy 分类样本评估
2. knowledge pack schema validation
3. `/search` 双模 UI 行为测试
4. access control 单测
5. mixed query 行为测试
6. out-of-scope deny 测试

## 7. 风险与回滚

### 7.1 主要风险

1. 直接把 Ask Helm 做成 chat box，会偏离 Helm 产品边界
2. 直接拿 docs 做 RAG，会导致答案过长、失焦、难控边界
3. 在 `/search` 上做双模，如果信息层级不稳，会伤到当前对象搜索体验
4. 如果权限检查不清楚，自然语言入口会成为新的越权漏口
5. 如果 next-step target 不稳定，Ask Helm 会变成“会说但不带路”

### 7.2 回滚方式

这条线必须保持可切片回滚：

- Slice 1 可以单独保留 taxonomy，不接页面
- Slice 2 可以单独保留 knowledge pack，不接解释器
- Slice 3 可以只保留 interpreter service，不暴露 UI
- Slice 4 可以单独撤回 `/search` 双模 UI，恢复纯对象搜索
- Slice 5 可以在 help scope 过宽时快速降级为 object-only + system-help-only

## 8. 当前结论

当前最合理的推进顺序是：

1. `Query Intent Taxonomy + Offline Eval` 已完成
2. `Runtime Knowledge Pack` 已完成
3. `Read-only Query Interpreter` 已完成
4. `/search` 双模原型已完成
5. `Access Control + Capability-aware Help Scope` 已完成
6. `Validation + Stop Conditions` 已完成

当前这条线的正确状态应被表达为：

- 需求边界已经冻结
- query taxonomy、knowledge pack、read-only interpreter、`/search` 双模入口与 access scope 已进入最小实现
- 聚合 validation command 已具备
- 仍未进入完整 LLM explanation、对象级细粒度 ACL、chat center 或 write path
