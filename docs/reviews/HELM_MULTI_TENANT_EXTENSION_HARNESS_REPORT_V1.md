---
status: archived
owner: helm-core
created: 2026-04-16
review_after: 2026-10-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Multi-Tenant Extension Harness Report V1

更新时间：2026-04-16  
状态：Delivered

## 1. 本轮目标

本轮只做 3 件事：

1. 把多租户 extension 目录与命名规范冻结成正式开发协议
2. 把这条协议接进 current-main docs / harness / boundary checks
3. 单独列出 `guangpu` 当前剩余问题，交给开发团队后续收口

本轮不做：

- 重构全部 tenant extensions
- 统一修完 `guangpu` 全部问题
- 建 extension platform / marketplace

## 2. 已交付

- 新协议：
  - [HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)
- `guangpu` 问题清单：
  - [GUANGPU_EXTENSION_UPDATE_ISSUES_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/extensions/guangpu/GUANGPU_EXTENSION_UPDATE_ISSUES_V1.md)
- 规范入口同步：
  - [AGENTS.md](/Users/tommyqian/Documents/GitHub/helm2026/AGENTS.md)
  - [README.md](/Users/tommyqian/Documents/GitHub/helm2026/README.md)
  - [docs/README.md](/Users/tommyqian/Documents/GitHub/helm2026/docs/README.md)
  - [PLANS.md](/Users/tommyqian/Documents/GitHub/helm2026/PLANS.md)
- 最小 harness：
  - [scripts/helm-self-check-refactored.ts](/Users/tommyqian/Documents/GitHub/helm2026/scripts/helm-self-check-refactored.ts)
  - [scripts/decision-first-boundary-check.ts](/Users/tommyqian/Documents/GitHub/helm2026/scripts/decision-first-boundary-check.ts)
  - [scripts/self-check/config.ts](/Users/tommyqian/Documents/GitHub/helm2026/scripts/self-check/config.ts)

## 3. 当前结论

当前仓库对 tenant custom extension 的正确表达应固定为：

- `extensions/<tenant-key>/<extension-slug>/...`
- `extensionKey = <tenantKey>-<extensionSlug>`
- workspace enablement truth 由 `WorkspaceSolutionExtension` 承担
- shared substrate 不因 tenant custom 而复制进扩展目录

## 4. Guangpu 剩余问题

`guangpu` 当前已经是正确方向的第一批参考实现，但还没有完全对齐新协议。剩余动作已单独列在：

- [GUANGPU_EXTENSION_UPDATE_ISSUES_V1.md](/Users/tommyqian/Documents/GitHub/helm2026/extensions/guangpu/GUANGPU_EXTENSION_UPDATE_ISSUES_V1.md)

## 5. 风险项

1. 旧 key、旧路径和新协议可能暂时共存
2. 当前 BI report loader 仍带 heuristic 目录解析痕迹
3. 其他租户如果继续照旧习惯落代码，会再次污染 shared namespace

## 6. 下一步建议

1. 先让开发团队按 `guangpu` 问题清单收口
2. 下一批 tenant custom 需求必须直接按新协议落目录与 manifest
3. 后续再补更强的 manifest / loader 校验，不急着做平台层
