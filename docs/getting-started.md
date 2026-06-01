---
status: active
owner: helm-core
created: 2026-04-29
review_after: 2026-07-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
> **语言 / Language**：**中文** · [English](getting-started.en.md)

# 开发者上手指引

本文档面向**第一次在本地跑 Helm**的开发者。读完应该能在 15 分钟内：

1. 装好依赖
2. 起好 MySQL
3. 跑通迁移与种子
4. 启动 dev server 并看到 `/dashboard` 的「今天必须拍板的 3 件事」
5. 知道下一步该读哪份文档

如果你只是想 90 秒看 demo，请回到 [README.md](../README.md#90-秒看到-helm) 用 `docker compose up`。

---

## 0. 系统要求

| 项 | 最低版本 | 备注 |
|---|---|---|
| Node.js | 20.x（建议 LTS） | 16.x 已不支持 |
| npm | 10.x | 仓库使用 npm，未配置 pnpm/yarn lockfile |
| MySQL | 8.4 | 远端或本地都可；推荐本地 Docker |
| Git | 2.30+ | LFS 不强制要求 |
| 操作系统 | macOS / Linux / WSL2 | Windows 原生未做主线验证 |

可选（按需）：

- Docker Desktop / OrbStack / colima — 用来跑本地 MySQL
- VS Code / Cursor / JetBrains — 仓库带 `.vscode/` 推荐设置

---

## 1. 克隆仓库

```bash
git clone https://github.com/<org>/helm.git
cd helm
```

---

## 2. 安装依赖

```bash
npm install
```

`postinstall` 会自动跑 `prisma generate`。如果失败，单独跑：

```bash
npm run db:generate
```

---

## 3. 准备 MySQL

最简单的方式——用 Docker 起一个本地实例：

```bash
docker run -d --name helm-mysql \
  -e MYSQL_ROOT_PASSWORD=password \
  -e MYSQL_DATABASE=helm \
  -p 3306:3306 \
  mysql:8.4
```

启动后默认 `DATABASE_URL`：

```
mysql://root:password@127.0.0.1:3306/helm
```

如果你已有 MySQL，跳过这一步，把上面 URL 替换到 `.env` 即可。

---

## 4. 配置环境变量

```bash
cp .env.example .env
```

`.env` 三档说明：

### MUST（最小集，必须填）

| 变量 | 用途 |
|---|---|
| `DATABASE_URL` | MySQL 连接串 |
| `APP_URL` | 本地通常填 `http://localhost:3000` |
| `CONNECTOR_TOKEN_SECRET` | 至少 32 字节随机字符串，用 `openssl rand -hex 32` 生成 |

### OPTIONAL_AI（可选，缺失时走 placeholder）

| 变量 | 用途 |
|---|---|
| `OPENAI_API_KEY` | 任意 OpenAI 兼容 endpoint 都可 |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` | Qwen（百炼）provider 凭据与 endpoint |
| `LLM_BASE_URL` / `LLM_MODEL` | 本地 / 替代模型 |

缺失时 UI 不会崩，会显式标注「未配置 LLM」。

### OPTIONAL_CONNECTORS（可选，按需）

DingTalk · WeCom · HubSpot · Salesforce · Stripe · 支付宝 · 微信支付。

第一次跑全部留空即可。

---

## 5. 初始化数据库

```bash
npm run db:generate    # 生成 Prisma client
npm run db:migrate     # 应用迁移
npm run db:seed        # 灌入开发示例数据
```

如果迁移失败提示 extension SQL 相关，单独跑：

```bash
npm run setup-db       # 自动应用 extension SQL
```

需要重置时（**会删本地数据**）：

```bash
npm run db:reset
```

---

## 6. 启动开发服务器

```bash
npm run dev
```

打开浏览器：

| URL | 看到什么 |
|---|---|
| http://localhost:3000 | 公开首页 |
| http://localhost:3000/dashboard | 今天必须拍板的 3 件事（需登录） |
| http://localhost:3000/mobile | 移动端 Ask Helm |
| http://localhost:3000/setup | 6 步初始化 |

种子数据里有现成的演示账号，直接走 `/login` 用其中一个邮箱登录即可。

---

## 7. 验证你的环境

跑一遍最小校验链：

```bash
npm run typecheck
npm run lint
npm run test
```

如果你打算改东西并提 PR，建议在提交前跑完整链：

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

---

## 8. 常见问题

### `prisma generate` 找不到 binary
通常是 Node 版本问题。确认 `node -v` ≥ 20，然后删 `node_modules` 重装。

### MySQL 8.4 报 `caching_sha2_password`
确认连接串的密码与启动参数一致。Prisma 走 native 协议，不需要额外配置。

### `npm run e2e` 在 CI 失败但本地通过
本地也跑一次 `npx playwright install chromium` 确保浏览器装齐。E2E 端口默认在 65xxx 范围随机。

### dev server 起来但 `/dashboard` 跳到 `/login`
正常——种子数据里要先登录。如果连 `/login` 都不能提交，检查 `CONNECTOR_TOKEN_SECRET` 是否填了。

### 不想跑 MySQL，想用 SQLite
**不支持**。SQLite 主线已迁出，仅保留作为只读档案。请用 MySQL 8.4。

---

## 9. 目录速查

| 目录 | 作用 |
|---|---|
| `app/` | Next.js App Router 路由所有者 |
| `features/<domain>/` | 业务领域逻辑、页面、服务端动作 |
| `data/queries.ts` | 当前查询聚合层 |
| `lib/<domain>/` | 领域服务、记忆、AI、连接器、计费 |
| `components/` | 跨领域可复用 UI |
| `prisma/` | Schema、迁移、种子 |
| `scripts/` | 验证、自检、维护脚本 |
| `tests/e2e/` | Playwright E2E |
| `docs/` | 产品 / 架构 / 实现文档 |

---

## 10. 下一步该读什么

- 想理解架构哲学：[../AGENTS.md](../AGENTS.md) §1-§4
- 想做 UI 改动：[../DESIGN.md](../DESIGN.md)
- 想接连接器：[integrations/INTEGRATION_TEMPLATE.md](integrations/INTEGRATION_TEMPLATE.md)
- 想了解当前优先级：[../WORKING-CONTEXT.md](../WORKING-CONTEXT.md)
- 想提 PR：[../CONTRIBUTING.md](../CONTRIBUTING.md)
- 想看完整文档列表：[README.md](README.md)

---

## 11. 卡住了找谁

- GitHub Issues — 优先公开提问，便于其他人搜到
- `partners@helm.<domain>` — 商业 / 合作话题
- 安全漏洞——**不要**走公开 issue，见 [../SECURITY.md](../SECURITY.md)
