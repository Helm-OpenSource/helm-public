> **语言 / Language**：**中文** · [English](DESIGN.en.md)

# Helm Design

## 1. 目的

这份 `DESIGN.md` 是 Helm 当前主干的固定视觉与界面约束。

它回答的不是“这次页面想怎么做”，而是后续所有首页、dashboard、operating、approvals、memory、detail、settings、setup、demo shell 改造时，默认应该朝什么方向收敛。

这份文档默认服务于：

- 统一 Helm 的长期视觉方向
- 减少页面之间的风格漂移
- 让产品表达和 `judgement-first / decision-first / formal review` 的产品定位保持一致
- 让后续 Codex / 设计 / 工程改造有同一份固定要求

这份文档当前不是：

- 完整设计系统站点
- 完整组件文档平台
- 一次性营销页创意稿
- 任意页面都可以随意突破的灵感清单

## 2. 一句话视觉方向

Helm 应该长得像：

**企业级经营操作系统**

而不是：

- developer-tool control plane
- premium fintech marketing site
- consumer AI chat app
- 靠高饱和渐变和夸张动效撑气氛的 demo 壳

后续默认按这条混合基线理解：

- 企业可信与结构感：`70%`
- AI 产品感与现代感：`20%`
- 文档级可读性与说明清晰度：`10%`

参考方向可以理解为：

- `IBM` 式企业权威感作为主基底
- `Cohere` 式 AI 企业产品感作为轻点缀
- `Mintlify` 式说明可读性作为文档和 onboarding 补充

这里只借“气质与结构”，不照搬具体页面。

## 3. Helm 应该给人的感觉

用户第一眼应该感受到的是：

- 可信
- 稳定
- 克制
- 有判断
- 有治理边界
- 可以被高频使用，而不是只能演示

更具体地说：

- 首页像正式商用产品入口，不像实验性 AI landing page
- dashboard 像经营指挥面，不像中性 BI 面板
- approvals 像正式复核层，不像普通待办列表
- memory/detail 像 evidence 与 operating trace，不像聊天记录堆叠
- settings/billing 像产品级治理界面，不像 finance console 或灰色后台

## 4. 产品表达必须先于视觉装饰

Helm 的视觉改造默认必须服从这 5 条产品语义：

1. `judgement-first`
2. `decision-first`
3. `review-before-commitment`
4. `recommendation != commitment`
5. **服务优先，不教育用户**

这意味着页面默认优先回答：

1. Helm 当前怎么看
2. 为什么这样看
3. Helm 已经推进了什么
4. 现在需要谁做什么决定
5. 用户可以立刻执行什么动作

### 4.1 "不要尝试教用户做事情"原则

**核心原则**：Helm 是服务系统，不是教育系统。

**禁止行为**：
- ❌ 在第一屏展示系统说明、架构解释或技术原理
- ❌ 用教学式文案解释"什么是ranking logic"、"什么是first loop"
- ❌ 在用户操作流程中插入系统介绍段落
- ❌ 用"帮助你了解"、"让你知道"等教学式语言

**正确做法**：
- ✅ 直接展示用户需要的操作和结果
- ✅ 将系统原理隐藏在"为什么这样判断"的次级层中
- ✅ 用户主动点击时才显示详细解释
- ✅ 用动作结果代替系统说明

如果一个页面先强调装饰、氛围或花哨卡片，而没有把上面 5 件事讲清楚，就不符合 Helm 的设计方向。

## 5. 视觉系统基线

### 5.1 色彩与对比度

默认原则：

- `light-first`
- `white / off-white + near-black + single accent` 为主
- 强调信息层次，不强调大面积风格色
- 状态色只用于状态，不用于装饰

当前推荐基线：

- 主背景：轻灰白、偏冷静，不用纯蓝黑或纯白死板背景
- 主文字：接近黑色，保证长文本和表格可读
- 主强调色：深蓝绿 / 深蓝灰一条主线即可
- success / warning / danger：保持克制，只在审批、风险、治理、状态变化里使用

