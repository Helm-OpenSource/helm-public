---
status: active
owner: helm-core
created: 2026-07-12
review_after: 2026-08-12
public_safety: Tenant-neutral design blueprint for the default operating workspace. Design-only; no implementation, no API freeze, no route deletion approval, no execution authorization. Contains no customer identifiers, private deployment information, or real tenant material.
---

# Helm 默认经营工作区重构蓝图 / Helm Default Operating Workspace Refactor Blueprint

> **语言 / Language**：**中文主文本** + English abstract
> **基线 / Baseline**：`origin/main@79ef569`（本文所有文件路径、行为描述与附录 A 页面清单均以该提交为准）
> **文档性质**：设计蓝图（design-only）。本文**不是**实现、**不是** API freeze、**不是**任何路由的删除批准、**不是**执行授权。方向批准与各阶段授权由私有 control-plane 的 owner gate 记录，本文不承载授权状态。

## English abstract

This blueprint proposes converging Helm's default workspace (52 `page.tsx`
surfaces under `app/(workspace)` at baseline `79ef569`) from an
entity-and-capability page catalog into a single operating mainline:
**signal → judgement → review → advance → evidence**. It defines a
tenant-neutral control-tower home, a role-routed workstation model, an
experimental (not frozen) surface-contract sketch for pack/overlay providers,
a three-class disposition of all 52 pages, and a gated multi-batch retirement
path with machine-generated cross-repo route-reference inventories. In this
document, "AgentOS" refers **only to an operating UI pattern** — it does not
claim an agent runtime, an orchestration platform, or any automatic execution
plane. Everything here is a design hypothesis pending conformance tests and a
UX baseline comparison; nothing in this document authorizes implementation,
route deletion, or external commitments.

## 0. 定位与边界

**为什么做**：默认工作区当前是"实体 + 能力"的页面陈列——52 个页面、读板（`/reports`）与写面（各工作区页）分屏、导航靠固定分段加扩展簇增殖。信息是"陈列"的，不是"推进"的。本蓝图把默认工作区收敛为一条经营主线，让默认界面回答"系统正在推进什么、哪里需要你拍板"，而不是"这里有哪些页面"。

**定性：收敛和升舱，不是推倒重来。** 现有基线里已有正确资产——`features/dashboard/home-work-entry.ts` 的"今天必须拍板"排序器、`components/layout/sidebar.tsx` 的三段分层（今天要处理 / 客户资产 / 复核与记录）、`<details>` 折叠的渐进披露。本蓝图把这些资产升舱为一等公民，收敛其余陈列面。

**证据地位（诚实声明）**：本范式来自一个私有行业 Overlay 的落地实践（下文以 *synthetic domain overlay A* 指代，细节不进入公开仓）。该实践提供的是**可迁移的设计假设和有限实践证据**；它是否适合作为 Core 默认范式，仍待本文 §3 的 conformance test 与 UX 基线对照验证。本文不声明"已验证的默认范式"。

**"AgentOS"一词的限定**：本文中 AgentOS 仅指一种 **operating UI pattern**（以经营主线、接管程度、注意力聚合为中心的界面组织方式）。它**不代表**完整 agent runtime、workflow / orchestration 平台或自动执行平面——这些仍在 [AGENTS.md](../../AGENTS.md) §3 "Helm 当前不是" 清单内。

**recommendation ≠ commitment**：本文所有界面与契约设计保持 review-first——任何贡献面只能展示数据或导航到既有人审流程；不存在自动写、自动发送、自动审批的设计空间（§7 红线）。

## 1. 范式定义（租户中立）

### 1.1 五原则

| # | 原则 | 含义 |
|---|---|---|
| 1 | **角色为中心** | 每个角色一个"工位家"。目的地按 重要性 × 频率 分三层：主区（每日核心，≤4 项）/ 次区（周期使用）/ 收纳（罕见与监督）。没有人再看全量页面平铺。 |
| 2 | **业务对象为中心** | 主线上的循环不丢上下文：对象（机会 / 客户 / 承诺）是主线，准备 → 动作 → 录结果 → 下一个 是对象上的就地动作，靠 objectRef 深链串起。**就地动作只存在于该能力的 canonical action owner 页面**；控制塔与一切贡献面只导航。 |
| 3 | **一能力一规范入口** | 读板与写面同处或互相深链；禁止"看在 A 页、做在 B 页"的读写分屏。 |
| 4 | **判断面 ↔ 事实面互链** | 任何 ref 出现处可点直达；决策卡挂证据引用，事实页可回判断面。 |
| 5 | **守红线** | recommendation ≠ commitment；review-first（按钮只导航或触发既有人审动作）；诚实降级（未接源说未接源、异常给诚实空态，不用假数据装满）。 |

