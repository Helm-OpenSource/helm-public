---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 试点前总验收清单

## 目标

在进入设计合作伙伴试点前，先确认：

1. 仓库边界清楚
2. 文档不会误导
3. 新环境可启动
4. 核心链路可人工验收
5. 最小质量检查脚本可跑

---

## P0：必须通过

### 1. Git 与交付边界

- [ ] `git rev-parse --show-toplevel` 指向当前 Helm 仓库根目录
- [ ] `main` 分支存在
- [ ] 至少一条可审计的 `codex/*` 基线 / 迁移 / 备份分支存在
- [ ] 工作树除忽略项外干净
- [ ] [docs/pilot/delivery-boundary.md](delivery-boundary.md) 已更新

### 2. 文档与代码漂移

- [ ] 文档中未实现 API 已标注为“文档预留，当前代码未实现”
- [ ] `docs/README.md` 已索引 `pilot/`
- [ ] README 已说明交付边界、试点文档入口与环境模板使用方式

### 3. 环境模板

- [ ] `.env.example` 包含：
  - [ ] `DATABASE_URL`
  - [ ] `APP_URL`
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `GOOGLE_REDIRECT_URI`
  - [ ] `CONNECTOR_TOKEN_SECRET`
  - [ ] `OPENAI_API_KEY`
  - [ ] `LLM_ENABLED`
  - [ ] `LLM_DEFAULT_PROVIDER`
  - [ ] `LLM_DEFAULT_MODEL`
  - [ ] `LLM_EXTRACTION_MODEL`
  - [ ] `LLM_BRIEFING_MODEL`
  - [ ] `LLM_REASONING_MODEL`
  - [ ] `LLM_BASE_URL`
- [ ] 默认 `DATABASE_URL` 指向 `file:./dev.db`

### 4. 核心命令

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run pilot:check`
- [ ] `npm run pilot:eval`

---

## P1：建议通过

### 5. 人工验收

- [ ] 记忆系统人工验收路径可走通
- [ ] recommendation 人工验收路径可走通
- [ ] evolution 人工验收路径边界清楚
- [ ] conversation capture 人工验收路径边界清楚

### 6. 真实数据试跑准备

- [ ] Gmail 只读连接失败时有清晰 fallback 说明
- [ ] CSV 导入后能识别未绑定或可能重复对象
- [ ] recommendation 被查看 / 被采纳 / 被拒绝 / 被编辑结果可统计
- [ ] 周报可展示高风险、遗漏事项和 AI 参与情况

---

## 当前明确不在试点前补做

- [ ] 不新增 action type
- [ ] 不扩实时录音
- [ ] 不扩更多 evolution pattern
- [ ] 不扩更多页面
- [ ] 不扩更多 provider