**对比度强制要求**（v2更新）：
- 所有文本必须符合WCAG AA标准（对比度≥4.5:1）
- 深色模式下的选中状态必须保证文字与背景的高对比度
- 禁止使用"深色背景+黑色文字"的低对比度组合
- 状态指示器必须在深浅色模式下都清晰可辨

后续实现要求：

- 默认优先复用 `app/globals.css` 现有 token 家族：`--background`、`--surface`、`--accent`、`--border`、`--shadow-card`
- 不允许页面各自硬编码一套新主色
- 不允许引入多套竞争中的 accent 主线
- Demo 主题允许保留轻微区分，但必须降低饱和度和大色块占比

#### 5.1.1 颜色 token 映射规范（v3）

**禁止**直接在业务代码中使用 raw Tailwind 颜色 token（`text-slate-600`、`bg-amber-50`、`ring-rose-200` 等）。所有颜色必须走 CSS var，深浅模式才能在一处切换。

**标准映射表**（批量 codemod 使用此表）：

| 用途类型 | 旧硬编码 | 收敛到的 CSS var |
| --- | --- | --- |
| 主文字 / 标题 | `text-slate-{700,800,900,950}` | `text-[color:var(--foreground)]` |
| 次要文字 / 正文 | `text-slate-600` | `text-[color:var(--muted)]` |
| 弱辅助文字 / 占位 | `text-slate-{300,400,500}` | `text-[color:var(--muted-foreground)]` |
| 浅背景 | `bg-slate-{50,100}` | `bg-[color:var(--surface-subtle)]` |
| 中背景 / 占位条 | `bg-slate-200` | `bg-[color:var(--border)]` |
| 强占位条 / disabled track | `bg-slate-300` | `bg-[color:var(--border-strong)]` |
| 普通边框 / ring | `border-slate-200` / `ring-slate-200` | `border-[color:var(--border)]` / `ring-[color:var(--border)]` |
| 强边框 / ring | `border-slate-300` / `ring-slate-300` | `border-[color:var(--border-strong)]` / `ring-[color:var(--border-strong)]` |
| 状态文字（success） | `text-emerald-{700,800}` | `text-[color:var(--status-success-text)]` |
| 状态文字（warning） | `text-amber-{700,800}` | `text-[color:var(--status-warning-text)]` |
| 状态文字（danger） | `text-{rose,red}-{700,800}` | `text-[color:var(--status-danger-text)]` |
| 状态文字（info） | `text-{sky,blue}-{700,800}` | `text-[color:var(--status-info-text)]` |
| 状态浅背景 | `bg-{emerald,amber,rose,red,sky,blue}-50` | `bg-[color:var(--status-{success,warning,danger,info}-bg)]` |
| 状态边框 / ring | `border-{emerald,amber,rose,sky,blue}-{100,200}` | `border-[color:var(--status-{success,warning,danger,info}-border)]` |
| 强 status badge 底色 | `bg-emerald-700` / `border-emerald-700` | `bg-[color:var(--accent-success)]` |
| 强 status badge 底色 | `bg-rose-700` / `border-rose-700` | `bg-[color:var(--accent-danger)]` |
| 强 status badge 底色 | `bg-amber-700` / `border-amber-700` | `bg-[color:var(--accent-warm)]` |
| 强 status badge 底色 | `bg-sky-700` / `border-sky-700` | `bg-[color:var(--accent)]` |
| 警告文字（inline） | `text-amber-600` | `text-[color:var(--accent-warm)]` |
| 危险文字（inline） | `text-rose-600` | `text-[color:var(--accent-danger)]` |
| Dark inset 表面 | `bg-slate-{800,900,950}` | `bg-[color:var(--dark-inset-{overlay,surface,bg})]` |
| Dark inset 边框 | `border-slate-800` | `border-[color:var(--dark-inset-border)]` |
| Dark inset 文字 | `text-slate-{100,200}` | `text-[color:var(--dark-inset-{foreground,muted})]` |
| Indigo accent | `bg-indigo-{400,500}` / `border-indigo-{200,400}` | 复用 `var(--accent)` / `var(--status-info-border)` — Helm 不维护独立 indigo 主线 |
| Gradient stops | `from-slate-50` / `to-blue-700` 等 | 用任意值语法包对应 CSS var：`from-[color:var(--surface-subtle)]`、`to-[color:var(--accent-hover)]` 等 |