### 1.2 默认经营主线

Core 默认主线 = **信号 → 判断 → 复核 → 推进 → 证据** 五节点经营循环。

选择理由：它对全部九类内置角色 preset（§附录 B）通用，且不预设行业。行业化的主线（例如"应收流水线样板""客户生命周期样板：获客 → 成交 → 交付 → 续费扩展""GTM 线样板"）是**可替换的默认样板**，由 Pack / Overlay 在 §4 契约下替换——"主线可替换"目前是**待 conformance test 验证的设计假设**，不是已证结论。

每个主线节点展示三件事：在途对象数、最老卡点时长、**接管程度徽标**。

### 1.3 接管程度徽标（四态，V1）

```
未接入 → 观察中 → 建议中 → 建议已就绪 · 待人工确认
```

这是本范式与页面陈列范式的核心视觉差异：节点展示的不是"信息"，而是"系统把这一环接管到什么程度、还差什么"。

**能力真值约束**：V1 词表**没有执行态**（无"代行中 / 自动执行"）。当前系统能力上限是"建议 + 人审"（AGENTS.md §6.6），徽标词表不得超过能力真值。执行态表达以真实执行链路存在为前提，且只能出现在拥有该链路的私有 Overlay 自己的页面内，不进入 Core 默认界面与公开契约。

### 1.4 角色解析算法

解析顺序（fail-safe 向低信息面）：

1. **授权先行**：页面可达性永远由 access probe / session 授权决定（`WorkspaceRole`：`OWNER / BILLING_ADMIN / ADMIN / OPERATOR / REVIEWER / MEMBER`，见 `prisma/schema.prisma`）。**导航与角色家只是路标，永远不授予页面权限。**
2. 有效 `rolePresetKey` 优先：内置九类直接映射（附录 B）；**custom preset 经 `basePresetKey` 归并到内置 role lens**（`lib/definitions/workspace-role-preset-catalog.ts` 已有该机制）。
3. `persona` / `title` 仅作展示提示，不参与授权，也不单独决定角色家。
4. 解析失败、无法识别、或任何异常：落**独立的 `GENERIC` 通用面**（最低信息面的通用落地页）。**不采用"回退 catalog 首项"**——现有 `resolveWorkspaceRolePresetKey()` 的首项回退不构成安全面，本蓝图要求为角色家路由单独定义 GENERIC 出口。

## 2. 新默认 home：控制塔

`/dashboard` 路由不变，内容重构为四段（自上而下）：

| 段 | 内容 | 数据来源（升舱自现有资产） |
|---|---|---|
| ① 经营主线（顶部摘要） | 北极星一行（目标 + 当前值，来自 workspace 配置）+ 五节点卡带（在途数 / 最老卡点 / 接管徽标）+ 复核横切徽章；点击钻取到节点对应工作台 | `/operating` 信号总盘、`/opportunities` / `/customer-success` / `/approvals` 计数 |
| ② 需要你拍板 | ≤3 张决策卡 + 阻塞浮起；保留 recommendation ≠ commitment 边界文案；每卡深链 `/approvals?approvalId=` 或对象工作台。异常（数据断流、复核积压超阈）在此浮起，不另设告警页 | 升舱复用 `features/dashboard/home-work-entry.ts` 排序器 |
| ③ 我的工位 | 按角色家目录渲染当前角色主区（≤4 入口）；非管理角色登录直接落工位家，控制塔对其为次区链接 | 附录 B 角色映射 |
| ④ 待复核的系统改进候选（默认折叠） | 三态分开展示：candidate（候选）/ accepted correction（已采纳修正）/ official memory（正式记忆）；点击进 `/memory`。现 dashboard `<details>` 内四个说明面板归并至此 | `/memory` 的 reflection / distillation 数据 |

**段序与红线**：经营主线可作顶部摘要，但**首个可操作区块必须是"需要你拍板"**；移动端首屏不得被 KPI / 主线卡带把拍板区块挤出视口。

**命名注记**：第④段刻意不叫"系统在学什么"——该措辞暗示自动学习。本系统的改进候选恒为 review-first：candidate 不会自动晋升为 official memory。

### 2.1 落地配置真值表

现有机制（`79ef569`）：`workspace.configuration.defaultLandingPath`（fail-closed 校验：仅站内绝对路径、拒协议 / 双斜杠 / `/dashboard` 自环）+ `/dashboard?stay=1` 逃生口（`lib/workspace-ops.ts`、`app/(workspace)/dashboard/page.tsx`）。

新增的 `controlTowerHome` **仅是 `/dashboard` 的内容开关**（渲染控制塔视图或旧版视图），**不新增第二套落地配置**。完整真值表见附录 E；关键不变式：

