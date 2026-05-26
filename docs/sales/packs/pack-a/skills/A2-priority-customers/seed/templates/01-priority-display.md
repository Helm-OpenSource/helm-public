---
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 模板 01：每日 5 个优先客户清单展示

## 适用
每日 09:00 推送给销售的清单展示模板。

## 输出格式
```
🎯 今天该跟的 5 个客户（共 23 个活跃商机）

1. [客户名] · 阶段: [stage] · 金额: [量级]
   风险: [tag1, tag2]
   建议: [action]
   下次会议: [date]
   关联 Skill: [A1 草稿待发 / A4 Handoff 待启动 / ...]

2. ...
3. ...
4. ...
5. ...

—
[查看全部 23 个商机]
[调整优先级权重]（仅销售本人可见）
```

## 复核点
- 销售可手工调整顺序
- 调整原因可写入 audit chain（用于权重优化）
