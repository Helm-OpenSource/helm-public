---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Tenant GTM Operating Layer Requirements Review V2.2

**评审人**: Claude Opus 4.7
**评审时间**: 2026-04-25
**评审文档**: `docs/product/HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_V2_2.md`
**评审轮次**: V2.2 Review（补充 customer confirmation / controlled rewrite 规则后）
**前置评审**: V1 Review (`docs/reviews/HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_REVIEW_V1.md`)

---

## 1. 总体结论

### **Conditional-Go**

**是否可进入专家评审**: 是
**是否可进入实现**: 否，需先完成必须修改项

**最主要理由**:

1. **Customer Confirmation Layer 是重要补充**: V2.2 明确了 `sales_led` 客户注册后进入"确认 + 补全"而非重填 intake，解决了 V1 评审中未充分展开的客户体验问题。

2. **Customer-Sourced Updates 规则到位**: `CustomerContextUpdateRequest` 对象和相关治理规则（10.9、10.10）清晰地区分了 minor/material 变更，防止了客户改写静默覆盖内部判断。

3. **Phase 2/3 分离意图合理但存在风险**: 文档说"保留单一 guided product flow，但不强制把 Phase 2 和 Phase 3 合并成一个实现 phase"，这个区分在工程切片上有意义，但需要更清晰的 UX 交付边界，否则容易造成体验断裂。

4. **CustomerDemandBrief 对象进一步复杂化**: 新增了 `entryMode`、`prefillSource`、`customerConfirmationStatus`、`customerEditableFieldSet`、`customerConfirmedSummary`、`lastCustomerConfirmedAt` 等 6+ 字段，对象正变得越来越重。

5. **验收标准更加可测试**: V2.2 补充了更多具体的验收指标，特别是 Customer Confirmation/Rewrite 相关的验收标准。

**建议**: 在进入实现前，重点关注 (1) CustomerDemandBrief 对象是否继续膨胀，(2) Phase 2/3 的 UX 交付边界是否清晰。

---

## 2. 核心优点

1. **Customer Confirmation Layer 解决了关键体验问题**
   - 明确了 `sales_led` 客户进入的是"确认与补全"而非重填 intake
   - 区分了 `confirm` / `supplement` / `request_change` 三类动作
   - 防止了客户在注册后被迫重新填写整张表单

2. **Customer-Sourced Updates 治理规则清晰**
   - 第 10.9 节（Customer Confirmation != Internal Truth Override）明确了客户可直接改写的字段 vs 必须进入 review 的字段
   - 第 10.10 节（Append-First Source Trace）确保了所有更新都以 diff 方式进入，不会静默覆盖
   - `CustomerContextUpdateRequest.materiality` 字段区分了 minor/material 变更

3. **sales-led / self-serve 双入口同一 schema**
   - 第 6.2 节明确要求两种入口模式收敛到同一套 `CustomerDemandBrief` schema
   - 区别只能体现在界面姿态和默认预填，不得形成两套不同数据结构

4. **Phase 间依赖关系更加清晰**
   - 第 11 章补充了更详细的 Phase 间依赖关系图
   - Phase 2 输出 `CustomerDemandBrief`，Phase 3 输出 `CustomerContextUpdateRequest + OperatingControlLineCandidate`
   - Phase 3 明确输入来自 Phase 2，不允许销售重新建一份并行记录

---

## 3. 关键风险

### 3.1 【高危】CustomerDemandBrief 对象继续膨胀

**为什么会发生**:
- V2 版本已经有约 20 个字段
- V2.2 又新增了 6+ 字段：`entryMode`、`prefillSource`、`customerConfirmationStatus`、`customerEditableFieldSet`、`customerConfirmedSummary`、`lastCustomerConfirmedAt`
- 对象职责越来越不清晰：既承载销售预填，又承载客户确认，还承载试用初始化 payload

**后果**:
- 销售在 guided intake 时需要理解的字段越来越多
- 客户确认层需要展示的字段越来越多，体验复杂化
- Phase 2/3 之间的数据传递契约越来越复杂

**建议**: 见 Must Change 第 1 条

---

### 3.2 【中危】Phase 2/3 UX 交付边界不清晰

