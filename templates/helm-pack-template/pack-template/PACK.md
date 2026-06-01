# Pack <PACK_ID> — <Pack 中文名>

> Helm 行业 Pack <PACK_ID>，对应 ICP <ICP_ID>。
> 本文件是 Pack 清单（开源摘要版）。完整商业版能力请访问 <pack landing url>。

## 适用客户
- 公司规模：<规模区间>
- 团队角色：<典型角色 1, 2, 3>
- 客单价：<ARR 区间>
- 业务周期：<典型周期>

## N 个 Skill

| ID | 名称 | 一句话 | 触发 |
|---|---|---|---|
| <PACK_ID>1 | <Skill 1 名> | <一句话价值> | <触发事件> |
| <PACK_ID>2 | <Skill 2 名> | | |
| ... | | | |

## 双层结构
每个 Skill 由两层组成：
- **外层 SKILL.md**：自然语言操作手册（认证工程师可读可改）
- **内层 worker**：实现层（商业版闭源 / 开源版可选开放）

详见 `docs/SKILL_MD_REFERENCE.md`。

## 三条强约束（建议默认值）
1. **Day-1 行业有效性**：每 Skill 自带 seed/（playbook + templates + thresholds），开箱可用
2. **作业质量是核心证据**：每 Skill 量化门槛 + 业务侧可读验证
3. **首次落地是种子事件**：首批 design partner 客户慎重选

## 不做清单（红线）
- 不自动发对外消息
- 不自动写客户系统字段（不经人工确认）
- 不替业务方做"承诺类"对外措辞
- 不替管理者做评分类决策

## Review-first 交付 artifacts
每个 Pack 在进入客户试跑或 proof candidate 前，应至少准备：

| Artifact | 作用 | 默认边界 |
|---|---|---|
| Context Packet | 收集 synthetic / redacted 上下文行 | 不含 raw customer data |
| Pack Studio safe sample | 表格化样本、信号、review gate 和 outcome | 不自动批量运行 |
| Evidence Matrix | 把 claim 压到 source-backed cell | AI 输出不是事实 |
| Review-Ready Work Pack | 准备 owner review | 不是 workflow engine |
| Proof Loop closeout | 关闭 7-day Run，记录 action-level 72h outcome | proof candidate 不等于 public proof |

模板见 `artifacts/`。

## 治理边界（建议默认值，可调）
- 默认所有对外动作走"建议 → 人工确认"通道
- 全部进 audit chain
- 不掉案件 invariant
- 工作区多租户（如需要）

## 完整文档
- 调研定位需求：`<your-pack-research-doc>.md`
- 双层结构规范：参考 docs/SKILL_MD_REFERENCE.md
- 治理边界：参考 docs/GOVERNANCE.md
