# helm-pack-template

> Helm 行业 Pack 开发模板 · Open-source skeleton for building Helm certified industry packs.
>
> **本目录是 helm-ai/helm-pack-template 仓库的骨架**，将在 GTM 启动时抽出为独立 GitHub 仓库（Apache-2.0 开源）。

## 中文

### 这是什么
基于 Helm 双层 Skill 结构（SKILL.md 自然语言外层 + worker 实现内层）的 Pack 开发模板。让你（Helm 认证 AI 实施工程师 / 伙伴 / 客户）能快速搭出一个新行业 Pack 骨架。

### 核心约束（来自 Helm 双层规范）
- **Day-1 行业有效性**：每个 Skill 必须自带 seed/（playbook + templates + thresholds），开箱可用
- **作业质量是核心证据**：每个 Skill 必须有量化作业质量门槛 + 业务侧可读验证
- **首次落地是种子事件**：首批 design partner 客户的首日感知决定生态启动
- **证据先于承诺**：Pack 交付前先准备上下文包、Pack Studio 安全样例、证据矩阵、待复核工作包和证明闭环收口；这些都是复核优先工件，不是自动执行能力

### 快速开始
```bash
# 复制 pack-template 到你的 Pack 仓库
cp -r pack-template/ ../my-helm-pack/
cd ../my-helm-pack

# 初始化第一个 Skill
./scripts/new-skill.sh my-first-skill
```

### 完整文档
- `docs/GETTING_STARTED.md` 入门
- `docs/SKILL_MD_REFERENCE.md` SKILL.md frontmatter 字段参考
- `docs/GOVERNANCE.md` 治理边界（建议 vs 承诺、不掉案件 invariant）
- `pack-template/artifacts/` 公开安全交付工件模板

### 参考实现
`examples/` 指向 Helm 官方 Pack A（B2B SaaS 销售推进）作为完整范例。

### 许可
- 模板与示例：Apache-2.0
- 你基于本模板开发的 Pack：作者自定（开源/商业版均可）
- Helm 商标（"Helm Certified"、"Helm Pack" 等）：见 GOVERNANCE.md

## English
See `README.en.md`.