- 任何组合下 `/dashboard?stay=1` 都能到达 `/dashboard` 本体（逃生口永不失效）；
- 不存在"配置合法但控制塔永远不可达"的组合；
- `defaultLandingPath` 非法值按现有 fail-closed 规则视同未配置。

### 2.2 冷启动与诚实降级（三态）

| 状态 | 展示 |
|---|---|
| 未接入 | 主线卡带以灰态骨架显示五节点名（传达范式本身），每节点徽标"未接入"；整屏唯一主动作 = **"完成初始化诊断 → `/setup`"**（L0/L1 诊断先行，由 setup 流程引导至 L2 只读接入——遵守 [数据接入体验](HELM_DATA_INTAKE_EXPERIENCE.md) 的 source-intake-first 契约，不直跳 `/imports`）；②段显示"还没有需要你拍板的事——接入数据后 Helm 会把第一批判断排到这里"；④段隐藏；北极星未配置显示"未设定目标 → 去设置" |
| 接入中 | 节点徽标"观察中"，显示 import job 进度（`/imports/jobs` 已有）；**不显示任何推断出的指标** |
| 异常 | 诚实空态（"数据暂不可用，最后成功于 X"）；demo 数据只在显式 demo mode 下出现，永不冒充真实数据填空 |

## 3. 层级选项与分期

### 3.1 两个层级选项

- **选项 A：Core 本体重设计**。直接重写 `/dashboard` 与 sidebar，主线 / KPI / 注意力硬编码为 Core 默认实现，不扩展公开契约。改动面小，但范式焊死在 Core 页面里：下一个需要控制塔的 Pack / Overlay 只能整页替换 + 私有 shell hack，hack 数量随租户线性增长。
- **选项 B：框架化**。§4 的 surface 契约进入 `PackContributions`，Core 自身作为第一个（fallback）provider，私有 Overlay 迁移为消费者，私有 shell hack 退役。可演进性最好，但契约有抽错形状的风险，一旦进入公开仓即有兼容包袱。

**推荐：B，但分期执行；A 的全部工作量是 B 第一期的子集。** "A 是 B 的严格前缀"是**条件式成立**的：仅当 Phase 1 同时落齐 ①内部契约类型 ②冲突语义 ③conformance tests 三件，后续才能无返工升级到 B。层级最终取舍与各期推进由私有 owner gate 逐道授权，本文不预设结论。

### 3.2 分期

- **Phase 0（前置，动 Core shell 之前必须完成）**：
  1. Core 落中立 **shell-experience seam**（§3.3），替代任何依赖 Core shell DOM 结构的私有 CSS 隐藏手段；已知存在此类依赖的私有 Overlay 先迁移到 seam 并验证观感不变，之后才允许改 Core shell 结构。
  2. 在**现有界面**上采集 UX 任务基线（§3.4 事件一）。
- **Phase 1**：控制塔四段替换 `/dashboard` 内容（`controlTowerHome` 开关，旧视图为回滚态）；sidebar 从固定三段清单改为消费角色家目的地目录；Core 默认 provider 是唯一数据源，契约类型**内部化**（放 `lib/extensions/registry-types.ts` 内部，不扩 `PackContributions`，零对外承诺）；同时落内部冲突语义与 conformance tests。
- **Phase 2**：把已被真实页面消费过的三个 surface（`northstarKpiSources` / `attentionSources` / `mainline`）开放进 `PackContributions`，**显式标注 `experimental`**。契约冻结（去掉 experimental）**必须等第二个真实外部消费者**——Core 默认 provider 加一个私有 Overlay 不构成两个独立消费者。
- **Phase 3**：`roleHomeRouting` + `workstations` 进契约。改进循环（improvement loop）与急停类能力**保持 Overlay 级**，不进公开契约（§4.1）。

每道 Phase 在私有 owner gate 设独立授权门；本文档不隐含任何一期的启动授权。

### 3.3 shellMode（中立 shell-experience seam）

- **不是布尔**。声明维度至少含：chrome 形态（`full` / `rail` / `none` 之类的枚举，定稿时敲定）× Topbar 是否保留。
- **优先级**：Core-owned route 声明 > workspace 配置 > Core 默认。**route 声明优先仅限 Core-owned route**：Pack / Overlay 的 route 声明不得获得隐藏全局导航的能力——越权声明被忽略并记录回执。
- **失败语义**：非法值、无权限 provider、解析异常，一律恢复**完整 Core chrome**（fail-safe 向完整导航，不向 chromeless）。

### 3.4 UX 验收：三个事件（基线采集 ≠ 验收通过）

