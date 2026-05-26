# Governance — Pack 治理边界

## 1. 三层治理

| 层 | 内容 |
|---|---|
| Tool Policy | Skill 调用的工具白名单、参数约束 |
| Sandbox | 商业版 Pack 默认 Docker 隔离（可选 OpenShell / SSH） |
| Audit | 全审计链；traceId / agentId / tool / decision / reason |

## 2. 推荐 vs 承诺边界（Helm 独有）

**所有对外动作默认"建议"——不自动执行。**

| 动作类型 | 行为 |
|---|---|
| 对客户发邮件 / IM | 默认草稿，需人工"确认发送" |
| 写入 CRM 字段 | 默认建议，需销售确认 |
| 自动判定（成败/承诺） | 不允许 |
| 替主管打分 | 不允许 |

## 3. 不掉案件 invariant
来自脱敏行业样板经验：
- 任何被 Pack 接管的"案件"（商机/项目/工单）必须有人 owns
- 不允许"系统漏处理"导致案件消失
- audit 必须能追溯每一次状态变更

## 4. 多租户隔离
Helm 是工作区优先多租户系统：
- 不同工作区数据严格隔离
- Skill 调用必须验证 workspaceId 与成员身份

## 5. Helm 商标使用
- ✅ 可用：`基于 Helm 双层 Skill 规范`、`兼容 Helm Pack template`
- ❌ 不可用：`Helm Certified Pack`、`Helm 官方 Pack`、`Helm 区域服务商`（除非通过 Helm 认证体系）

## 6. 与 OpenClaw / ClawHub 关系
- Helm Pack 借鉴 SKILL.md 自然语言风格
- Pack template 与 Helm Cookbook Skill 兼容 ClawHub
- Pack 商业版 worker 实现**不发** ClawHub
- 详见 Helm Cookbook 发布协议