**为什么会发生**:
- 文档说"保留单一 guided product flow，但不强制把 Phase 2 和 Phase 3 合并成一个实现 phase"
- Phase 2 是 "Guided Intake + Brief"，Phase 3 是 "Customer Confirmation + Control Line Review + Evidence Validation"
- 工程切片上允许分开，但产品体验上必须保持单一 flow

**后果**:
- 如果 UX 上有明显割裂，销售/客户会感知到"两套流程"
- 如果 UX 上完全无缝，Phase 2/3 的工程切片边界可能模糊
- 实现时容易在 Phase 2/3 之间来回调整需求

**建议**: 见 Should Change 第 1 条

---

### 3.3 【中危】CustomerContextUpdateRequest 对象定位模糊

**为什么会发生**:
- 新对象 `CustomerContextUpdateRequest` 有 11 个字段
- 它既可以承载客户在注册时的确认/补全，也可以承载使用过程中的改写
- 但这两种场景的 UX、优先级、review 流程完全不同

**后果**:
- 实现时需要判断当前是"注册时确认"还是"使用中改写"，逻辑复杂化
- review queue 可能混杂两种不同性质的 update request

**建议**: 见 Should Change 第 2 条

---

### 3.4 【中危】materiality 判断规则不够具体

**为什么会发生**:
- 文档说 `materiality` 分为 minor | material
- 但没有给出具体的判断规则，哪些字段改动是 minor，哪些是 material

**后果**:
- 实现时可能需要频繁讨论"这个改动算 minor 还是 material"
- 客户可能不理解为什么某些改动可以直接生效，某些需要 review

**建议**: 见 Should Change 第 3 条

---

## 4. 逐模块评审

### 4.1 Customer Confirmation Layer（新增）

**评估**: ✅ 合格

**优点**:
- 清晰区分了 `confirm` / `supplement` / `request_change` 三类动作
- 明确了 `sales_led` 客户进入确认流，不是重填 intake
- 输出清晰：哪些字段来自销售预填、哪些来自客户确认、哪些仍待确认、哪些触发 review

**问题**:
- 缺少"客户确认后，哪些内容会同步回内部销售备注"的说明

**建议**:
- 补充：客户确认不应修改 `internalSalesNotes`，但可以触发内部通知

---

### 4.2 Customer-Sourced Updates and Controlled Rewrite Rules（新增）

**评估**: ✅ 合格，但需补充细节

**优点**:
- `CustomerContextUpdateRequest` 对象设计合理
- `materiality` 字段区分了 minor/material 变更
- 第 10.9、10.10 节的治理规则清晰

**问题**:
- materiality 判断规则不够具体
- 没有说明 "minor 变更保留 diff，但不需要 review" 的具体流程

**建议**:
- 见 Should Change 第 3 条

---

### 4.3 Phase 2/3 分离（修订）

**评估**: ⚠️ 需要澄清

**优点**:
- 工程切片清晰：Phase 2 输出 `CustomerDemandBrief`，Phase 3 输出 `CustomerContextUpdateRequest + OperatingControlLineCandidate`
- 产品体验上保持单一 flow，不做两套表单

**问题**:
- "单一 guided product flow" 和 "不强制合并成一个实现 phase" 之间的张力没有充分展开
- 缺少 UX 原型或交互说明

**建议**:
- 见 Should Change 第 1 条

---

### 4.4 CustomerDemandBrief 对象（修订）

**评估**: ⚠️ 继续膨胀

**新增字段**:
- `entryMode`: sales_led | self_serve
- `prefillSource`: 销售预填来源
- `customerConfirmationStatus`: 确认状态
- `customerEditableFieldSet`: 客户可编辑字段集合
- `customerConfirmedSummary`: 客户确认后的摘要
- `lastCustomerConfirmedAt`: 最后确认时间

**问题**:
- 对象职责越来越重
- `customerEditableFieldSet` 可能与权限模型重复

**建议**:
- 见 Must Change 第 1 条

---

### 4.5 OperatingControlLineCandidate 对象（保持 V2）

**评估**: ✅ 合格

**第一阶段字段**（7 个）保持合理：
- `controlLineCandidateId`
- `briefId`
- `painTag`
- `controlLineTemplate`
- `targetBusinessObject`
- `resourceInputs`
- `evidenceReadiness`（从枚举扩展：declared | partial | ready | verified）
- `status`（新增 `review_required`）