1. **Phase 0 期间 · 采集基线**：在现有界面上，由交付工程师与代表性角色完成任务集：登录 → 首个判断、provider 冲突诊断、Core 回退、移动端拍板区可见性、`/setup` 冷启动。记录五项指标：完成率 / 中位时间 / 错误入口数 / 回退成功率 / 边界理解结果。
2. **开发前 · 固定阈值**：owner 在候选方案开发前固定五项指标的验收阈值（私有 owner gate 记录）。
3. **Phase 1 合并前 · 对照判定**：候选界面与基线对照，五项指标全部过阈值才通过 UX 门。

## 4. Surface 契约草案（experimental，未冻结）

> 本节全部类型为**草图**，Phase 1 内部化验证后才进入 `PackContributions`；进入时标 `experimental`。所有草图沿用现有 `registerPackContributions` 注册机制与 access probe 超时包装（`lib/extensions/registry-contract.ts`、`registry.tsx`），不发明第二套注册体系。

### 4.1 铁律（先于一切字段设计）

1. **只读或只导航**：所有 surface 条目只有数据字段与 `href`（导航到既有人审流程）。**contribution descriptor 类型中不存在动作回调字段**。门禁在契约层用**类型系统或 AST 检查**拦截 descriptor 内的函数型动作字段——不做源码文本"禁 `on*`"（那会误伤折叠、键盘交互等正常 UI 代码）。
2. **三态禁造数**：`measured | pending_source | no_data` 是契约级要求；provider 不得用推断值冒充 measured。
3. **无急停契约**：公开契约不表达"急停 / 停止执行"能力（Core 本体没有自动执行链路，展示急停即虚假能力宣称）。至多允许只读的 `SafetyPostureReadout`（当前安全姿态陈述，无控制语义）。急停的写路径完全留在拥有执行链路的私有 Overlay 自有 routes / apiRoutes。
4. **改进循环不进公开契约**：状态机语义强绑定私有运维通道，等第二个真实需求出现再评估（V2 候选）。
5. **workstation 页面本体不进契约**：契约只登记"存在哪些工位、谁的家在哪、导航怎么显示"；工位页面继续走既有 overlay routes 构建机制。
6. **PII 仅 ref、金额只给分档**（`currency_band`，无原始金额字段）；**无个人排名形状**（needsHuman 等计数聚合到 team / node 级）。

### 4.2 类型草图

```ts
type ShellReadoutStatus = "measured" | "pending_source" | "no_data";
type MainlineNodeStage = "unbound" | "observing" | "suggesting" | "suggestion_ready_pending_human";

type MainlineNode = {
  key: string;
  label: string;               // provider 侧本地化
  stage: MainlineNodeStage;    // §1.3 四态；无执行态
  status: ShellReadoutStatus;
  inFlightCount: number | null;
  oldestBlockedRef: string | null;   // 仅 ref，不含 PII
  needsHuman: number | null;         // team/node 级聚合，无个人排名
  href?: string;                     // 只导航
  basisRef: string;                  // 证据引用
};

type MainlineDescriptor = {
  providerId: string;
  contractVersion: string;     // 不兼容版本不得进入候选集
  priority: number;            // 仅诊断排序 / 候选推荐；不参与运行时自动接管
  provenance: string;
  getAccess: ExtensionAccessProbe;   // 复用现有 2500ms 超时包装
  buildMainline(input: { workspace: WorkspaceLike; english: boolean }): Promise<{
    asOfRef: string;
    nodes: ReadonlyArray<MainlineNode>;   // 建议 4–8 节点
  }>;
};

// northstarKpiSources / attentionSources：可合并（多 provider concat）
// mainline / roleHomeRouting：单一生效 provider（绑定授权模型见 4.3）
```

`AttentionItem`（severity / label 已脱敏仅 ref / roleCategory 过滤 / href 只导航 / basisRef）、`NorthstarKpi`（unit 含 `currency_band` 无 raw currency、direction、status 三态）、`RoleHomeRoute`（roleCategory → control_tower | workstationKey，fallback 必填且指向 GENERIC 面）、`WorkstationDescriptor`（key / label / href / roleCategories）同理，定稿于 Phase 1 内部化时。

### 4.3 单一生效 provider 的绑定授权模型

**原则：绑定即授权；无绑定即 Core。**

