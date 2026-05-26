---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Settings Frontstage Disclosure Computer Use Polish v1

更新时间：2026-04-21
状态：Validation Passed; Full DB / E2E Not Run In This Slice
当前切片：`Computer Use attempted; Playwright confirmed /settings default account surface hides raw model-service implementation terms in Chinese mode`

## 1. 目标

这次继续处理 `/settings` 默认账户页的系统语：

1. 继续尝试 Computer Use 读取浏览器窗口；Safari 不可用时，用 Playwright 操作真实本地页面复评
2. 把 raw provider、model、prompt registry、recommendation explanation、LLM fallback 等默认可见实现词，收成中文设置判断语言
3. 保留 provider registry、model config、prompt registry、预算层和 fallback truth，不改写底层配置或权限
4. 让 `/settings` 默认层先回答“当前配置是否支撑试点和经营动作”，而不是直接暴露实现清单

## 2. 本轮不做

- 不改 provider registry、model routing、prompt registry 或 LLM 配置来源
- 不新增模型服务能力、密钥、环境变量或连接器权限
- 不改 settings 写路径、组织权限、审计、billing 或 connector 行为
- 不把设置页扩成完整模型管理控制台、workflow engine 或 auto-execution plane

## 3. 影响面

- `features/settings/display-copy.ts`
- `features/settings/display-copy.test.ts`
- `features/settings/components/account-settings-tab.tsx`
- `features/settings/settings-client.tsx`
- `features/settings/setup-wizard.tsx`
- `PLANS.md`
- `docs/README.md`
- `docs/reviews/HELM_SETTINGS_FRONTSTAGE_DISCLOSURE_COMPUTER_USE_POLISH_REPORT_V1.md`

## 4. 关键假设

1. `/settings` 中文默认层应面向经营者和管理员，让人先判断当前设置是否可用、哪里需要处理、边界是什么。
2. raw provider / model / prompt 标识仍是系统配置真值；中文默认层可以映射成“模型服务已启用 / 已指定 / 当前说明模板”等用户语言。
3. English 模式仍保留更技术化的 provider / model / prompt wording；本轮重点是中文默认层顺滑度。
4. Computer Use 当前仍不能稳定读取 Safari 窗口，所以页面验证以 Playwright 实操扫描为准。

## 5. 验证方案

```bash
npm run test -- features/settings/display-copy.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

页面验证：

- 尝试 Computer Use 获取 Safari 窗口状态
- 用 Playwright 登录 demo 并打开 `http://127.0.0.1:3000/settings`
- 检查默认层不再出现 `LLM / GPT / OpenAI / review / review-first / review-only / recommendation / provider / model / prompt / system / workflow`
- 检查桌面 1440px 与移动 390px 主内容没有页面级横向溢出

当前已执行结果：

- Computer Use：应用列表可读；Safari 激活并打开 `/memory` 后仍返回 `cgWindowNotFound`；Finder 窗口读取被 MCP approval denied
- `npm run test -- features/settings/display-copy.test.ts` passed；1 file / 2 tests
- `npm run typecheck` passed
- `npm run self-check` passed；11/11 checks
- `npm run check:boundaries` passed
- `npm run lint` passed with 7 existing warnings
- `npm run build` passed；existing Turbopack NFT warning remains
- `npm run quality:regression` passed；51 files / 181 tests passed
- `git diff --check` passed
- Playwright `/settings` 默认页桌面 1440x1100：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0
- Playwright `/settings` 默认页移动 390x844：目标系统词计数 0，`rootDelta = 0`，`mainDelta = 0`，溢出节点 0
- `npm run db:reset` 未执行：这是破坏性数据库重置，且当前本地 MySQL 前提不可用
- `npm run e2e` 未执行：当前已完成 `/settings` 桌面/移动 Playwright 定向复评，完整 e2e 仍依赖本地 DB 前提恢复

## 6. 主要风险

1. 中文默认层不再展示 raw provider / model 名称，排障时仍需从底层配置和日志读取精确信息。
2. 本轮只处理默认账户页和 setup 默认项；连接器、权限、策略等更深 tab 仍可在后续循环继续扫描。
3. Computer Use 当前仍无法稳定读取 Safari 窗口，后续仍需继续尝试并保留 Playwright 兜底。
