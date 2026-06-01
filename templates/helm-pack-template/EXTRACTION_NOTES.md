# 抽取为独立仓库的说明（内部备注）

> 本目录是 helm-ai/helm-pack-template 仓库的骨架，**位于当前 public Core 仓临时托管**。
> 当 GTM 启动需要正式开源时，按以下步骤抽出为独立 GitHub 仓库。

## 抽取步骤

```bash
# 1. 创建独立仓库目录
mkdir -p ../helm-pack-template
cp -r templates/helm-pack-template/* templates/helm-pack-template/.gitignore ../helm-pack-template/
cd ../helm-pack-template

# 2. git 初始化
git init -b main
git add .
git commit -m "chore: initialize helm-pack-template from helm2026"

# 3. 推送到 GitHub
gh repo create helm-ai/helm-pack-template --public --source=. --remote=origin
git push -u origin main
```

## 抽取后处理
- helm2026 主仓 templates/helm-pack-template/ 可保留（作内部参考）或删除
- 如保留：在 templates/README.md 注明"已抽出，请直接看 helm-ai/helm-pack-template"
- 如删除：在 docs/brand/HELM_OPEN_SOURCE_COMMUNITY_DISTRIBUTION_PLAN_V1.md §4.1 仓库结构表更新链接

## 抽取时机建议
- ✅ 外部 forker 验证、public-safe evidence gate 与 owner 抽取门通过时
- ❌ 不要在 Pack A 开发期间过早抽出（避免主仓与子仓双轨修改）

## 与 helm-cookbook、helm-core 的关系
- helm-pack-template：开发模板（本仓库）
- helm-cookbook：脱敏后的实际案例（基于本模板）
- helm-core：开源核心 runtime（独立仓）
- 三者互相引用但独立维护
