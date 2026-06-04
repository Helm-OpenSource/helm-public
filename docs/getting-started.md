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
git clone https://github.com/Helm-OpenSource/helm-public.git
cd helm-public
```

---

## 1.1 中国大陆 / 受限网络准备（可选）

如果你的网络访问 Docker Hub 或 `registry.npmjs.org` 不稳定，先把镜像源作为**本地
环境配置**处理，不要把私有 mirror、token 或凭据提交进仓库。

本地 `npm install` 可复制模板：

```bash
cp .npmrc.example .npmrc
```

模板只设置：

```ini
registry=https://registry.npmmirror.com
```

Docker 构建里的 `npm ci` 可以用同一个镜像：

```bash
NPM_REGISTRY=https://registry.npmmirror.com docker compose up --build
```

这个 build arg 只影响镜像内的 npm 下载。`node:22-slim` 和 `mysql:8.4` 仍由你的
Docker daemon 拉取；如果 Docker Hub 不稳定，请在 Docker Desktop / OrbStack /
colima 或企业镜像网关里配置你们组织认可的 registry mirror，例如：

```json
{
  "registry-mirrors": [
    "https://<your-org-approved-dockerhub-mirror>"
  ]
}
```

镜像构建还会访问 Debian `apt` 源安装 OpenSSL / CA 证书；如果企业网络也拦截这条
链路，请先配置 Docker / 企业网络代理，或在你的 fork 中替换为组织批准的基础镜像。

需要恢复 npm 默认 registry 时，删除本地 `.npmrc` 即可。

---

## 2. 安装依赖

```bash
npm install
```

`postinstall` 只运行本地 macOS lightningcss 签名修复 helper；它**不会**自动生成
Prisma client。请在完成 MySQL 与 `.env` 配置后，按第 5 步显式运行
`npm run db:generate`。

---

## 3. 准备 MySQL

最简单的方式——用 Docker 起一个本地实例：

```bash
docker run -d --name helm-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=helm2026 \
  -p 3306:3306 \
  mysql:8.4
```

启动后默认 `DATABASE_URL`：

```
mysql://root:root@127.0.0.1:3306/helm2026?charset=utf8mb4
```

这与 `.env.example`、`docker-compose.yml` 保持一致。如果你已有 MySQL，跳过这一步，
把对应 URL 替换到 `.env` 即可。

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

### 中国交付 profile 预检（可选）

如果这个 fork 准备面向中国客户交付，先把本地 `.env` 里的 profile 与网络镜像提示对齐：

```bash
# .env
HELM_DEPLOYMENT_REGION="cn"
HELM_DATA_RESIDENCY="cn"
NPM_REGISTRY="https://registry.npmmirror.com"
LLM_DEFAULT_PROVIDER="qwen"
DASHSCOPE_API_KEY="<your-dashscope-key>"
ASR_ENABLED="false"
```

然后运行只读静态 doctor：

```bash
npm run delivery:doctor -- --region cn
```

这条命令不会联网，也不会读取客户系统。它会提示常见中国交付误配：Qwen 只填了
`OPENAI_API_KEY`、region / residency 仍为 `global`、未配置 npm 镜像提示，或在中国
profile 下启用了当前仍是 OpenAI-only 的 ASR 路径。

---

## 5. 初始化数据库

```bash
npm run db:generate    # 生成 Prisma client
npm run db:migrate     # 应用迁移
npm run db:seed        # 灌入开发示例数据
```

如果迁移失败提示 extension SQL 相关，单独跑：

```bash
npm run db:migrate     # 重新应用迁移入口
```

如果仍失败，先确认 `.env` 里的 `DATABASE_URL` 与 MySQL 启动参数一致。

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

- GitHub 议题（Issues）— 优先公开提问，便于其他人搜到
- 微信 `ffjw0821` — 联系我们 / 商业合作 / 社群沟通（人工受控入口）
- 微信社群邀请二维码 — 先加微信 `ffjw0821` 获取当期有效二维码（邀请二维码存在时效）
- 社交媒体 / 公众号 — 待补充（当前不作为承诺入口）
- 安全漏洞——**不要**走公开议题，见 [../SECURITY.md](../SECURITY.md)
