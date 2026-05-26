---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business Advancement Phase 3Q — Snapshot Intake Review V1

**状态**: Phase 3Q Snapshot Intake Review Ready
**Runtime Adoption 姿态**: No-Go
**生产接入**: No-Go
**日期**: 2026-04-26

---

## 概述

Phase 3Q 在 Phase 3P redacted snapshot collector 之后，补齐一个 script-only、offline 的脱敏 snapshot 接收评审工具：

`scripts/business-advancement-phase3q-snapshot-intake-review.ts`

它的职责是读取 Phase 3P `--print-json` 输出或 Phase 3O `evidencePack` 原始对象，对输入做敏感内容扫描，确认无敏感 key 或原始 email 类字符串后再运行 Phase 3O evaluator，输出 calibration summary。

该工具不读取 DB，不写文件，不做网络请求，不接入任何产品 runtime。

---

## 边界

Phase 3Q **是**：

- script-only offline 脱敏 snapshot 接收评审工具
- 从 `--input <file>` 或 stdin 读取 JSON
- 敏感内容扫描前置过滤器（key 级别 + email 类字符串值级别）
- Phase 3O evaluator 的接收端入口
- runtime adoption review 的前置安全审查工具

Phase 3Q **不是**：

- production runtime adapter
- `data/queries.ts` 集成
- app route / API route
- mobile read-model
- schema migration
- official write path
- automated execution authority

---

## 接受的输入格式

### Phase 3O 直接 evidencePack 对象

```json
{
  "sampleKind": "redacted_live_db_snapshot",
  "workspaceId": "workspace-<hash>",
  "referenceClockMs": 1777161600000,
  "rows": { ... }
}
```

### Phase 3P `--print-json` 输出对象

```json
{
  "evidencePack": { ... },
  "evaluation": { ... }
}
```

脚本识别顶层 `evidencePack` key 时自动提取内层 `evidencePack` 对象。

---

## 敏感内容拒绝规则

### 敏感 Key 拒绝

以下 key 名称在 JSON 任何层级出现时立即拒绝；匹配按大小写不敏感处理：

`title`, `description`, `subject`, `body`, `email`, `counterpart`, `participants`, `summary`, `secret`, `token`

### 原始 Email 类字符串值拒绝

任何匹配 `[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}` 的字符串值会触发拒绝。

Phase 3P 采集的脱敏行使用 namespace-aware SHA-256 截断 hash，不会触发此规则。

---

## CLI 使用

从文件读取：

```bash
npx tsx scripts/business-advancement-phase3q-snapshot-intake-review.ts \
  --input /path/to/redacted-snapshot.json
```

从 Phase 3P `--print-json` 管道：

```bash
DATABASE_URL=... \
npx tsx scripts/business-advancement-phase3p-redacted-snapshot-collector.ts \
  --workspace-id <workspace-id> \
  --reference-clock-iso 2026-04-26T00:00:00.000Z \
  --print-json | \
npx tsx scripts/business-advancement-phase3q-snapshot-intake-review.ts
```

---

## 退出码

| 情况 | 退出码 |
|---|---|
| 读取 / 解析输入失败 | 1 |
| 敏感 key 或 email 类字符串值被检测到 | 1 |
| 输入格式无效（非 Phase 3O / Phase 3P 格式） | 1 |
| 输入合法，evaluation 完成 | 0 |

注意：exit 0 并不意味着 `realDataValidated=true` 或 runtime adoption 获批；summary 中的 blockers 应被单独审查。

---

## 已经完整成立

| 项目 | 状态 | 说明 |
|---|---|---|
| 敏感 key 扫描 | Complete | 递归扫描 JSON 树所有 key，命中拒绝列表即失败退出 |
| Email 类字符串值扫描 | Complete | 递归扫描所有 string 值，命中 email pattern 即失败退出 |
| Phase 3O 直接格式支持 | Complete | 识别 `sampleKind/workspaceId/referenceClockMs/rows` 结构 |
| Phase 3P --print-json 格式支持 | Complete | 识别顶层 `evidencePack` key 并提取内层对象 |
| Phase 3O evaluator 集成 | Complete | 合法输入后运行 `evaluatePhase3oRealDataCalibrationEvidencePack` |
| 退出码约定 | Complete | 无效 / 敏感输入退出 1；合法输入退出 0 |
| 无文件写入 / 无 DB / 无网络 | Complete | 脚本输出和代码均无写路径 |
| Runtime adoption No-Go | Complete | 脚本输出和文档均明确 No-Go |

---

## 已成形但仍需下一层

| 项目 | 当前状态 | 下一步 |
|---|---|---|
| 真实 DB 校准运行 | 未执行 | 需要先执行 Phase 3P 采集，再用 Phase 3Q intake review 评审输出 |
| 真实校准结果通过 | 未发生 | 需要 `realDataValidated=true` 并经人工评审才能进入 runtime adoption review |
| Production runtime adoption review | 未开始 | 仅在 Phase 3O/3P/3Q 真实数据校准全部通过后启动 |
| Runtime adapter | 未实现 | 仍然 No-Go |

---

## 刻意未做

| 项目 | 理由 |
|---|---|
| 写文件 | 避免把脱敏 snapshot 落库进 repo |
| DB 读写 | intake review 必须 offline；不连接 DB |
| 默认数据库回退 | 不适用；本脚本无 DB 依赖 |
| `data/queries.ts` 接入 | Runtime adoption No-Go |
| `app/` / `features/mobile/` 接入 | 仍未获批 |
| exit 1 on evaluation blockers | Phase 3Q 只负责 intake 安全检查，blockers 是 calibration 层问题，不属于 intake 拒绝范畴 |

---

## 验证结果

### Phase 3Q vitest

```
npx vitest run features/business-advancement/phase3q-snapshot-intake-review.test.ts
→ 1 file / 40 tests PASS
```

### Phase 3Q eslint

```
npx eslint scripts/business-advancement-phase3q-snapshot-intake-review.ts \
  features/business-advancement/phase3q-snapshot-intake-review.test.ts
→ PASS
```

---

## 结论

Phase 3Q 完成的是 offline 脱敏 snapshot 接收安全检查工具，不是 runtime adoption。

当前状态：

- Intake review script: Ready
- Sensitive key scan: Implemented
- Email-like value scan: Implemented
- Phase 3O evaluator integration: Complete
- Real DB run: Not executed
- Real-data validation: Not completed
- Runtime adoption: No-Go

下一步必须在执行 Phase 3P 采集、输出 `--print-json` 后通过 Phase 3Q intake review；通过后也只能进入 production runtime adoption review，不能直接上线。