1. **无显式、有效、surface-scoped 的绑定时，一律使用 Core default provider。** Core default 是 fallback，不参加任何竞争。`priority` 仅用于诊断排序与管理员候选推荐，**不参与运行时自动接管**。
2. 候选进入"可绑定列表"的前提：enabled + access probe 通过 + compatibility gate + `contractVersion` 兼容。
3. **绑定操作的授权走 capability evaluator**：最小兼容方案复用 `MANAGE_WORKSPACE_SETUP`（`lib/auth/authorization.ts`；现有 extension 启停已用该 capability 并写审计，见 `features/settings/solution-extension-actions.ts`）。`WorkspaceRole.OWNER` 是治理责任人；实际操作者由 capability 判定。若未来收紧为 OWNER-only，须写显式新策略 + 拒绝矩阵，不使用模糊的"管理员级"表述。
4. 绑定失效、越权、版本不兼容 → 回退 Core default + **冲突回执**（诊断可见）；绑定变更写审计。
5. 同一 surface 出现多个"最高推荐"候选时不自动择一：维持 Core default 并产生冲突回执，等待显式绑定。

### 4.4 attention 聚合器工程语义

- 并发收集，**单源超时 2500ms** + **聚合总 deadline**（首屏预算内返回已到达源，未返回源以"来源 X 未返回"条目显示）；
- **最大 source 数与并发上限**显式配置；AbortSignal 贯穿取消；
- 跨源**去重规则**（item key 规范）定稿于 Phase 1；
- **缓存隔离**：缓存键 = `workspaceId + subject/access fingerprint + locale + sourceId/version + 时间窗`；只缓存可序列化数据（**不缓存 ReactNode、不缓存授权结果**）；**权限变化触发缓存失效**；每次读取重做权限检查（subject 上下文取自现有 access contract，`lib/extensions/registry-types.ts`）。
- 读侧统一入口 `resolveShellExperience()`；每个新 surface 配 core-only 镜像平价测试（空 store = Core 默认体验完整可用）。

## 5. 52 页三类处置

对基线 `79ef569` 的全部 52 个 `app/(workspace)` 页面，按三类处置（逐页表见附录 A）：

- **A 类 · 升舱为新范式一等公民**（约 10 个能力面 / 20 个文件）：`dashboard`（控制塔本体）、`operating`（信号层供体；`gtm-leads` / `tenant-health` 为 Helm reserved 工位）、`approvals`（复核工位，**永不进入退役批次**——review-first 红线的载体）、`opportunities`（推进工作台）、`customer-success`（交付工作台）、`inbox` / `meetings`（推进工作台动作源，撤独立导航）、`memory`（改进候选证据基座）、`imports`（接入面 = 冷启动一等公民）、`settings`。
- **B 类 · 事实面保留**（约 21 个能力面）：撤出一切导航、仅深链可达，作为判断的证据面。含 `companies` / `contacts` / `conversations/[id]` / 八个共用同一机会商业详情数据源的 `[id]` 页（长期向 `assets` 规范详情或工作台抽屉归一）/ `reports`（**扩展宿主不可破**：`/reports?tab=` 深链契约原样保留）/ `search` / `analytics` / `diagnostics` / `capture` / `mobile`（待人工审计定 B 或 C）。
- **C 类 · 退役**（5–6 个）：`founder-qa/[id]`、`sales-followups/[id]`、`sales-objections/[id]`、`delivery-reviews/[id]`、`delivery-walkthroughs/[id]` 五个已核验的纯 redirect 兼容壳（各约 11 行，仅 `redirect()` 到 `/conversations/[id]` 或 `/follow-ups/[id]`）+ `mobile`（若审计为演示壳）。

**C 类 redirect 壳是迁移适配器，不是普通死代码**：处置路径是"首批进入 deprecation + 访问观测，**最后一批物理删除**"。物理删除条件：≥2 个已发布版本 + 替代入口稳定 + 部署方访问证据 + 动态审计队列清零。**在仓库形成稳定发布单位（发布构建 / minor / major，定稿时敲定）之前，不物理删除任何低成本 redirect。**

**退役路由善后**：不用裸 404 兜底——保留 route-specific redirect 或 **retired-route tombstone registry**（旧路径 → 替代入口映射，含退役版本与理由）。

## 6. 退役路径与删除门

### 6.1 跨仓 route-reference inventory（删除证据的唯一来源）

深链依赖**只以机器生成的 inventory 为准**，不以任何一次性 grep 结论为准（已知教训：真实依赖存在于 `.mjs` 构建脚本、校验脚本与文档中，且跨仓存在）。

组合模型：

- 本仓（Core）只产出 **Core 自身的 inventory**；不反向扫描任何 Pack / Overlay 仓。
- 各 Pack / Overlay 仓各自产出自身 inventory（进各仓 CI）。
- 私有 control-plane 按各组件的 **immutable BOM SHA** 合成最终依赖图。
- 扫描文件类型至少覆盖：`ts / tsx / js / jsx / mjs / cjs / json / yaml / yml / md / mdx`。
- 输出按类分档：route definition / 静态入边 / redirect / 测试与文档引用 / **动态未解析队列**（运行时拼接等无法静态解析的路径）。

