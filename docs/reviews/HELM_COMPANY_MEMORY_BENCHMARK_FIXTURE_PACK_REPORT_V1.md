---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - CM-EVAL fixture pack 被 production redacted payload cadence 替代
  - 2026-10-27 之后，无任何 PR / 文档引用本文件
---

# Helm Company Memory Benchmark Fixture Pack Report V1

更新时间：2026-04-27
状态：CM-EVAL-1 complete / fixture-only
Owner：Helm Core

## 1. 结论

本轮完成 `CM-EVAL-1` 第一版公司记忆 benchmark fixture pack。

交付物：

- `evals/company-memory/fixtures/redacted-business-events.json`

这批 fixture 把公司记忆评估从现有 `eval:memory` 的 extraction / retrieval / distillation 基线，扩展到经营资产视角：source event、expected memory assets、world model assertions、retrieval assertions 与 advancement outcome。

本轮仍不实现 evaluator，不接 runtime，不改 schema，不改 API，不改页面，不授权 auto promotion、official write、LLM final ranking 或自动执行。

## 2. Fixture 覆盖

| 来源类型 | 数量 | 覆盖重点 |
| --- | ---: | --- |
| `meeting` | 12 | 会议结论、承诺、阻塞、偏好、容量与审批边界 |
| `email` | 10 | 客户等待、催问、隐私 / 证明 / 外发边界、候选人反馈 |
| `crm` | 8 | 机会状态、停滞、逾期、关闭、生命周期语义 |
| `report` | 8 | 资源异常、经营指标、交付风险、proof 与 no-SLA 边界 |
| `ask_helm` | 8 | repeated intent、boundary hit、abandoned high-confidence answer、saved draft |
| `mixed` | 4 | 多源合并、冲突抑制、重复折叠、跨证据 Must Push |
| **Total** | **50** | 满足 framework 的 CM-EVAL-1 最低样本规模 |

## 3. 每条 Case 的最小合同

每条 fixture 均包含：

1. `id`
2. `caseCategory`
3. `workspaceId`
4. `sourceEvents[]`
5. `expectedMemoryAssets[]`
6. `expectedWorldModelAssertions[]`
7. `expectedRetrievalAssertions[]`
8. `expectedAdvancementOutcome`

这些字段服务后续四臂评估：

1. `no_memory`
2. `raw_context`
3. `current_retrieval_pack`
4. `distilled_memory`

## 4. 边界

本轮明确不做：

1. 不新增 `eval:company-memory` 命令。
2. 不实现 evaluator。
3. 不读取真实 DB。
4. 不接 Ask Helm runtime。
5. 不改 `MemoryFact / MemoryDistillationCandidate / SkillSuggestion` schema。
6. 不把任何 fixture 写成 production truth。
7. 不允许 LLM 做最终排序、policy 判断、approval 判断或 commitment 判断。

## 5. 验证结果

已验证：

```bash
node - <<'NODE'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('evals/company-memory/fixtures/redacted-business-events.json', 'utf8'));
const counts = data.cases.reduce((acc, item) => {
  acc[item.caseCategory] = (acc[item.caseCategory] || 0) + 1;
  return acc;
}, {});
console.log(JSON.stringify({ total: data.cases.length, counts }, null, 2));
NODE
```

输出：

```json
{
  "total": 50,
  "counts": {
    "meeting": 12,
    "email": 10,
    "crm": 8,
    "report": 8,
    "ask_helm": 8,
    "mixed": 4
  }
}
```

本轮还运行：

```bash
git diff --check -- docs/product/HELM_COMPANY_MEMORY_EVALUATION_FRAMEWORK_V1.md docs/README.md
npm run check:boundaries
```

结果：通过。

## 6. 当前四类短表

### 已经完整成立

- 公司记忆评估框架 V1 已落库。
- CM-EVAL-1 fixture pack 已达到 50 条样本与来源分布要求。
- 每条样本均绑定 source event、expected memory asset、world model assertion、retrieval assertion 与 advancement outcome。
- 当前边界保持 planning / fixture-only，没有 runtime 或 authority 扩面。

### 已成形但仍需下一层

- `eval:company-memory` 尚未实现。
- four-arm evaluator 尚未实现。
- LLM economics baseline 尚未实现。
- world model health evaluator 尚未实现。
- fixture payload refs 当前是 redacted reference paths，不包含真实 payload 文件；后续可选择补最小 redacted payload pack。

### 刻意未做

- 不改 production memory pipeline。
- 不新增 schema。
- 不新增 API 或 UI。
- 不创建 promoted memory。
- 不把 distillation candidate 接入 ranking owner。

### 风险项

- 50 条 fixture 目前是结构化 benchmark cases，不等于已经通过真实用户 review。
- 如果后续 evaluator 只做字段存在检查，会变成形式主义；必须实现 quality / evidence / boundary / cost / adoption 五类输出。
- 后续加入真实脱敏 payload 时必须继续保持 no PII、no secrets、no tenant leakage。

## 7. 下一步

进入 `CM-EVAL-2`：

1. 新增 `lib/evals/company-memory-evals.ts`。
2. 新增 `scripts/company-memory-evals.ts`。
3. 新增 `npm run eval:company-memory`。
4. 输出 six-layer scorecard。
5. 先做 deterministic fixture validator，再逐步接 four-arm evaluator。
