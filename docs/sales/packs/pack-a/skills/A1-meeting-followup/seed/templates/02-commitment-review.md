---
status: active
owner: helm-core
created: 2026-04-30
review_after: 2026-07-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 模板 02：越界承诺复核通知

## 适用
A1 识别出销售在会议中可能做了越界承诺时，自动给销售 + 销售经理的通知。

## 草稿（系统通知，非对外发送）
```
[Helm Pack A · 越界承诺复核]

会议：[客户公司] - [会议主题] - [日期]
销售：[姓名]

识别项：
- 销售原话："[原始措辞]"
- 识别为可能的承诺：[承诺类型，如"功能交付 / 价格 / 时间 / 集成支持"]
- 当前方案边界：[方案中是否包含此项]
- 建议处理：
  [ ] 改口径（推荐话术：[具体话术]）
  [ ] 升级到方案变更流程（A4 Handoff 联动）
  [ ] 经管理者评估后再回复客户

请在 24 小时内确认处理方式。
```

## 复核点
- 系统通知不直接发给客户
- 销售选择处理方式后，A1 跟进清单自动更新
- 销售经理可在 A3 主管面板查看本团队当日越界承诺识别情况