**人工评估保留区**（不可批量替换）：

- 带 opacity 修饰的颜色（`amber-400/20`、`emerald-400/15` 等）——视觉效果需保留时不强制收敛
- ESLint 自定义规则 `helm-design-tokens/no-raw-tailwind-color` 在 `eslint.config.mjs` 中注册为 warn 级别；CI 走 `lint:strict` 时升级为门禁。pre-commit 通过 husky + lint-staged 阻止新增违规。

**Dark inset 语义说明**：`--dark-inset-*` 系列是**固定深色卡片配色**，不随 light/dark 主题切换。仅用于"局部深色卡片"语义（demo emphasis cards、judgement glass cards）。如果某个 inset 应该跟随主题翻转，应改用 `--background` / `--surface` 等普通 token。

### 5.2 字体

默认方向：

- 正文：中文优先的现代无衬线，稳、清楚、长时间阅读不累
- 标题：可以更有力量，但不要戏剧化
- 等宽：只用于 trace、ID、时间、状态、审计、技术字段

当前要求：

- 如果不单独引入字体资产，继续使用当前全局 sans 栈即可
- 如果后续正式引入字体，优先做全局统一接入，不要在局部页面偷偷换字
- 等宽字体不要用于大段营销文案或大面积 UI 主标题

### 5.3 布局与密度

Helm 的布局应该是：

- 结构清晰
- 节奏稳定
- 信息密度中高
- 留白克制但不拥挤

默认约束：

- 用 `8px` 栅格思维组织间距
- 卡片之间靠层级和间距区分，不靠过量阴影
- 首页和营销页可以更开阔，但产品页不要做成“满屏漂浮卡片”
- dashboard / approvals / operating / detail 默认都应该支持较高信息密度

### 5.4 圆角、边框、阴影

默认风格：

- 圆角克制
- 边框优先
- 阴影次之
- 通过层级，而不是通过玻璃拟态制造高级感

后续要求：

- product surface 以 `12-16px` 圆角为主
- hero 或 framing 容器可略大，但不要形成“营销页一套圆角、产品页一套圆角”的割裂
- 优先用细边框和轻背景差建立分层
- 阴影只做层次辅助，不做视觉主角

### 5.5 动效

动效只承担 3 件事：

1. 引导层级进入
2. 反馈状态变化
3. 帮助用户理解上下文切换

默认不要做：

- 大幅飘浮
- 夸张视差
- 高频脉冲
- 与经营判断无关的装饰性 motion

### 5.6 图形与插画

优先级从高到低：

1. 数据、时间线、状态、链路、evidence
2. 结构化图标
3. 简洁示意图
4. 装饰插画

Helm 不是靠插画讲故事的产品。  
如果必须补视觉气氛，优先用版式、分层、渐变控制和结构化说明，而不是 stock illustration。

## 6. 页面类型规则

### 6.1 公开首页

首页应该更像“正式商用入口 + operating thesis”，而不是“AI 创业项目宣传页”。

默认首页结构优先级：

1. Helm 是什么
2. 为什么现在需要它
3. 它如何把 signal 变成推进链
4. 它如何保留审批、审计与正式复核
5. 它已经能服务哪些角色或场景
6. 再考虑 demo / signup / program CTA

首页视觉要求：

- 强对比标题，少空话
- 白底或浅底为主
- 一条主 accent，少量深色段落承接重点
- 用真实产品界面结构或 operating narrative 建可信度

明确不要：

- 紫色或霓虹渐变做主基调
- 一屏堆太多 floating badge
- 把首页做成 chat-first hero
- 用大量抽象球体或无意义光效代替产品解释

### 6.2 Dashboard / Operating Home

这是 Helm 的主判断面。

第一屏默认必须先回答：

