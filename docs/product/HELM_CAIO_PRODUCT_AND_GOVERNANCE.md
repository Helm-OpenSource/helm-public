---
status: active / frozen-terminology-adr
owner: helm-core
created: 2026-07-21
review_after: 2026-08-21
public_safety: Public-safe product terminology and governance ADR. It contains no customer data, credential, private deployment fact, production receipt, or activation authority; nothing in this document grants any system permission.
---

# Helm CAIO 产品与治理口径 / Helm CAIO Product and Governance ADR

> **语言 / Language**：中文主文本 + [English reference](HELM_CAIO_PRODUCT_AND_GOVERNANCE.en.md)

## 1. 结论

本文件冻结 Helm 的对外产品口径与治理定义：

- 中文品牌：**Helm CAIO｜一号位 AI 经营中枢**
- 角色定义：**企业首席 AI 高管，直属并只向 CEO 汇报**
- 英文品牌：**Helm CAIO — the AI executive reporting to the CEO**
- CAIO 是产品角色标签，**不作英文缩写展开**；任何客户可见面不得出现缩写展开形式。
- 旧口径 `AI COO` / `数字 COO` 停止在新增客户可见内容中使用；既有历史机器标识
  全部保持不变（见 §6 兼容映射）。

本文件是术语与治理的**唯一公开真值**；它本身不授予任何系统写权限、外部副作用
权限或生产激活状态。

## 2. 角色定义（冻结）

1. CAIO 是企业 AI 组织的最高负责人，统领领域 Agent。
2. 成熟阶段可在 CEO 签发的预授权范围内，直接向人员和 Agent 派发 Work
   Packet、监督回执和调整编排。本条描述的是**成熟阶段的目标形态**，不是当前
   已成立的能力（见 §4 成熟度阶段）。
3. 人员可以结构化拒绝、暂停和申诉，且不因此受到报复性处置。
4. CAIO 指令与人类管理指令冲突时，任务暂停，只升级 CEO 裁决。
5. CEO 指定的监护角色可以紧急停止 CAIO，但不能恢复；恢复权仅属于 CEO。
6. CAIO 不是公司法意义上的自然人高管，不转移 CEO、COO、CIO 和业务负责人的
   法定责任。
7. CAIO 角色定义本身不授予任何系统写权限或外部副作用权限。

## 3. 治理不变式

以下不变式对所有实现（类型、契约、界面、文档）具有约束力：

- **汇报关系不等于授权关系**。“直属并只向 CEO 汇报”只定义组织汇报线，不构成
  任何权限来源；CEO 也不能借由汇报线绕过独立监督、政策门禁或审计要求。
- **阻断优先级**：法律与政策约束、人员同意、监护急停 > CEO 指令 > CAIO 建议。
  CEO 指令与法律、政策、人员同意或已触发的急停冲突时，冲突项阻断，任务暂停。
- **授权只能显式签发**。任何 CAIO 授权（mandate、envelope）必须由 CEO 显式
  签发并可撤销；**不从既有 owner approval 继承**、复制或推导。任何既有
  owner approval（包括历史能力元数据注册批准）只批准其原始范围，不构成
  CAIO mandate 批准，也不构成 runtime 授权。
- **建议不等于承诺**。CAIO 的任何输出（建议、解释、方案、汇报）都不构成对外
  承诺；任何承诺必须经既有的独立授权、政策门禁与人工复核链路产生。成熟阶段、
  mandate 或 CEO 汇报线都不改变这一点。
- **监护角色只停不启**：监护急停立即生效；恢复权仅属于 CEO。
- **双签必须独立**：要求双人批准的决定，两个批准者必须是相互独立的角色，
  不能是同一人或同一角色的两个别名。
- **人员响应权**：人员对 CAIO 派发内容的结构化拒绝、暂停和申诉是治理契约的
  一等公民；申诉记录必须可审计，且不得作为负面评价依据。
- **CAIO 角色/授权对象不是权限令牌**：权限系统、路由、API、执行状态机不得把
  CAIO 角色定义或 CaioMandate 对象当作授权依据。

## 4. 能力成熟度阶段（成熟度轴，不是权限轴）

```text
Observe
→ Advise
→ Supervise
→ Orchestrate
→ Authorized Execute
```

这是**产品能力成熟度轴**，用于诚实声明“产品当前长到了哪一步”。它**不是权限
枚举、不是自动化等级、不是运行状态机**：

- 禁止对阶段做序数比较后据此放行任何行为。
- 禁止把阶段映射/转换为既有 `observer → shadow → active` 自动化等级、
  `DecisionActionLevel`（`observe/recommend/draft_task/shadow/active_candidate`）
  或任何权限、路由、执行状态。
- 阶段声明只影响展示与文档口径，不影响任何运行时行为。

当前诚实口径（每阶段携带独立证据状态 `formed | next_layer | roadmap_disabled`）：