**inventory manifest（versioned，防漏仓）**：每份 inventory 附 manifest，字段见附录 C。合成方对每个 BOM 组件校验 SHA 与 manifest 完整性；**缺失、过期、schemaVersion 不兼容、SHA 不匹配，一律阻断删除**（缺 inventory ≠ 零入边）。`scanPolicyDigest` 由合成方对照统一扫描策略校验——**不无条件信任各仓自行声明的 `ignoredGlobs`**。

**豁免治理**：豁免项必须带 `owner / reason / expiry / routeId`（模板见附录 D）。**动态未解析队列不可豁免**——每项必须产出 resolution receipt（记录它被解析为静态边、route definition、还是确定的非路由文本），不允许只改状态清零。

### 6.2 删除门（四条全绿才可物理删除）

1. 合成依赖图**非豁免入边为零** + 全部 manifest 校验绿 + 动态未解析队列 resolution receipt 清零；
2. 页面访问遥测**覆盖率门禁生效后** ≥2 个版本窗口无真实访问。**诚实声明**：基线上仅 19 / 52 个页面文件直接记录 page view，且事件落各部署自身数据库、自托管部署不回传——访问证据永远是**必要非充分**条件。前置工程：稳定 `routeId / routeTemplate`（消除动态段与 query 造成的统计碎片）+ 全页面覆盖率门禁；
3. 承接映射有落点（旧页 → 新范式承接处，一页一行）且替代面上线满一个版本；
4. 双语文案 / docs / demo quickPath 无死链 + tombstone registry 登记完成。

### 6.3 批次

| 批 | 内容 | 回滚 |
|---|---|---|
| 0 | 审计基线：inventory 工具链 + manifest 校验 + routeId / 覆盖率门禁工程；`/setup`、mobile、operating 数据真值的待审计项清零 | 不动 UI，无需回滚 |
| 1 | 立新 shell（只加不删）：控制塔替换 `/dashboard` 内容（`controlTowerHome` 开关）、角色家目的地目录落地、sidebar 改消费目录 | featureFlag 一键回旧视图 |
| 2 | 导航收敛：B 类全部撤出导航；C 类进入 deprecation + 访问观测 | 目的地目录是数据，revert 目录即回滚导航；页面文件未删 |
| 3 | 工位合并：`opportunities` 吸收 `proposals` 列表；`inbox` / `meetings` 并入工作台动线；商业详情 `[id]` 页逐个向抽屉 / `assets` 规范详情归一（每归一一个，旧路由改 redirect） | 恢复 redirect 指向 |
| 4 | 残余下线 + C 类最后物理删除（删除门四条全绿） | 每批独立 PR，git revert per-batch |

配套守卫：`validate-core-page-retirement`（inventory 行完整性 + 删除门状态机检查），仿现有 workspace inventory 校验先例。

## 7. 红线清单

1. **契约层无动作回调**：类型 / AST 门禁，不做源码文本 ban。
2. **首个可操作区块 = 需要你拍板**；`approvals` 永不进退役批次；移动端首屏约束（§2）。
3. **fail 语义方向性**：信息展示 fail-open（降级面板不空屏）；角色路由 fail-safe 向低信息面（GENERIC）；shellMode 异常恢复完整 Core chrome；单一生效 provider 无绑定或冲突一律回 Core。
4. **公开仓红线**：零客户专属标识、零私有部署信息、零真实租户材料（多租户通用术语不受限）。本文档自身即受检对象；`check:public-release` 是机器化执行通道。
5. **能力真值**：徽标与契约词表无执行态；建议态不得写成执行态。
6. **PII 仅 ref；金额只给分档；无个人排名。**
7. **review-first**：一切贡献面只导航或触发既有人审动作；不新增自动写 / 发 / 批的任何表面。

---

## 附录 A：52 页逐页处置表（基线 `79ef569`）

清单由 `git ls-tree -r --name-only 79ef569 -- 'app/(workspace)'` 过滤 `page.tsx` 生成（52 行，字典序）。处置：A=升舱 / B=事实面 / C=退役 / infra=路由基础设施。

