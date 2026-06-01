# Skill 实现参考说明（reference.md，非可执行代码）

> **重要边界：** 本文件仅放可读的"参考实现说明"——**不放可执行代码**。
> Pack 商业版的真实 worker 实现（worker.ts / worker.py）属于闭源。
> 详见 docs/GOVERNANCE.md。

## 实现职责
- 接受输入（按 SKILL.md `requires` 字段）
- 产出输出（按 SKILL.md `输出` 段）
- 进入 audit chain
- 遵守"建议 vs 承诺"边界

## 输入接口（参考）
```typescript
interface SkillInput {
  workspaceId: string;
  triggerEvent: string;
  payload: <按 Skill 实际定>;
  context: SkillContext;
}
```

## 输出接口（参考）
```typescript
interface SkillOutput {
  recommendation: <建议体>;
  requires_review: boolean;
  audit_trace_id: string;
}
```

## 复核机制（必须）
任何 `requires_review === true` 的输出**不允许**直接执行对外动作。
