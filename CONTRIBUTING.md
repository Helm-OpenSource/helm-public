> **语言 / Language**：**中文** · [English](CONTRIBUTING.en.md)

# Contributing to Helm

感谢你考虑为 Helm 贡献。

Helm 是一套面向受控试点的「经营推进控制台 / 经营推进操作系统」。它把会议、邮箱、CRM 与企业内部信号收敛成统一推进链，给团队和 AI 员工提供必须推进项、证据链与正式复核入口。

请在提交贡献前先读这份指南。

---

## 1. 在动手前先读什么

按这个顺序读，不要跳过：

1. [AGENTS.md](AGENTS.md) — 仓库长期执行规范、硬边界、统一验证链
2. [README.md](README.md) — 项目概述、当前能做 vs 刻意不做
3. [DESIGN.md](DESIGN.md) — 视觉与界面基线
4. [WORKING-CONTEXT.md](WORKING-CONTEXT.md) — 当前 active queue 与短周期约束
5. [GOVERNANCE.md](GOVERNANCE.md) — 开源治理、scope control、release 与认证边界
6. [docs/README.md](docs/README.md) — 完整文档索引

如果你的改动涉及租户扩展、计费、连接器或公开发布相关脚本，请额外阅读：

- `docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md`（公开试用数据政策草案；最终以工作区契约和生效政策为准）
- `docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md`（五月 launch plan）
- `docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md`（open core / commercial runtime / partner delivery 边界）
- 对于客户专属 Overlay、商业 Pack 或私有部署细节，请在对应私有仓库阅读其仓库级说明；不要把这些材料复制到 `helm-public`。

---

## 2. Helm 不是什么

为避免提交方向错误的贡献，请先确认 Helm 当前**不是**：

- 完整企业多组织 / 多权限 / 多租户平台
- 完整 workflow / orchestration 引擎
- 完整 BI 平台
- 通用聊天产品
- 自动执行平面或自动发送/自动审批系统
- 应用市场 / Marketplace

针对上述方向的 PR 默认不会被接收。

---

## 3. 受控试点姿态

Helm 当前明确处于「受控试点」阶段。这意味着：

- 默认没有完整生产级企业 SSO / SCIM
- 默认没有 broad auto-write、auto-send、auto-execution
- plugin runtime 没有真正 sandbox
- 任何对外措辞默认区分「建议」与「承诺」
- 每条客户可见的关键动作都必须落 `AuditLog` 行（含 `traceId / requestId` 关联）；统一用户可见 trace timeline 未落地前，不要把贡献描述成“0 秒可回放”

新功能与改动必须维持这些边界，不要顺手扩成平台能力。任何引入新写入路径或 connector 的 PR，默认要把 `writeAuditLog` 接到入口处。

---

## 4. 推荐的贡献方式

我们尤其欢迎以下贡献：

- **bug 修复**：附带最小复现与回归测试
- **文档修订**：术语统一、错别字、过时描述
- **测试覆盖增强**：尤其是 `lib/presentation/` 回归与 `tests/e2e/`
- **本地化与翻译**：中英双版文档同步
- **外部连接器**：在不破坏 read-first / review-first 边界的前提下扩展只读连接器
- **可访问性改进**：键盘导航、对比度、ARIA

以下方向请先开 issue 讨论再写代码：

- 任何会改 schema 的变更
- 任何会引入自动写入 / 自动发送 / 自动审批的能力
- 任何会引入 plugin sandbox、marketplace、agent orchestration、payment 平台的能力
- 任何对 `app/` 路由所有权或 `data/queries.ts` 聚合层的重构
- 大规模目录重构

---

## 5. 提交前的本地准备

```bash
# 安装依赖
npm install

# 复制环境变量模板（需要本地 MySQL）
cp .env.example .env

# 准备数据库
npm run db:generate
npm run db:migrate
npm run db:seed

# 启动开发服务器
npm run dev
```

`.env.example` 分三档：