1. 当前最重要的 3 件事
2. 当前最重要的 3 个阻塞
3. 当前最值得拍板的 3 个决定
4. 为什么系统这么判断
5. 下一步由谁接手

**v2简化原则**：
- **去除所有教学式内容**：不解释”什么是ranking logic”、”系统如何工作”
- **去除冗余系统说明**：不展示”Helm已为你准备”、”推进流程”等过程描述
- **精简到核心**：从950+行代码精简到~230行，去除75%的教育性内容
- **动作导向**：每个区块都直接指向用户可执行的动作

但在高频重复使用页面上：

- “为什么这样判断”
- “Helm 已经做了什么”
- 较长的 guidance / assist / rationale

默认应该收进 disclosure / drawer / 次级层，按需展开，而不是长期霸占第一屏主位。

页面局部如果仍然需要保留这类信息：

- 优先写成中性的 `review snapshot`、`in motion`、`current state`
- 不要在第一屏主位直接平铺 `What Helm already prepared / moved`
- 系统准备过程、解释过程和已做动作默认仍应落在 disclosure / backstage 层

默认不要让页面从：

- 长列表
- 搜索框
- 中性统计卡
- 空泛欢迎语

开始。

### 6.3 Approvals / Governance

这类页面必须更正式、更结构化，强调：

- 风险级别
- evidence
- approver
- 当前 posture
- official / draft / blocked / manual path 区别

视觉要求：

- 状态和层级一眼能分清
- CTA 清楚，不能混淆“建议”“审批通过”“正式写回”
- 审计与边界提示要看得见，但不能抢走主操作

### 6.4 Memory / Detail / Timeline

这类页面默认强调：

- 事实与推断分层
- promoted / draft / corrected / blocked posture
- chain、timeline、lineage、handoff
- 当前 object 为什么重要

视觉要求：

- 结构比装饰重要
- 时间线、证据块、source、correction 必须稳定
- 不要做成聊天消息流

### 6.5 Settings / Billing / Setup

这些页面默认应该：

- 干净
- 可扫描
- 权限和状态边界清楚
- 产品级，而不是后台级

注意：

- billing 是 product-grade summary，不是 finance console
- setup 是 onboarding，不是 marketing 延长页
- settings 不要因为“配置页”就退化成灰色表单后台

### 6.6 Demo Surface

Demo 可以保留角色差异，但必须服从同一套产品骨架：

- 同样的 shell
- 同样的 typography 逻辑
- 同样的 judgement-first hierarchy
- 更轻的模式色，而不是更重的主题 cosplay

## 7. 组件级固定要求

### 7.1 页面头部

一个合格的页面头部，至少要同时回答：

- 这页当前服务哪条经营判断
- 为什么现在看它
- 当前最关键动作是什么

页头不要只剩标题和副标题。

### 7.2 Summary / Judgement 卡片

Helm 的核心卡片默认优先包含这 4 层：

1. judgement
2. why
3. action
4. boundary

没有 boundary 的卡片，很容易把 recommendation 写成 commitment。

### 7.3 Status Pill / Badge

badge 只用于：

- posture
- status
- risk
- source trust
- review state

不要把 badge 当装饰图案滥用。

### 7.4 表格与列表

表格应该服务于：

- 扫描
- 比较
- 状态识别
- 批量处理

后续要求：

- 表格头部明确
- 行级状态清楚
- 重要列靠左
- 不要为了“更现代”把能做表格的东西全部改成卡片流

### 7.5 表单与动作栏

默认原则：

- 主动作单一明确
- 次动作退后
- 危险动作必须二次确认或明确隔离
- 审批、正式写回、limited auto、manual path 的文案不能互相混淆

### 7.6 图表与可视化

Helm 不追求花哨 BI。

图表默认只用于：

- 趋势
- 风险
- workload
- pipeline posture
- follow-through/readiness/readout

默认不要：

- 五颜六色图表
- 装饰性 3D 图
- 把图表当首页主角

## 8. 文案与标签规则

默认要求：