| # | 页面（`app/(workspace)/` 下） | 类 | 处置说明 |
|---|---|---|---|
| 1 | `analytics/page.tsx` | B | 使用面板证据页；撤导航收纳 |
| 2 | `approvals/page.tsx` | A | 复核工位；红线载体，永不退役 |
| 3 | `assets/[assetType]/[assetId]/page.tsx` | B | 事实面规范形态；`[id]` 详情页长期归一目标 |
| 4 | `capture/page.tsx` | B | 就地采集入口；从工作台深链 |
| 5 | `commercial-strengthening/[id]/page.tsx` | B | 机会商业详情切面；候选归一为工作台抽屉 |
| 6 | `companies/[id]/page.tsx` | B | 客户档案证据面 |
| 7 | `companies/page.tsx` | B | 列表撤导航，搜索 / 工作台深链进 |
| 8 | `contacts/[id]/page.tsx` | B | 同上 |
| 9 | `contacts/page.tsx` | B | 同上 |
| 10 | `conversations/[id]/page.tsx` | B | C 类 redirect 壳的目标页；证据面 |
| 11 | `customer-success/[id]/page.tsx` | A | 交付工作台详情 |
| 12 | `customer-success/page.tsx` | A | 交付工作台（队列模型已有） |
| 13 | `dashboard/page.tsx` | A | 控制塔本体；路由与 `#employee-assignment-actions` 锚点、`entry` / connector 参数契约保留 |
| 14 | `delivery-reviews/[id]/page.tsx` | C | 纯 redirect 壳 → `/conversations/[id]` |
| 15 | `delivery-walkthroughs/[id]/page.tsx` | C | 纯 redirect 壳 → `/conversations/[id]` |
| 16 | `diagnostics/page.tsx` | B | 健康证据面；已有 featureFlag 门控 |
| 17 | `expansion-reviews/[id]/page.tsx` | B | 交付工作台证据面 |
| 18 | `external-narratives/[id]/page.tsx` | B | 机会商业详情切面 |
| 19 | `external-proposals/[id]/page.tsx` | B | 同上 |
| 20 | `follow-ups/[id]/page.tsx` | B | 对象就地动作证据面 |
| 21 | `founder-qa/[id]/page.tsx` | C | 纯 redirect 壳 |
| 22 | `imports/conflicts/page.tsx` | A | 接入面（冲突处理） |
| 23 | `imports/crm/page.tsx` | A | 接入面 |
| 24 | `imports/jobs/[id]/page.tsx` | A | 接入进度（冷启动"接入中"态数据源） |
| 25 | `imports/page.tsx` | A | 接入面主页；收纳层但被冷启动直接指向（经 `/setup`） |
| 26 | `inbox/[id]/page.tsx` | A | 推进工作台动作源详情 |
| 27 | `inbox/page.tsx` | A | 推进工作台动作源；撤独立导航 |
| 28 | `meetings/[id]/page.tsx` | A | 推进工作台动作源详情 |
| 29 | `meetings/page.tsx` | A | 推进工作台次区；撤独立导航 |
| 30 | `memory/page.tsx` | A | 改进候选证据基座（控制塔④段目的地） |
| 31 | `mobile/page.tsx` | B* | 待人工审计 + 部署方访谈定 B 或 C |
| 32 | `offers/[id]/page.tsx` | B | 机会商业详情切面 |
| 33 | `operating/gtm-leads/page.tsx` | A | Helm reserved 工位（门控已有） |
| 34 | `operating/page.tsx` | A | 信号总盘 = 主线卡带数据供体；注意其数据仍含演示态，接真数据是前置工程（待审计） |
| 35 | `operating/roles/[role]/page.tsx` | B | 信号层深链证据面 |
| 36 | `operating/signals/[signalKey]/page.tsx` | B | 同上 |
| 37 | `operating/tenant-health/page.tsx` | A | Helm reserved 工位（门控已有） |
| 38 | `opportunities/page.tsx` | A | 推进工作台本体；吸收 `proposals` 列表 |
| 39 | `packages/[id]/page.tsx` | B | 机会商业详情切面 |
| 40 | `page.tsx`（workspace 根） | infra | `redirect("/dashboard")`；保留 |
| 41 | `proposals/[id]/page.tsx` | B | 详情留深链 |
| 42 | `proposals/page.tsx` | B | 列表撤导航并入推进工作台 |
| 43 | `reinforcements/[id]/page.tsx` | B | 机会商业详情切面 |
| 44 | `reports/page.tsx` | B | **扩展宿主不可破**；`/reports?tab=` 契约原样保留；shared tab 降级为证据面 |
| 45 | `review-requests/[id]/page.tsx` | B | 复核工位证据详情 |
| 46 | `sales-followups/[id]/page.tsx` | C | 纯 redirect 壳 → `/follow-ups/[id]` |
| 47 | `sales-objections/[id]/page.tsx` | C | 纯 redirect 壳 → `/conversations/[id]` |
| 48 | `search/page.tsx` | B | Cmd+K 兜底；撤导航 |
| 49 | `sendability/[id]/page.tsx` | B | 机会商业详情切面 |
| 50 | `settings/extensions/page.tsx` | A | 收纳层保留 |
| 51 | `settings/page.tsx` | A | 收纳层保留 |
| 52 | `success-checks/[id]/page.tsx` | B | 交付工作台证据面 |

