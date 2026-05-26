---
status: draft
owner: 创始人 / Partner Program
created: 2026-04-30
audit:
  - 与 docs/research/CHINA_AI_SKILL_AND_DIGITAL_WORKER_LANDSCAPE_V1.md §9.3 行动 1 对齐
  - 与 docs/product/HELM_PACK_SKILL_DUAL_LAYER_SPEC_V1.md §8 ClawHub 兼容性对齐
  - 与 docs/partners/HELM_AI_IMPLEMENTATION_ENGINEER_CERTIFICATION_STANDARD_V1.md 对齐（认证工程师 L2/L3 续期内容贡献激励）
  - 与 docs/product/HELM_OPEN_SOURCE_COMMERCIAL_BOUNDARY_PLAN.md §5/§6 边界对齐
freeze_status: 待 helm-cookbook 仓库初始化并发布首批 ≥3 个 Cookbook Skill 后冻结
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# Helm Cookbook 发布到 ClawHub 协议 V1

## 1. 目的与定位
为 helm-cookbook 仓库的 Cookbook Skill 发布到 ClawHub（OpenClaw 全球 Skill 库）提供脱敏、合规、命名、运营的统一规范。

**核心精神（创始人裁决）：**
> 同意 helm-cookbook 发到 ClawHub，要有开源精神。

## 2. 范围与边界

### 2.1 做什么
- 把 Helm Pack（A/B/C）的脱敏案例做成符合 ClawHub SKILL.md 规范的 Skill
- 通过 ClawHub 公开发布，免费曝光给 OpenClaw 全球用户
- 与认证工程师 L2/L3 续期"内容贡献"激励联动

### 2.2 不做什么
- 不发布 Pack 商业版闭源 worker 实现（implementation/ 目录禁发）
- 不发布客户原始数据（必须脱敏）
- 不放弃 Helm 商标边界（每个 Cookbook Skill 必须正确归属）
- 不与认证工程师争内容贡献——优先认证工程师署名

## 3. Cookbook Skill 形态

### 3.1 SKILL.md（双语）
中文 + 英文双语 README + 双语 SKILL.md 描述。

### 3.2 frontmatter（兼容 OpenClaw + Helm 标记）
```yaml
---
name: helm-<pack>-<scenario>
description: <≤1024 字符，中英双语>
license: Apache-2.0
homepage: https://github.com/helm-ai/helm-cookbook
metadata:
  helm:
    pack: A | B | C
    cookbook_only: true
    derived_from: <Helm Pack Skill ID>
    contributor: <认证工程师 ID 或 Helm Core>
    version: <semver>
  openclaw:
    emoji: <Pack 区分图标>
    requires:
      bins: []
---
```

### 3.3 目录结构
```
helm-cookbook-<pack>-<scenario>/
├── SKILL.md
├── README.md         # 双语
├── README.en.md
├── seed/             # 脱敏种子（话术、模板）
├── fixtures/         # 脱敏 fixture
└── implementation/
    └── reference.md  # **不放代码**——只放可读的"参考实现说明"
```

**关键边界：** `implementation/` 仅放 Markdown 说明，**绝不放 worker.ts**——Pack 商业版闭源边界保留。

## 4. 脱敏规范（强制）

| 类别 | 必须脱敏 |
|---|---|
| 客户名 | 全部用通用代号（"客户 A"、"某 SaaS 公司"） |
| 销售人员姓名 | 用角色（"销售总监"） |
| 邮箱、电话、IP | 全部移除 |
| 商机金额 | 量级化（"百万级 ARR"） |
| 行业敏感数据 | 关键数字模糊化（"≥30%" 而非具体值） |
| 客户内部系统名 | 通用化（"该客户 CRM"） |

**双重审核：** 提交者初审 + Helm Core 终审；Helm Core 否决率预期 30-50%。

## 5. 命名空间与归属

### 5.1 namespace（已采纳）
所有 Helm Cookbook Skill 在 ClawHub 用 `@helm-cookbook/<slug>` 命名空间。**创始人 2026-04-30 裁决：采纳。**

### 5.2 归属
- **Helm Core 出品**：contributor 字段 = `helm-core`
- **认证工程师出品**：contributor 字段 = 认证工程师 ID（公开）+ `helm-core` 联署
- **客户案例衍生**：必须注明"基于客户 X（脱敏）实施实践，已获授权"

