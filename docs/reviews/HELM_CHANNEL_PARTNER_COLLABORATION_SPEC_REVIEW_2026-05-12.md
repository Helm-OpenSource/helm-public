---
status: active
owner: helm-core
created: 2026-05-12
review_after: 2026-08-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 渠道方 / 超级个体协作模型 — Spec Review

日期：2026-05-12
状态：Pre-implementation spec review（不是 closeout / 实施后报告）
需求来源：[HELM_CHANNEL_PARTNER_COLLABORATION_REQUIREMENTS_2026-05-12.md](../product/HELM_CHANNEL_PARTNER_COLLABORATION_REQUIREMENTS_2026-05-12.md)
评审视角：Claude（第一轮 self-critique，pre-Codex review）

## 评审结论

P0 需求 7 条主要 contract + 1 条 fixture eval gate，整体可执行，**与 V2.3 GTM Operating Layer 不冲突，且补齐了 V2.3 既定但未收敛的两个真实缺口**（partner 主体形态、客户租户内权限白名单）。

**建议在进入实施之前**收敛 3 处歧义、明确 2 项边界声明、补 1 条 P0 需求（试用期最小活动门槛已经写进 P0-REQ-05，但语义需要在评审中讨论是否过严）。

## 与 AGENTS.md / V2.3 既有边界的对齐情况

- ✅ AGENTS.md §6.5"不是完整企业级多组织 / 多权限 / 多租户平台" — 本需求在 P0-REQ-01 明确声明"受控试点的渠道伙伴接入面"而非 PRM 平台扩张
- ✅ AGENTS.md §6.7"customer-facing wording 可能被误解成 commitment 必须降级" — P0-REQ-03 通过 partner 署名 + Helm 系统判断署名硬区分，避免 partner nudge 被误读为 Helm 承诺
- ✅ AGENTS.md §13.4"把局部能力扩成完整平台" — P0 范围严格收窄为 contract + fixture eval，未引入 schema / runtime
- ✅ V2.3 §10.4 Contribution != Payable — P0-REQ-06 沿用，不引入即时分账或股权
- ✅ V2.3 §10.5 Accrual Candidate != Settlement — P0-REQ-06 沿用"应计候选"措辞
- ✅ V2.3 §10.6 Human Review before External Use — P0-REQ-02 nudge draft 必须客户显式接受才进入候选池
- ✅ V2.3 §10.7 Clean Handoff into Trial — P0-REQ-02 / P0-REQ-04 严格收敛 partner 数据**不进入**客户租户、客户原始信号**不流出**到 partner

## 已经收敛的设计判断

- **partner = 独立 Helm 租户**而非 reserved tenant 内账号 — 锁死 self-tenant 角色边界，partner 自己的经营对象不会污染 Helm 自身经营记忆
- **可见边界 = 判断层只读** — 与 Helm decision-first 信息架构同构，partner 看到的是 Helm 已经做出的判断而非原始信号
- **计费主体 = 客户付 Helm** — 合同主体单一，避免数据处理者 / 转售商 / 代理多重身份混淆
- **归属锁定 = 试用转付费** — 比注册时锁定更稳，配合 P0-REQ-05 活动门槛，套利成本提高
- **分账 = V2.3 Phase 6 manual settlement** — 不新增结算系统，复用既有 governance posture

## 需要在 P0 内进一步收敛

1. **PartnerNudgeDraft 的具体生命周期** — 需求 P0-REQ-02 列了状态机，但**没说**：
   - 客户接受后是直接进入 `Recommendation` 列表，还是先进入"待客户成员复核"的中间状态？后者更符合 V2.3 §10.9 customer confirmation 边界
   - 建议在评审中冻结：accepted 后进入"客户成员待复核"，由客户内部成员显式升级到正式 Recommendation；partner 没有直接对话客户工作流的权限
