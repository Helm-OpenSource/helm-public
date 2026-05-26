---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 页面组件与信息层级规范 V1

## 一、文件目的

本规范用于统一 Helm 页面层级、共享组件和首屏预算，避免页面重新滑回“系统先自述自己做了什么，用户再去判断”的旧骨架。

当前规则只有一句：

**用户先完成判断和动作，再决定要不要看系统解释。**

## 二、适用范围

本规范适用于：

- workspace 内高频经营页
- detail / variants / proposal / package / offer 相关详情页
- review / approval / decision request 相关页面
- evidence / replay / audit 的受控下钻视图

## 三、总原则

1. 首屏只讲对象，不讲系统。
2. 首屏先给判断，再给动作，再给边界。
3. 系统解释默认折叠，不再直接霸占第一页主位。
4. evidence、audit、replay 保留，但进入 backstage / appendix。
5. prepared / reviewed / approved / executed / official 必须彻底分开。

## 四、Helm 页面统一层级模型

所有高频核心页面统一采用三层合同。

### L1：前台层

前台层只允许：

1. 当前状态
2. 待决策
3. 下一步动作
4. 边界

前台层必须满足：

- 首屏最多 4 个主模块
- 默认 0 个展开的系统解释块
- 默认 0 个“证明系统很聪明”的长段落

### L2：中间层

中间层承载：

- review snapshot
- prepared draft / prepared context
- 协作分工 / coordination handoff
- secondary summary

### L3：后台层

后台层承载：

- Why it matters
- evidence
- replay
- audit
- worker reasoning
- 状态语义说明

## 五、统一页面骨架

任何高频 detail / variants 页面默认使用以下骨架：

1. `NarrativeHeader`
2. `Current summary`
3. `Pending decision`
4. `Next action`
5. `Boundary`
6. `ReviewSnapshotBlock`
7. `WhyItMattersBlock`
8. `EvidenceDrawer`

例外：

- onboarding / setup / login 可以保留默认展开说明
- 这属于例外，不属于常态

## 六、核心组件规范

### 1. NarrativeHeader

作用：

- 承载页面首句判断与高层 summary
- 不再重复堆叠 takeaways / operator prompt / 决策列表

### 2. ReviewSnapshotBlock

作用：

- 替代旧的 `What Helm already prepared`
- 用对象口径承载待复核结果、prepared draft 和 review snapshot
- 同时明确 prepared / reviewed / approved / executed / official 的状态语义

要求：

- 默认折叠
- 只能放与当前判断直接相关的待复核结果
- 不把 prepared 写成已执行或 official

### 3. DecisionRequestCard

作用：

- 把待拍板事项明确放回前台层

### 4. ActionRail

作用：

- 保持主动作 1 个、次动作最多 2 个
- 作为前台层的一部分，不再被系统解释打断

### 5. BoundaryNote

作用：

- prerequisite / dependency / risk / non-commitment 继续保持前置可见

### 6. WhyItMattersBlock

作用：

- 只保留一句 preview
- 完整理由继续折叠在后台层

### 7. WorkerSummary

作用：

- 仅在下一位 owner 会因此改变时才允许前置
- 否则默认下沉到 appendix / backstage

### 8. EvidenceDrawer

作用：

- 承接 evidence / replay / audit / memory / trace
- 默认折叠

## 七、状态语义

页面必须显式区分：

1. `Prepared`
2. `Reviewed`
3. `Approved`
4. `Executed`
5. `Official`

统一解释：

- `Prepared` 不等于 `Reviewed`
- `Reviewed` 不等于 `Approved`
- `Approved` 不等于 `Executed`
- `Executed` 不等于 `Official`

## 八、禁止事项

- 不再把 `What Helm already prepared` 放进首屏主位
- 不再把 `Worker summary` / `AI 与团队分工` 放进首屏主位
- 不再把 `Why it matters` 放到判断前面
- 不再把 evidence / replay / audit 当成首屏主叙事
- 不把 AI 推断写成已经完成动作

## 九、验证要求

必须有：

- shared surface hierarchy guards
- copy audit
- docs / self-check / boundary check 同步

最小验证目标：

- legacy detail 页首屏只剩 4 个主模块
- `ReviewSnapshotBlock` 取代旧系统自述块
- `WhyItMattersBlock` 和 `EvidenceDrawer` 默认折叠
- shared reporting / proactive panel 与 customer success queue 也必须遵守同一套首屏预算
- legacy detail model、meeting detail prepared-summary prompt 和高频 queue model 也不得回退到 `Helm already...` / `Helm AI work agent` 一类 system-self narration
- dashboard / meetings / approvals / opportunities / imports / inbox / queue / shared panel 这类高频 operating surface 也不得重新回退到 Helm-centered 首屏文案；onboarding / setup / login 仍是显式例外
- 第五轮继续把 meeting explanation、settings guidance、public-entry / onboarding 和 detail hint 一并纳入 project-level systemspeak audit；允许后台 explanation 保留，但不再让它回到前台主位