### 5.3 Helm 商标使用
- SKILL.md 顶部必须写："本 Skill 是 Helm 经营运行时的开源 Cookbook 案例（不含商业版 Pack 实现）。Helm 商业版能力请访问 helm.dev"
- 不得用 `@helm-official/*` 等假装官方的命名空间

## 6. 发布流程

```
1. 提交者写 Cookbook Skill 到 helm-cookbook 仓库 PR
2. Helm Core 评审（脱敏 + 命名 + 归属 + 实用性）
3. 合并到 helm-cookbook main，自动构建 ClawHub 兼容包
4. 提交到 ClawHub（@helm-cookbook namespace）
5. 同步发知乎 / 公众号 / Helm Cookbook 官网案例页
6. 6 个月后自动评估"是否进 Helm 官方精选案例"（参考 SkillHub 50 精选机制）
```

## 7. 认证工程师内容贡献激励（与认证标准联动；建议性，非硬性要求）

### 7.1 L2 续期建议（不锁死）
**建议** L2 工程师 2 年续期前贡献 ≥1 个 Cookbook Skill（PR 被接受即算）。**鼓励性**，未达成不直接影响续期；创始人可酌情评估。

### 7.2 L3 续期建议（不锁死）
**建议** L3 工程师 2 年续期前贡献 ≥2 个 Cookbook Skill + 1 篇技术博客（知乎/掘金/InfoQ 任一）。**鼓励性**，未达成不直接影响续期。

### 7.3 通用原则
- 不要求每年贡献篇数（避免水文）
- 不与服务接单挂钩
- 提交 PR 不一定被接受（脱敏不合格、实用性不足都会被否）
- 续期评估以持续贡献意愿与案例质量为主，不是按数量考核

## 8. 质量门

### 8.1 必须项（缺一即否）
- 双语 README + SKILL.md
- 完整脱敏（按 §4）
- 正确命名空间与归属（按 §5）
- ≥1 个 fixture 示例
- 不含 worker.ts 等商业版代码

### 8.2 加分项（影响是否进精选）
- 中文文档质量高（不是机翻）
- ≥3 个真实可复用模板
- 客户/工程师可联系（自愿公开）
- 已有公开案例可链接

### 8.3 一票否决
- 包含未脱敏客户数据
- 含 Pack 商业版 worker 实现
- 仿冒 Helm 官方品牌

## 9. 与 SkillHub 的联动（参考 §6 SkillHub 调研）
helm-cookbook 在 ClawHub 发布后，自动被腾讯 SkillHub 收录（中文翻译 + Skill Vetter 安全审计）。Helm 不主动干预，但要：
- helm-cookbook 默认中文文档完备，避免 SkillHub 机翻误读
- 通过 SkillHub 50 精选间接获取中国市场顶级曝光

## 10. 风险与未决问题
1. **客户对 ClawHub 公开 Cookbook 的反应**——可能担心同行学走。**对策**：脱敏强约束 + 客户授权流程
2. **认证工程师 PR 通过率不足**——L2 续期可能拿不到 Cookbook 贡献。**对策**：Helm Core 提供"Cookbook 模板生成器"
3. **OpenClaw 协议变化**——SKILL.md schema 变化时 Cookbook 需跟随。**对策**：每季度复核
4. **ClawHub 政策变化**——可能限制企业品牌账号。**对策**：保留备用发布渠道（Gitee 镜像等）

## 11. 决策与下一步

**已拍板（2026-04-30）：**
- §5.1 命名空间 `@helm-cookbook/*` ✅ 采用
- §7 L2/L3 续期 Cookbook 贡献要求 ✅ 不锁死，仅作鼓励性建议

**待创始人拍板：**
1. §4 脱敏规范是否需要法务复核？

**下一步交付物（拍板后启动）：**
- helm-cookbook GitHub 仓库初始化
- Cookbook Skill 模板 + 生成器
- 首批 3 个 Cookbook Skill（Pack A/B/C 各 1）
- 法务复核脱敏规范

## 12. 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 双语 + 脱敏强约束 + 命名空间 + 认证工程师激励联动 + 质量门 |