- 中文界面优先保证中文标签自然、短、准
- 英文界面优先保证简洁，不堆 AI 热词
- 页面文案优先讲判断、动作、边界，不讲空泛品牌腔
- 同一类动作必须长期用同一组词

尤其要避免：

- 把 `suggested`、`approved`、`sent`、`officially written` 混写
- 把 recommendation 文案写得像外部承诺
- 用夸张词汇掩盖系统其实还在 review posture

## 9. 明确禁止事项

后续 UI 改造默认不要做这些事情：

1. 把 Helm 做成 dark-mode-first 的开发者工具风格
2. 把紫色、荧光色、高饱和渐变变成主视觉
3. 把首页做成 chat app 或 prompt box 中心
4. 依赖玻璃拟态、发光描边、超重阴影制造“高级感”
5. 让每个页面自己发明一套局部颜色、圆角和卡片语法
6. 为了“高级”牺牲中文可读性、表格可扫描性和状态清晰度
7. 用装饰性图形覆盖 decision-first hierarchy
8. 把 settings / approvals / billing 做成灰暗后台，而把首页做成另一种完全不同的产品
9. 把 demo 模式色做得比产品主信息还强
10. 用新奇视觉掩盖当前能力边界

## 10. 实施约束

后续实际改造时默认遵守：

1. 先对齐 `DESIGN.md`，再动页面
2. 优先复用和收敛 `app/globals.css` 的现有 token，而不是平行再造一套
3. 新的颜色、间距、阴影、圆角、排版 token 必须先提升到共享层，再进页面
4. light theme 是当前 canonical truth；dark theme 是兼容层，不是审美中心
5. 任何页面都要优先维护 judgement / evidence / action / boundary 的层级
6. 如果新增了可复用的视觉模式，应同步回写这份文档，而不是只留在页面实现里

## 11. 默认改造优先级

后续如果按阶段推进，默认顺序是：

1. 公开首页、登录、setup framing
2. dashboard / operating home
3. approvals / governance / official follow-through
4. detail / memory / timeline / handoff
5. settings / billing / participant / programs
6. demo polish 与 mode-specific refinement

原因很简单：

- 先统一入口与主判断面，价值最明显
- 再统一正式复核层，可信度最明显
- 最后再做次级壳层和模式 polish，回报更高

## 12. 设计完成定义

一个页面改造完成，至少要满足：

1. 视觉方向和这份 `DESIGN.md` 一致
2. judgement-first / decision-first hierarchy 更清楚，而不是更模糊
3. 推荐、审批、正式写回、人工路径等边界表达更清楚
4. 共享 token 和共享组件复用更多，而不是更少
5. 中文可读性、按钮对比度、表格扫描效率没有退步
6. Demo 与非 Demo 的差异更可控，而不是更割裂

如果只做了局部好看，但没有让判断层级、治理边界或跨页一致性更清楚，就不算 Helm 意义上的完成。

---

## 13. v2 设计改进总结（2026-04）

### 13.1 核心设计原则更新

**"不要尝试教用户做事情"** 成为最高优先级设计原则

**背景**：
- 用户反馈系统过于冗长，大量教育性内容干扰操作
- Dashboard等核心页面存在"教学式"文案，违背服务系统定位

**改进**：
- ✅ 去除所有系统架构说明和教学式文案
- ✅ 将技术原理隐藏在次级层级，按需展示
- ✅ 用户界面从"解释系统"转向"直接服务"
- ✅ Dashboard从950+行精简到~230行（75%代码减少）

### 13.2 视觉可访问性改进

**问题**：
- 深色模式下选中状态对比度不足（深色背景+黑色文字）
- 用户反馈"眼睛看得很累"
- 浅色模式也存在对比度问题

**改进**：
- ✅ 所有状态强制符合WCAG AA标准（对比度≥4.5:1）
- ✅ 修复深色模式侧边栏选中状态的对比度
- ✅ 统一深浅色模式的色彩可读性
- ✅ 状态指示器在所有模式下都清晰可辨

### 13.3 用户流程简化