2. **跨租户判断层只读聚合的实现路径** — P0-REQ-04 描述了 readout，但**没说**：
   - 是用 server-side fanout 查询每个 customer workspace 再 alias 化（实时但写放大）
   - 还是物化 rollup 表（性能稳定但需要 schema）
   - 本轮 contract 阶段可以延后到实施阶段，但评审建议**预先声明** "P0 contract 不绑定实现路径；任何选择都必须满足 P0-REQ-07 守卫"
3. **客户 alias 的 salt 隔离** — P0-REQ-04 已说"独立 salt 不复用 self-tenant-health"，但**没说**：
   - 同一 partner 在不同时间窗的 alias 是否稳定（partner 跨周对比同一客户）
   - 多 partner 之间的 alias 是否相互独立（避免 partner 之间反推同一客户）
   - 建议冻结：alias = HMAC(salt_per_partner_workspace, customer_workspace_id)，partner-scoped 稳定、跨 partner 不一致

## 刻意未做（spec 层面的明确放弃）

- **不做** 多 partner 共同推动场景的应计切分 — P0-REQ-05 强制单 active referrerId，多方协作降级到 V2.3 §6.9 贡献记录
- **不做** 自动佣金支付 — 沿用 V2.3 §10.4 / §10.5 / §10.6
- **不做** partner 在客户租户内的对外通信权 — P0-REQ-07 守卫硬阻断
- **不做** partner 对 Ask Helm 的访问权 — 默认禁止，避免对原始客户信号的间接推断（已列入"仍待澄清"，但评审建议直接冻结为 No-Go）
- **不做** marketplace / 自助申请 — 与 V2.3 §3.2 一致
- **不做** schema migration / runtime / API / UI — 本轮只做 contract + fixture eval

## 风险项

1. **跨租户判断层只读聚合是 workspace-first 架构里的第一个跨租户原语**
   - 当前 Helm 所有查询都是 workspace-scoped。partner portfolio readout 是第一个合法的跨租户读取入口
   - 风险：守卫层面如果不做成"channel-portfolio-only 的封闭路径"，未来会被复用为通用 cross-tenant query API，慢慢消解 workspace-first 边界
   - 缓解：P0-REQ-07 守卫应该**机械拒绝**任何非 portfolio readout 的跨 workspace query；不开放通用 helper

2. **建议 / 承诺边界在多方场景下的二级延伸**
   - 当前 Helm 的建议 / 承诺边界是 "Helm 系统判断 vs 系统建议 vs 客户决策" 三层
   - partner 加入后变成 "Helm 系统 / partner / 客户" 三方
   - 风险：UI 上如果 partner nudge 与 Helm 判断的视觉署名不够强，客户会把 partner 的话误读为 Helm 官方意见，进一步反向影响客户对 Helm 判断质量的信任
   - 缓解：P0-REQ-03 已声明硬署名要求，但评审建议**附录画一张 mock UI**，把署名样式作为 DESIGN.md 级别的视觉契约固定

3. **归属套利与"挂名"风险**
   - P0-REQ-05 的最小活动门槛（默认 N=3 nudge accepted）是一道防线，但 N 的取值需要业务验证
   - 风险：N 过低（如 1）→ 套利容易；N 过高 → 真正在做轻量推动的 referrer-only partner 拿不到任何归属
   - 缓解：评审建议把 N 暂定为 3 但作为**可配置 commission policy**，在 V2.3 Phase 6 实施阶段允许 owner 调整；同时区分 "referrer-only" 与 "implementation" 两类 partner 的最小门槛阈值

4. **客户撤销 partner 入驻后的回收路径**
   - P0-REQ-03 提到"撤销入口"与"未接受 nudge 即时失效"，但**没说**：
     - 已 accepted 但未升级为 Recommendation 的 nudge 怎么处理
     - 已 accrued 但未 settled 的 commission 候选是否保留
   - 建议冻结：accepted 但未升级 nudge 保留为客户内部 read-only 历史（携带 partner 署名）；accrued 但未 settled 候选保留至自然结算窗口；不追溯撤销

