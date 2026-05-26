---
status: draft
owner: 创始人 / GTM
created: 2026-04-30
audit:
  - 与 docs/research/CHINA_AI_SKILL_AND_DIGITAL_WORKER_LANDSCAPE_V1.md §5.2 SkillHub 章节对齐（深挖）
  - 与 docs/partners/HELM_COOKBOOK_TO_CLAWHUB_PUBLISHING_PROTOCOL_V1.md 对齐（Helm 是否参考 SkillHub 精选）
data_method:
  - Desktop research：腾讯云开发者社区 + 知乎 + 财经媒体公开报道
  - 未联系腾讯团队，未做精选机制内部访谈；下一步可补
archive_rule:
  - 6 个月后滚动；或 SkillHub 精选机制对 Helm 决策已无影响时归档
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Tencent SkillHub 精选机制深挖 V1

## 1. 目的
理解腾讯 SkillHub 怎么从 ClawHub 13,000 个 Skill 里精选 50 个、做安全审计、做中文翻译。给 Helm Cookbook 发布、认证工程师案例公示、与 SkillHub 潜在合作三件事提供输入。

## 2. SkillHub 概览
- 上线时间：2026-03-11
- 性质：腾讯官方 OpenClaw 中国版 Skills 社区（**非镜像，是再加工**）
- 收录：ClawHub 全部 13,000 Skills + 腾讯审计精选 50 个
- 站点：https://skillhub.tencent.com/

## 3. 三件事

### 3.1 全量中文翻译
- 范围：全部 13K Skill 的名称、功能描述、使用文档
- 方式：自动翻译 + 部分人工校对（公开资料未明示比例）
- 重构搜索引擎：中文关键词语义匹配深度优化

### 3.2 官方精选 50 个
- 选拔来源：从 13K Skill 中**按使用频率 + 实用性 + 稳定性**筛选
- 涵盖场景：日常办公、社媒运营、开发工具、多媒体处理、搜索研究、内容创作、内容运营、办公自动化
- 多维评估（公开未详述具体标准）

### 3.3 安全审计
- 工具：**Skill Vetter** 安全检查机制
- 范围：对全部 Skill 做 Git 与 GitHub 安全扫描
- 目标：确保代码无恶意残留，保护用户隐私

## 4. 接入路径
- 腾讯云轻量服务器用户：服务器面板一键安装
- 自建环境用户：命令行启用 SkillHub
- 新手用户：官网直接复制安装命令

## 5. 商业模式（推断）
公开资料未明确商业化路径。最可能的模式：
- 短期：免费 + 引流到腾讯云轻量服务器、TI 平台、混元模型 API
- 中长期：可能引入"精选 Skill 收费"或"企业级 SkillHub Pro"
- 不收 Skill 上架费（开放生态）

## 6. 与 Helm 的三种潜在关系

### 6.1 关系 A：Helm Cookbook 被 SkillHub 精选
**理想结果。** Helm 把 Cookbook（脱敏后的 Pack 案例）发到 ClawHub，腾讯审计后选入 SkillHub 50 精选——免费的中国市场顶级流量曝光。

**触发条件：**
- Helm Cookbook 在 ClawHub 有持续更新与下载量
- Skill 实用性 + 代码安全性达到 SkillHub 标准
- 中文文档完备（避免被腾讯翻译机器选过）

**Helm 行动：**
- helm-cookbook 仓库默认中文双语 README
- 每个 Cookbook Skill 独立通过腾讯 Skill Vetter 标准
- 主动与 SkillHub 团队建立联系（公众号联络 / 知乎私信）

### 6.2 关系 B：Helm 借鉴 SkillHub 精选机制做认证工程师案例公示
腾讯 SkillHub "13K 中精选 50" 思路 = Helm 认证工程师案例公示 "N 个案例中精选 M 个公开"。

**Helm 实现：**
- 每个 Pack 维护"官方精选 Cookbook 案例"清单
- 每月 / 每季度 review 一次精选清单
- 精选标准：使用频率（被多少认证工程师 fork 引用）+ 实用性 + 稳定性
- 上 Helm 公众号、官网首页、Pack landing 页

### 6.3 关系 C：Helm 与腾讯 SkillHub 直接合作
**乐观情景。** Helm Pack 作为"行业经营 Pack"以独立分类入驻 SkillHub。

**前置条件：**
- Helm 在中国市场有一定知名度（GitHub stars ≥1K）
- Pack A 至少 1 个公开成功案例
- 阿里云 vs 腾讯云的合作平衡（Helm 已有阿里云 one-pager；与腾讯合作不冲突）

**风险：** 腾讯 SkillHub 可能把 Helm Pack 当"竞品 Skill 包"看，限制曝光位。

## 7. 关键不确定性
1. **腾讯精选机制能否被复制？** 公开资料只有"使用频率 + 实用性 + 稳定性 + 多维评估"，缺细节
2. **SkillHub 商业化方向是否会冲击 Helm 商业 Pack？** 如果腾讯也做"行业 Pack"会成为直接竞品
3. **腾讯是否对 Helm Cookbook 友好？** 取决于双方关系、阿里云依赖度等
4. **中文翻译质量对 SkillHub 流量的影响？** 翻译漏译/误译可能影响 Helm Cookbook 在 SkillHub 上的可读性

## 8. Helm 行动建议

### 8.1 立即（Week 1-2）
- 建立 SkillHub 团队联络通道（公众号 / 知乎私信 / 火山引擎或腾讯云开发者社区发言）
- 分析 SkillHub 50 精选完整清单，理解他们的"行业有效性"判断维度
- 写一篇知乎深度文：《从 SkillHub 50 精选看中国 OpenClaw 生态走向》——既是内容、也是 Helm 团队对 SkillHub 团队的"暗号"

### 8.2 中期（Month 2-3）
- helm-cookbook 仓库公开发布，含 ≥10 个 Pack A/B/C 衍生案例
- 主动让 SkillHub 团队知道 helm-cookbook 存在
- 借鉴 SkillHub 精选机制设计 Helm Pack 官方案例公示

### 8.3 长期（Quarter 2+）
- 评估"Pack 入驻 SkillHub"可行性
- 评估腾讯云联合方案（与阿里云联合方案对照设计）

## 9. 不做清单
- 不做 Skill 商城（与 SkillHub 直接同层竞争）
- 不批评 SkillHub 翻译质量（会损坏腾讯关系）
- 不绕开 SkillHub 直接接触腾讯云高层（先走 SkillHub 团队渠道）

## 10. 数据来源
- SkillHub 官网：https://skillhub.tencent.com/
- 腾讯云开发者社区《SkillHub 上线》《上万 Skill 不知选哪个》
- 知乎《腾讯推出 SkillHub，附 50 个精选 AI Skills》
- 财联社、新浪财经、新华社关于 SkillHub 上线的报道
- AIGCLINK X 帖子（Skill Vetter 与 50 精选信息）

## 11. 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | SkillHub 三件事（翻译 + 精选 + 审计）+ Helm 三种潜在关系 + 行动建议 |
