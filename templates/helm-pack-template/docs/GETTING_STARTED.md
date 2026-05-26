# Getting Started — helm-pack-template

## 前置条件
- 阅读 docs/SKILL_MD_REFERENCE.md（理解 SKILL.md frontmatter）
- 阅读 docs/GOVERNANCE.md（理解治理边界）

## 步骤

### 1. 复制模板
```bash
cp -r pack-template/ ../my-helm-pack/
cd ../my-helm-pack
```

### 2. 修改 PACK.md
填入你的 Pack ID、ICP、Skill 列表。

### 3. 初始化第一个 Skill
```bash
./scripts/new-skill.sh <skill-slug>
```
脚本会基于 `pack-template/skills/example-skill/` 复制并重命名。

### 4. 编辑 SKILL.md frontmatter
按 docs/SKILL_MD_REFERENCE.md 填入字段。**至少必填：**
- name / description / pack / version / license
- helm.level / helm.multi_tenant / helm.recommendation_only

### 5. 填 seed/（强约束 A）
- `seed/playbook.md` — 行业 SOP
- `seed/templates/*` — ≥3 个开箱模板
- `seed/thresholds.yaml` — 默认阈值

### 6. 填 fixtures/（强约束 A）
让 Day-1 看板有真实可读内容。

### 7. 实现 worker
- 商业版：闭源 worker 仓库
- 开源版：可在 `implementation/worker.ts` 直接放代码（注意 license）
- 模板版：仅放 `implementation/reference.md`

### 8. 自检
```bash
./scripts/check.sh
```
检查 SKILL.md frontmatter 完整性、seed 必填项、fixtures 存在性。

### 9. 发布
按你的 Pack 类型选择：
- **商业版 Pack**：上 Helm Cloud / Enterprise（联系 Helm 官方）
- **开源 Cookbook Skill**：发到 ClawHub `@helm-cookbook/<slug>` 命名空间（参考 Helm Cookbook 发布协议）