5. **审计写放大**
   - P0-REQ-02 + P0-REQ-04 + P0-REQ-07 要求每次 partner 访问都写审计
   - 风险：partner 名下 100 客户 × 每日 10 次访问 = 1000 audit writes/day/partner；如果 partner 数量增加可能形成显著写放大
   - 缓解：评审建议 access log 用 "session-level aggregation"（每个 partner session 一条 + access pattern 摘要），不是每个 view 一条；详细 view 可以在 audit query 时按需展开

6. **Workspace.workspaceClass 扩张为 PARTNER 仍触及 AGENTS.md §6.5**
   - 形式上看是引入新 workspace class，需要 owner 明确这次扩张属于"受控试点的渠道伙伴接入"而非"开始构建多组织平台"
   - 缓解：需求文档 P0-REQ-01 已声明边界，但建议评审通过后在 STATUS.md 增加一行"Channel Partner Workspace 当前档位：已成形但仍需下一层"，避免实施完成时被理解为完整 PRM

## 给最终需求文档的收敛建议

在实施前的最终版需求中：

1. P0-REQ-02 状态机增加 "accepted_by_customer → customer_internal_review → promoted_to_recommendation / kept_as_partner_note" 两节
2. P0-REQ-04 增加 "alias = HMAC(salt_per_partner_workspace, customer_workspace_id)" 形式定义
3. P0-REQ-05 把 N 从 hardcoded 改为 `commissionPolicy.minActivityThreshold`，并区分 partner type
4. 新增 P0-REQ-09："客户撤销 partner 入驻后的回收路径"（accepted 但未升级 nudge / accrued 未 settled commission 的处理规则）
5. 把"partner 对 Ask Helm 默认禁止"从"仍待澄清"提升到 P0-REQ-02 黑名单（已在 spec 中提及，建议固化）
6. 附录增加 partner 署名样式 mock（DESIGN.md 级视觉契约）
7. "仍待澄清"第 1 项（PartnerWorkspace 多成员）建议直接冻结：允许多成员，所有成员对外统一以 PartnerWorkspace 名义署名，不引入 partner-side 子角色

## AGENTS.md §11 七问应答（本轮 spec 阶段）

1. **当前哪些能力已经完整成立**：无 — 本轮是 spec / contract 阶段，未涉及实现
2. **哪些能力已成形但仍需下一层**：渠道方协作模型的离线 contract 草稿（本文档 + requirements）；需要 Codex 第二轮评审 + owner 决策才进入 fixture eval 落地
3. **哪些地方刻意未做，为什么**：见上文"刻意未做"段；核心是不引入 schema migration / runtime / 自动结算，保持 V2.3 现有姿态
4. **哪些边界必须继续诚实保留**：见 AGENTS.md §6 全部硬边界；本需求未触动 plugin runtime / 真实 sandbox / 完整 enterprise auth / broad auto-write / send authority
5. **当前基线 / sprint 目标是否已经清楚**：清楚 — 本轮目标是收敛 channel partner spec contract，不进入实施
6. **recommendation / commitment 两条 A-minus 主线是否仍保持稳定**：保持 — 本需求通过 partner / Helm 双层署名进一步强化了 recommendation 的可识别边界，对 commitment 主线无新增风险
7. **下一阶段最该做的 5 件事**：
   1. Codex 第二轮评审本 spec，收敛上述 6 处建议
   2. 与 V2.3 §7 实施 owner 同步：channel partner 切片应该排在 V2.3 Phase 6 之后还是并行
   3. Owner 决策 PartnerWorkspace 引入是否打开 AGENTS.md §6.5 边界，明确写入 STATUS.md
   4. 起草 fixture eval（按 V2.3 §6.9 / 最近 P0 离线 gate 形态），10-12 条 alias-only fixture
   5. 起草 partner 署名样式 mock，进入 DESIGN.md 级视觉契约层