**状态调整**:
- 新增 `review_required`，替代原来的 `review_ready`
- 这个更准确：`review_ready` 暗示"可以进入 review"，而 `review_required` 强调"必须 review"

---

### 4.6 治理规则（新增 10.9、10.10）

**评估**: ✅ 优秀

**新增规则**:
- 10.9 Customer Confirmation != Internal Truth Override
- 10.10 Append-First Source Trace

这两条规则补充了客户改写的边界，与 V1 的 "!= " 原则体系一致。

---

## 5. 必须修改项

### Must Change 1: 收紧 CustomerDemandBrief 对象

**位置**: 第 7.2 节

**问题**: V2.2 又新增了 6+ 字段，对象继续膨胀。

**修改建议**:

**第一阶段字段（Phase 2）**——最小化：

```typescript
// 核心业务字段
- briefId
- leadId
- entryMode                    // sales_led | self_serve
- prefillSource                // 仅 sales_led 时有值
- businessPressureTags
- currentResourceTags
- resourceEvidenceReadiness
- painToControlLineCandidates
- roleMap
- successCriteria
- riskBoundaryTags

// 分层内容
- customerVisibleSummary       // 客户可见摘要
- internalSalesNotes           // 内部销售备注

// 状态
- customerConfirmationStatus   // pending | completed
- reviewStatus
```

**延后至 Phase 3 的字段**：

- `customerEditableFieldSet`
- `customerConfirmedSummary`
- `lastCustomerConfirmedAt`

**理由**: 这些字段只有在客户确认层才需要，不应该在 Phase 2 就存在。Phase 2 应该只承载销售预填或客户自填的原始内容。

---

## 6. 建议修改项

### Should Change 1: 澄清 Phase 2/3 UX 交付边界

**位置**: 第 11 章（MVP 顺序）

**建议**:

补充 UX 交付边界说明：

**Phase 2 UX 交付**：

- 销售/客户完成 guided intake 后，看到的是 "Demand Brief 草稿已保存"
- 下一步明确为 "等待客户确认" 或 "进入 diagnostic"
- 不暗示流程已结束，但明确这是一个 checkpoint

**Phase 3 UX 交付**：

- 客户进入的是 "确认与补全" 界面，不是新的 intake 流
- 界面明确展示 "这些信息来自销售/你之前填写的"
- 完成确认后，才进入 "Control Line Review" 或 "Diagnostic"

**工程切片边界**：

- Phase 2 负责：intake 表单 + draft 保存 + brief 生成
- Phase 3 负责：customer confirmation 界面 + control line review + evidence validation
- 两个 phase 之间通过 `CustomerDemandBrief.id` 传递，不重复建对象

---

### Should Change 2: 澄清 CustomerContextUpdateRequest 的两种使用场景

**位置**: 第 7.3 节

**建议**:

补充场景说明：

**场景 1：注册时确认/补全（Initial Confirmation）**

- `origin`: customer
- `scope`: roles | goals | resources（minor），control_line（material）
- 通常是批量确认 + 少量补全
- review 流程相对轻量

**场景 2：使用中改写（In-Usage Update）**

- `origin`: customer | internal
- `scope`: 任意
- 可能是单个字段改写，也可能是批量调整
- review 流程取决于 `materiality`

---

### Should Change 3: 补充 materiality 判断规则

**位置**: 第 7.3 节或第 10.9 节

**建议**:

补充具体判断规则：

| 变更字段 | Materiality | 说明 |
|----------|-------------|------|
| 联系人 | minor | 可直接补充 |
| 目标/成功标准 | minor | 可直接补充或细化 |
| 参与人 | minor | 可直接补充 |
| 资料可得性 | minor | 可直接补充 |
| Pain tag | material | 影响 control line，需 review |
| Control line template | material | 影响 trial premise，需 review |
| 关键资源可用性 | material | 影响 evidence readiness，需 review |
| 试用前提/owner/reviewer | material | 影响执行结构，需 review |

---

## 7. 与 V1 评审的对比