| 阶段 | 证据状态 | 口径 |
|---|---|---|
| Observe | `formed` | 公共参考切片已成形（Stage 1 Owner Loop 只读观察与拍板闭环），仍需真实部署层 |
| Advise | `next_layer` | 契约基础已成形（决策/监督契约），产品闭环仍需下一层 |
| Supervise | `next_layer` | 契约与合成证据已成形，真实运行闭环未成立 |
| Orchestrate | `roadmap_disabled` | 路线图，刻意未做，默认关闭 |
| Authorized Execute | `roadmap_disabled` | 路线图，刻意未做，默认关闭；不构成任何执行许可 |

`Authorized Execute` 在所有界面与文档中必须固定显示为：路线图、未授权、默认
关闭、不构成执行许可。

## 5. CEO / CAIO / COO / CIO 边界

- **CEO**：唯一的 CAIO 授权签发人与恢复权持有人；承担最终经营与法律责任。
- **CAIO**：AI 经营中枢产品角色；统领领域 Agent；在成熟阶段按预授权行事；
  不持有法定高管身份。
- **COO / CIO / 业务负责人**：法定职责与管理权不因 CAIO 存在而转移；其管理
  指令与 CAIO 指令冲突时按 §3 阻断优先级处理（任务暂停，升级 CEO 裁决）。
- **监护角色（CEO 指定）**：仅持有紧急停止权，无恢复权、无日常指挥权。

### CEO 身份与 `WorkspaceRole.OWNER` 不等价

Public Core 中的 `WorkspaceRole.OWNER` 是工作区权限角色（“一号位/owner 视
图”门控），**不是**法律意义上的 CEO 身份认定。任何 workspace OWNER 不得被
展示或审计为法定 CEO；CEO 身份只能由私有 Overlay 显式绑定。展示品牌不得
作为身份认证或服务端授权条件。

## 6. `aicoo → CAIO` 兼容映射（仅展示层，单向）

历史演进：Helm 的 AI 经营中枢能力早期以 `AI COO` 口径建设，相关机器标识使用
`aicoo` 历史命名空间。本 ADR 将**客户可见展示词**统一迁移为 CAIO；**机器标识保持不变**。

| 层 | 处置 |
|---|---|
| 客户可见展示词（标题、README、displayName、界面文案） | `AI COO` / `数字 COO` → `Helm CAIO`（按语境用全称“Helm CAIO｜一号位 AI 经营中枢”） |
| 机器标识 | 冻结不改：历史命名空间下的全部文件名、路径、绑定/能力/版本类标识字段；具体清单由持有这些标识的各个仓在其自身边界内维护，本公开文档不罗列私有实现细节 |
| 历史证据 | 冻结不改：merge commit、历史哈希、owner approval 证据、已签名/已钉扎/已归档内容 |
| 迁移 ADR 与明确的历史引用 | 允许出现旧词，须能被读者识别为历史口径 |

映射是**单向展示映射**：CAIO 只是历史机器标识的展示别名；canonical
对象中出现 CAIO 别名替代历史机器标识时校验必须失败，而不是自动改写。

## 7. 四仓职责（PR 验收边界）

- **公开 Core 仓（本仓）**：本 ADR、唯一的 CAIO 类型契约（`lib/caio-governance/`
  纯类型与验证器，规划中、由后续切片交付，本 PR 未交付）、通用展示语义与
  术语门禁。
- **行业 Pack 仓**：行业通用内容的旧口径分类与 ratchet 门禁；不复制 Core
  枚举，不定义第二份 CaioMandate。
- **客户 Overlay 仓**：仅租户展示覆盖与私有身份映射（如 CEO 身份绑定）；既有
  历史绑定文件与验证器不变。
- **Control Plane 仓**：仅兼容元数据、pin、回执与部署治理；不解释产品语义，
  不授予业务权限。

## 8. 术语规则（由 `npm run check:caio-terminology` 强制）

1. 客户可见与公开内容**新增**禁止出现：`AI COO`、`数字 COO`、CAIO 的英文
   缩写展开形式。
2. 机器标识 `aicoo` 不得出现在本仓（helm-public 当前没有也不应引入 aicoo
   机器标识；跨仓引用属于 Overlay/Control Plane 职责）。
3. 本 ADR 及术语校验器自身是唯一允许出现旧词的文件（用于记录映射与历史）。
4. 品牌展示固定为 `Helm CAIO｜一号位 AI 经营中枢`（中文）与
   `Helm CAIO — the AI executive reporting to the CEO`（英文）。

## 9. 边界声明

本文件与其配套校验器：

- 不修改任何权限、路由、API、数据库或执行状态机；
- 不激活自动派工、自动外发、CRM 写入、资金或法律动作；
- 不构成生产激活、客户承诺或 owner approval；
- 不改变任何既有 `aicoo` 机器标识、pin、哈希或历史证据。