- **MUST**：DATABASE_URL、APP_URL、CONNECTOR_TOKEN_SECRET
- **OPTIONAL_AI**：OPENAI_API_KEY、LLM_*
- **OPTIONAL_CONNECTORS**：DingTalk、HubSpot、Salesforce、Stripe、支付宝、微信支付等

只有 MUST 档变量需要在所有路径下填入；其他档按需启用。

---

## 6. 默认验证链

任何非微小改动在提交前默认必须跑通完整链：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

具体含义见 [AGENTS.md §10](AGENTS.md)。

如果某一条命令在你的环境无法运行，PR 描述里必须明确：

- 哪些命令没跑
- 为什么没跑
- 剩余风险是什么

---

## 7. 决策优先与建议/承诺边界

Helm 是 `decision-first` 的：每个页面优先呈现「Helm 当前怎么看 / 为什么 / 需要什么行动 / 存在什么边界」。

任何 customer-facing 措辞如果可能被误解为承诺，必须显式降级为以下之一：

- boundary note
- prerequisite note
- dependency note
- non-commitment note

不要把建议写成承诺，不要把 explanation 写成合同。

---

## 8. 提交规范

### Contribution rights

你只能提交自己有权以 Apache-2.0 贡献的内容。不要提交客户数据、客户 proof pack、私有 eval goldens、商业 workflow pack、私有 connector 凭据或不兼容 license 的第三方代码。

在正式 DCO / CLA workflow 自动化前，maintainer 可能要求非微小贡献补充 `Signed-off-by` 或其他权利确认。

### Commit message

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 风格：

```
<type>: <subject>

[optional body]
```

常用 type：

- `feat`：新功能
- `fix`：bug 修复
- `docs`：仅文档
- `refactor`：不改变行为的重构
- `test`：测试相关
- `chore`：构建/工具
- `perf`：性能优化

subject 用动词开头，描述「做了什么」而不是「为什么」。原因放在 body。

### Pull Request

PR 描述至少包含：

1. **本轮目标**：一句话描述改动意图
2. **改动范围**：列出主要文件 / 模块
3. **验证情况**：跑了哪些验证命令、结果、未跑原因
4. **边界确认**：是否触及上文 §2-§3 列出的硬边界
5. **截图或录屏**：UI 改动必须附

PR 标题遵循 commit message 同样的格式。

---

## 9. 设计与 UI 改动

UI 改动必须先对齐 [DESIGN.md](DESIGN.md)：

- 浅色优先（非深色优先）
- 70% 企业可信、20% AI 现代感、10% 文档级清晰度
- 判断优先、决策优先的层级
- 克制的颜色、字体与动效
- 操作表面高信息密度

提交前用 `npm run dev` 在浏览器中走一遍主路径，确认没有视觉漂移。

---

## 10. 文档与索引同步

只要你改了行为、添加了能力或迁移了路径，就必须同步：

- `README.md` 与 `docs/README.md`
- `docs/STATUS.md`（仓库级 four-tier 注册表；任何升降档必须填日期 + commit / PR 编号）
- `CHANGELOG.md`（外部可观察变化）
- 相关产品 / 治理 / 评审文档
- 自检与边界检查脚本：
  - `scripts/helm-self-check-refactored.ts`
  - `scripts/decision-first-boundary-check.ts`
  - `scripts/pilot-readiness-check.ts`
  - `scripts/public-release-guard.ts`（公开镜像卫生）
- 对应回归测试

只交报告但不更新索引、自检或回归入口的 PR 默认不会被接收。

---

## 11. 安全相关贡献

请勿在公开 issue 或 PR 中提交安全漏洞。改用 [SECURITY.md](SECURITY.md) 中描述的私下披露流程。

---

## 12. 行为准则

参与本项目即表示同意 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。

---

## 13. License

通过提交 PR，你同意你的贡献以本仓库 [LICENSE](LICENSE)（Apache-2.0）发布。

如果你的贡献包含来自第三方的代码或资源，必须在 PR 描述中显式标注其原始 license，并保留原始版权与许可声明。