| 项目 | V1 评审 | V2.2 状态 |
|------|--------|-----------|
| OperatingControlLineCandidate 过重 | Must Change 1 | ✅ 已简化（15 → 7 字段） |
| Phase 2/3 应合并 | Must Change 2 | ⚠️ 保留分离但增加 UX 约束 |
| 可测试验收标准 | Must Change 3 | ✅ 已补充 |
| "pain != evidence" 执行机制 | Must Change 4 | ✅ 已补充状态机 |
| MVP 阶段顺序 | Must Change 5 | ✅ 已补充依赖图 |

**V2.2 新增问题**:
- CustomerDemandBrief 对象继续膨胀
- Phase 2/3 UX 交付边界不清晰
- CustomerContextUpdateRequest 对象定位模糊

---

## 8. 明确不应做的事

### 8.1 不能进入实现的内容

与 V1 评审保持一致：

1. 通用 CRM 功能
2. 自动结算
3. 股权相关
4. 自动对外发送
5. Broad auto-write

**新增**：

6. 客户改写静默覆盖内部判断
7. 双套 intake 数据结构（sales-led vs self-serve）

---

### 8.2 不能进入普通客户租户的内容

与 V1 评审保持一致：

1. 内部 GTM Pipeline
2. 贡献记录
3. 应计候选
4. 结算复核
5. 私有 GTM 资产库

**新增**：

6. `CustomerContextUpdateRequest` 对象及 review queue
7. `materiality` 判断规则

---

### 8.3 不能自动化的边界

与 V1 评审保持一致：

1. Workspace 创建
2. Resource 接入
3. Evidence 验证
4. Public Asset 发布

**新增**：

5. 客户改写自动生效（material 变更）
6. 客户改写覆盖内部判断

---

## 9. 推荐的下一步

### 当前状态

文档已完成 **Conditional-Go** 评审，V2.2 相比 V2 有明显改进（Customer Confirmation Layer、Controlled Rewrite Rules），但仍有需要关注的问题。

### 下一步行动

1. **考虑是否需要 V2.3** (推荐):
   - 如果团队对 CustomerDemandBrief 对象膨胀有担忧，可以收紧对象设计（Must Change 1）
   - 如果团队对 Phase 2/3 UX 边界有担忧，可以补充 UX 原型或交互说明（Should Change 1）

2. **专家评审** (推荐):
   - 邀请 UX/Design 角色评审 Customer Confirmation Layer 的交互设计
   - 邀请 GTM/Sales 角色评审 sales-led / self-serve 双入口的体验设计
   - 邀请交付角色评审 Customer-Sourced Updates 的治理规则

3. **UX 原型** (推荐，在 Phase 1 之后):
   - 做 Customer Confirmation Layer 的低保真原型
   - 测试 "确认 + 补全" vs "重新填写" 的体验差异
   - 测试 material 变更的 review flow

4. **Implementation Plan** (V2.2 定稿后):
   - 写 `HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_IMPLEMENTATION_PLAN_V2.2.md`
   - 明确 Phase 2/3 的工程切片边界
   - 明确 `CustomerDemandBrief` 的字段职责和 Phase 间传递契约
   - 明确 `CustomerContextUpdateRequest` 的两种使用场景和 review 流程

### 不推荐的下一步

- ❌ 直接写 Prisma schema
- ❌ 直接实现页面
- ❌ 直接新增 API
- ❌ 跳过 UX 原型验证直接进入实现

---

## 10. 评审签名

**评审结论**: Conditional-Go

**主要理由**:
- Customer Confirmation Layer 是重要补充，解决了关键体验问题
- Customer-Sourced Updates 治理规则到位
- CustomerDemandBrief 对象继续膨胀，需要关注
- Phase 2/3 UX 交付边界需要澄清

**下一步**: 考虑 V2.3（收紧对象设计）或专家评审（UX/GTM/交付角色）→ UX 原型验证 → Implementation Plan

**No-Go 条件**（与 V1 保持一致）:
- 无法坚持 reserved-only 边界
- 无法接受 `contribution != payable`
- 无法接受 `pain != evidence`
- 需要一开始就做普通客户 CRM 或自动结算

**新增 No-Go 条件**:
- 无法接受 `customer confirmation != internal truth override`
- 需要做双套 intake 数据结构（sales-led vs self-serve）
- 需要客户改写静默覆盖内部判断

---

**评审人**: Claude Opus 4.7
**评审日期**: 2026-04-25
**文档版本**: V2.2
**下一轮**: V2.3 修订或专家评审