## 附录 B：角色家映射全表

授权先行：下表只决定"默认落地与主区内容"，不授予任何页面权限（权限由 `WorkspaceRole` + capability 决定）。

| rolePresetKey | 角色家 | 主区（≤4） |
|---|---|---|
| `FOUNDER_CEO` | 控制塔 | 主线卡带 · 需你拍板 · 复核队列 · 周期复盘深链 |
| `SALES_LEAD` | 推进工作台（管理镜头） | 机会队列 · 需拍板（销售域过滤） · 会议 · 复盘深链 |
| `ACCOUNT_EXECUTIVE` | 推进工作台 | 我的机会队列 · 今日会议 · 收件推进 · 我的承诺 / 跟进 |
| `RECRUITER` | GENERIC 通用面 | Core 默认无招聘工位（诚实标注）；收纳导航 + 搜索 |
| `CUSTOMER_SUCCESS` | 交付工作台 | 交付队列 · 续费 / 扩展复核 · 成功检查 · 客户档案深链 |
| `DELIVERY_LEAD` | 交付工作台（管理镜头） | 交付队列 · 复核 · 成功检查 · 复盘深链 |
| `PRODUCT_ENGINEER` | GENERIC 通用面 | diagnostics · memory 次区；无专属工位（诚实标注） |
| `OPERATIONS_FINANCE` | 复核工位 | approvals 队列 · memory 记录 · imports / settings 收纳 |
| `GENERAL_OPERATOR` | GENERIC 通用面 | 收纳导航 + 搜索 + 需拍板（其可见子集） |
| custom preset | 经 `basePresetKey` 归并到上表对应 lens | 同对应行 |
| 解析失败 / 异常 | GENERIC 通用面（fail-safe） | 最低信息面 |

## 附录 C：inventory manifest 规范

每份 route-reference inventory 必须附带：

```json
{
  "repositoryId": "…",
  "commitSha": "…",
  "schemaVersion": "…",
  "scannerVersion": "…",
  "scannedGlobs": ["…"],
  "ignoredGlobs": ["…"],
  "unresolvedCount": 0,
  "contentDigest": "…",
  "scanPolicyDigest": "…"
}
```

合成方校验规则：每个 BOM 组件的 manifest 必须存在、`commitSha` 与 BOM pin 一致、`schemaVersion` 兼容、`contentDigest` 与 inventory 内容一致、`scanPolicyDigest` 与统一扫描策略一致（各仓自报的 `ignoredGlobs` 不被无条件信任）。任一不满足 → 阻断删除。

## 附录 D：豁免与 resolution receipt 模板

豁免项（仅静态入边可豁免）：

```json
{ "routeId": "…", "edgeRef": "…", "owner": "…", "reason": "…", "expiry": "YYYY-MM-DD" }
```

动态未解析队列不可豁免；每项必须产出：

```json
{ "ref": "…", "resolvedAs": "static_edge | route_definition | non_route_text", "evidence": "…", "resolver": "…", "resolvedAt": "…" }
```

## 附录 E：落地配置真值表

变量：L = `defaultLandingPath`（合法配置 / 未配置或非法）；C = `controlTowerHome`（开 / 关）；S = 访问 `/dashboard` 时是否带 `?stay=1`。登录后落点由 L 决定（现有机制）；C 只决定 `/dashboard` 渲染哪套视图。

| L | C | S | 行为 |
|---|---|---|---|
| 未配置/非法 | 关 | 任意 | 落 `/dashboard`，渲染旧版视图（现状） |
| 未配置/非法 | 开 | 任意 | 落 `/dashboard`，渲染控制塔 |
| 合法 | 关 | 无 | `/dashboard` 重定向到 L；L 页面自身与 C 无关 |
| 合法 | 关 | 有 | 停留 `/dashboard`，渲染旧版视图（逃生口） |
| 合法 | 开 | 无 | `/dashboard` 重定向到 L（**L 优先于 C**：显式租户配置压过内容开关，控制塔经 `?stay=1` 或撤销 L 可达） |
| 合法 | 开 | 有 | 停留 `/dashboard`，渲染控制塔（逃生口 + 新视图） |

不变式：`?stay=1` 永远停留 `/dashboard`；不存在"C 开但控制塔不可达"的组合（最少经 `?stay=1` 可达）；L 的非法值按 `resolveWorkspaceDefaultLandingPath` fail-closed 规则视同未配置。

## 变更记录

- 2026-07-12：首版。设计蓝图（design-only）；基线 `origin/main@79ef569`；经五轮只读评审收敛（评审记录与方向批准状态在私有 control-plane owner gate）。