**登录流程**：
- ✅ 从复杂多步骤简化为：输入手机号 → 获取验证码 → 登录/注册
- ✅ 去除所有教育性面板和说明文字
- ✅ 直接动作导向，减少用户判断成本

**新用户引导**：
- ✅ 首页扫码后直接引导注册/登录，不做系统介绍
- ✅ 已登录用户直接进入工作流程，不显示冗余欢迎信息
- ✅ 错误提示从技术解释改为用户友好的解决方案

### 13.4 文案优化原则

**v2新增原则**：
1. **精准表述**：每个文案都要经过准确性检查
2. **吸引力**：用词要能激发用户行动意愿
3. **降低判断成本**：用户看到文案后立即知道该做什么
4. **去除冗余**：坚决删除所有多余表达和教育性内容

**具体改进**：
- i18n文案从说明式改为行动式
- 错误提示从技术语言改为用户语言
- 所有页面版面整齐，表达精炼

### 13.5 ROI边界

**优化停止点**：
- 当优化成本开始超过收益时停止改造
- 保持核心功能完整性，不过度简化
- 达到性价比平衡点后转向其他优先级

**达成指标**：
- 核心用户流程已简化
- 视觉可访问性符合标准
- 教育性内容已基本去除
- 用户操作路径清晰无阻碍

### 13.6 保留的边界

**仍然坚持**：
- judgement-first / decision-first 信息架构
- recommendation != commitment 的明确边界
- 企业级视觉定位（非开发工具、非聊天应用）
- 结构重于装饰的设计原则
- 高信息密度的operating界面

## 14. 设计语言统一基线：边界即组件（2026-07，借鉴 NPA Pack）

行业 Pack（NPA 催收工作台）在实践中把本文件的"边界必须可见"升级成了**可机器校验的组件系统**。这套做法回流为 Core 的统一设计语言基线，逐步应用到所有经营 surface。

### 14.1 已回流的组件

- **`components/shared/boundary-bar.tsx`（页级边界声明栏）**：三段式固定结构——①你看到的是什么 ②系统不会做什么 ③下一步由谁决定——外加显式负面清单 pill（如"无自动外发 / 无自动写回"）。**fail-closed**：文案缺段或负面清单为空串时渲染红色错误态并显示 errorCode，绝不静默降级成默认话术。
- **`components/shared/effect-mode-badge.tsx`（效果模式角标）**：每个被呈现的条目可声明 `suggestion_only / shadow_suggestion / human_action / receipt`，使"建议 ≠ 承诺 ≠ 回执"在视觉上不可混淆。未知模式渲染为显式 danger 态。

首个应用面：`/operating/tenant-health`（自身租户健康页）。

### 14.2 统一原则（来自 NPA 实践）

1. **边界是组件，不是段落**：边界声明用共享组件承载，文案结构受契约约束，可被测试与门禁断言（`data-boundary-bar` / `data-boundary-negative-item` / `data-effect-mode`）。
2. **fail-closed 的诚实呈现**：数据不足显式呈现"不足"态；解析失败"坏给人看"；禁止编造补位与静默默认。
3. **状态词收敛**：状态字面量以词表为真值，surface 不得自造状态词。
4. **禁止死链**：跳转目标未上线时渲染"目标未上线 + 原因码"占位，不产出链接。
5. **色彩纪律不回退**：Pack 层的 raw Tailwind 状态色（如 `bg-red-50`）在回流时一律改为 `--status-*` token；租户自定义 hex 永不进 Core。

### 14.3 逐步统一 roadmap

| 阶段 | 内容 |
|---|---|
| 已落地 | BoundaryBar + EffectModeBadge 组件与 tenant-health 首个应用面 |
| 下一步 | 高误解风险 surface 优先接入 BoundaryBar：`/approvals`、`/capture`、`/operating`；建议类列表逐步补 EffectModeBadge |
| 后续 | 评估五态就绪徽章（live / refit / planned / contract_only / no_go）在导航层的 Core 版本；状态词表机制 |

新增经营 surface 默认应带 BoundaryBar；建议/动作/回执混排的列表默认应带 EffectModeBadge。
