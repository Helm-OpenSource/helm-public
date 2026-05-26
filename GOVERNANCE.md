> **语言 / Language**：**中文** · [English](GOVERNANCE.en.md)

# Helm 治理

Helm 是一个 Apache-2.0 许可的开源项目，当前处于受控试点阶段。本治理文件定义在 Helm 处于早期阶段时，如何处理范围、维护者、贡献评审与发布决策。

本文档不构成基金会、法律实体、商标许可、付费支持合约或企业 SLA。

## 1. 项目范围

Helm Core 是 operating-runtime 方法的开源采用层：

- 业务对象（business objects）
- 分层记忆（layered memory）
- artifact-first workers
- approval 与 audit 合约
- 本地受控试点 runtime
- 基础 workers 与 evals
- read-first 连接器 SDK

开源项目不是完整商业产品。Helm Cloud、Helm Enterprise、official connectors、certified workflow packs、客户专属 goldens、托管 evals、合作伙伴交付按独立路径治理。

## 2. 维护者职权

维护者负责：

- 守护 workspace-first、review-first、decision-first 边界
- 评审 PR 的正确性、安全性、范围与可维护性
- 拒绝把 Helm 变成 CRM、BI 平台、workflow 引擎、marketplace 或自动执行平面的改动
- 决定公开源码发布与试用 release 的就绪度
- 防止私有租户、客户 proof、商业 pack、凭据材料进入公开发布

当前维护者 role：`helm-core`。

## 3. 决策流程

仅在现有合约范围内的小改动可由维护者评审通过。

下列方向的改动必须先开 issue 或起草 planning doc：

- schema 或迁移
- 认证、授权、计费、试用生命周期或数据保留
- 外部连接器、callback、imports 或 official write path
- 客户可见承诺、定价、商业打包或公开声明
- plugin runtime、sandbox、orchestration、marketplace 或支付通道
- 公开发布、私有租户隔离、商标、认证或治理

维护者可以在不实现替代方案的前提下，关闭与当前受控试点边界冲突的提案。

## 4. 贡献权利

贡献者只能提交自己有权以 Apache-2.0 许可贡献的内容。

在正式 DCO 或 CLA 工作流自动化前，维护者可能要求非微小贡献附带 `Signed-off-by` 或其他权利确认后再合并。

不要提交：

- 客户数据
- 私有 eval goldens
- 客户 proof packs
- 私有 workflow packs
- 私有连接器凭据或 endpoint 细节
- 不兼容许可的第三方代码

## 5. 评审要求

每个非微小 PR 应包含：

- 目标（goal）
- 改动文件与受影响的 surface
- 验证命令与结果
- 边界确认（boundary confirmation）
- 行为变更时附 rollback 说明

UI 改动必须附视觉验证。涉及安全的改动必须遵循 `SECURITY.md` 与仓库验证链。

## 6. 发布治理

公开源码 release 必须满足：

- `LICENSE`、`NOTICE`、`README.md`、`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`CHANGELOG.md` 全部存在
- `npm run check:public-release` 通过
- 公开 mirror 不含已知私有租户、凭据、客户 proof、商业 workflow pack 或客户专属 eval 材料
- release notes 明确说明当前受控试点限制

云端试用 release 还必须保持数据政策、sub-processor 姿态、保留边界、no-SLA 立场处于最新状态。

## 7. 认证治理

`Official`、`Certified`、`Helm Cloud`、`Helm Enterprise` 等用语保留给维护者审批通过的材料。

第三方连接器、workflow pack、部署或合作方在没有对应清单且通过人工评审前，不能声称 certified 状态。

认证不是 marketplace、不是结算通道、不背书每个客户结果，也不自动赋予使用 Helm 商标的权利。

## 8. 冲突解决

维护者意见分歧时，默认采用更安全的边界，直到有 owner 决策或正式评审解决冲突。

默认决断顺序：

1. 保护客户与私有材料
2. 保留 recommendation / commitment 区分
3. 保留 review-first official-write 边界
4. 开源 scope 始终窄于商业运营
5. 实施前先记录决策

## 9. 治理更新

治理改动需维护者评审，并在适用时同步以下文档或守卫：

- `README.md`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `docs/README.md`
- `scripts/public-release-guard.ts`
- 相关产品 / 商业边界文档

## 10. 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-04-28 | Apache-2.0 开源受控试点初版治理文件 |
