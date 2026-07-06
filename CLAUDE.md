# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此仓库中工作时提供指导。

## 项目概述

Helm 是一套面向受控试点与中国市场的 AI 经营协同操作系统。它将会议、邮箱、CRM 和企业内部系统的信号整合成统一的推进链，让 AI 员工和团队围绕目标持续推进、正式复核，并把过程沉淀成可复用的经营记忆。

**核心特征:**
- 工作区优先、成员支持、受控试点架构
- 判断优先、决策优先的设计理念
- 主动汇报与人在环路的治理
- 明确区分建议与承诺
- 企业级视觉设计（非开发工具或聊天应用）

## 技术栈

- **框架**: Next.js 16 (App Router) + React 19
- **数据库**: MySQL + Prisma ORM
- **样式**: Tailwind CSS 4 + Radix UI 组件
- **测试**: Vitest (单元测试) + Playwright (E2E 测试)
- **语言**: TypeScript (严格模式)
- **认证**: 自定义数据库支持的会话系统

## 必读顺序

在开始任何重要工作前，按顺序阅读这些文件:

1. [AGENTS.md](./AGENTS.md) - 仓库执行标准与边界
2. [README.md](./README.md) - 项目概述与当前现状
3. [DESIGN.md](./DESIGN.md) - 视觉设计基线与约束
4. [WORKING-CONTEXT.md](./WORKING-CONTEXT.md) - 当前工程优先级
5. [docs/README.md](./docs/README.md) - 完整文档索引

## 开发命令

### 核心开发
```bash
# 启动开发服务器
npm run dev

# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 运行测试
npm run test                    # 运行单元测试
npm run e2e                     # 运行 E2E 测试
npm run quality:regression      # 运行综合回归测试
```

### 数据库操作
```bash
# 生成 Prisma 客户端 (MySQL schema)
npm run db:generate

# 运行数据库迁移
npm run db:migrate

# 重置并重新播种数据库 (仅开发环境)
npm run db:reset

# 使用示例数据播种数据库
npm run db:seed
```

### 验证与质量门禁
```bash
# 自检验证
npm run self-check

# 检查决策优先边界
npm run check:boundaries

# 验证环境变量
npm run validate:env
```

> 说明: `scripts/pilot-readiness-check.ts` 是 monorepo 时代的试点准备度清单，
> 未接入 npm scripts（其硬编码文档清单早于四仓拆分，直接运行会误报）。它被
> `lib/presentation/` 基线冻结回归测试作为被测资产引用，因此保留原位。

## 架构概览

### 目录结构

```
app/              # Next.js App Router 路由 (当前路由所有者)
features/         # 业务领域逻辑、页面、服务端动作
data/             # 查询兼容层与聚合接口
lib/              # 领域服务、记忆、AI、连接器、计费
components/       # 跨领域可复用 UI 组件
prisma/           # 数据库 schema、迁移和种子数据
scripts/          # 验证、自检和维护脚本
docs/             # 产品、架构和实现文档
```

### 核心架构原则

1. **路由所有权**: `app/` 是当前路由所有者 (不是 `apps/helm-app`)
2. **查询接口**: `data/queries.ts` 是当前查询聚合层
3. **特性组织**: 业务逻辑按 `features/<domain>/` 组织
4. **服务层**: 核心能力在 `lib/<domain>/` 模块中

### 当前迁移现状

- **已完成**: SQLite → MySQL 生产环境迁移
- **结构**: 根目录 `app/` (非 monorepo 结构)
- **认证**: 数据库支持的会话，非完整企业 SSO/SCIM
- **计费**: 试用/付费版本，支持 Stripe (全球) 和 支付宝/微信支付 (中国)

## 关键边界与约束

### Helm 不是什么

- 不是完整的企业多组织/平台
- 不是完整的工作流/编排引擎
- 不是通用聊天产品
- 不是完整的 BI 平台
- 不是自动执行平面
- 不是市场或应用商店

### 建议与承诺的区别

**关键**: 始终明确区分:
- **建议**: 需要人工复核的系统建议
- **承诺**: 具有业务影响的正式行动

除非获得明确批准，否则永远不要撰写可能被误解为承诺的面向客户的措辞。

### 硬边界

1. 插件运行时没有真正的沙箱
2. 认证是受控试点基础设施，非生产级企业认证
3. 未经明确批准，没有广泛的自动写入权限
4. 对外通信没有自动发送权限
5. 人工结算回退仍是真实来源

## 设计哲学

### 视觉方向
- **70%** 企业可信度与结构感
- **20%** AI 产品现代感
- **10%** 文档级清晰度

### 设计原则
- 浅色优先 (非深色模式优先)
- 判断优先的层级
- 决策优先的信息架构
- 清晰的状态和风险指示器
- 克制的颜色、字体和动效
- 操作表面的高信息密度

### 页面结构
每个页面应优先展示:
1. Helm 当前怎么看 (判断)
2. 为什么这样看 (理由)
3. 需要什么行动 (决策)
4. 存在什么边界 (治理)

## 测试策略

### 测试组织
- 单元测试: 与源文件并列 (`*.test.ts`)
- E2E 测试: `tests/e2e/` 目录
- 回归测试: `lib/presentation/` 中的全面覆盖

### 质量门禁

每个重要变更都必须通过:
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

## 常见开发模式

### 服务端动作
- 服务端动作位于 `features/<domain>/actions.ts`
- 始终验证权限和工作区成员资格
- 为业务操作维护清晰的审计跟踪

### 数据查询
- 主聚合: `data/queries.ts`
- 领域特定查询: `features/<domain>/queries.ts`
- 始终处理工作区范围和访问控制

### 错误处理
- 使用适当的错误边界
- 保持用户友好的错误消息
- 记录技术细节用于调试
- 永不暴露敏感的系统内部信息

## 特定特性指导

### 计费与商务
- 试用/付费版本具有不同权限
- 工作区优先的定价模型
- 人工结算作为回退
- 中国特定支付渠道

### 记忆与推荐
- 具有事实/行动提升的记忆系统
- 带有人工复核的推荐引擎
- 运营缺口检测与解决
- 业务优先的表面排序

### 认证与安全
- 数据库支持的会话管理
- 工作区成员生命周期
- 认证异常检测与跟进
- 组织管理员能力与控制

### 导入与连接器
- 带有冲突解决的 CRM 导入
- 邮箱连接器 (IMAP + SMTP)
- 会议捕获与集成
- 系统间的数据协调

## 在此代码库中工作

### 开始工作前
1. 阅读 AGENTS.md 了解执行标准
2. 检查 WORKING-CONTEXT.md 了解当前优先级
3. 查看 `docs/product/` 中的相关产品文档
4. 理解当前的验证要求

### 实现过程中
1. 在适用时遵循测试驱动开发
2. 维护决策优先的信息架构
3. 保持建议/承诺边界清晰
4. 运行适当的验证命令

### 完成工作前
1. 确保所有验证门禁通过
2. 更新相关文档
3. 对受影响区域运行回归测试
4. 验证设计原则得到维护

## 重要注意事项

- **迁移历史**: SQLite → MySQL 迁移已完成；SQLite schema 与迁移档案已移除，历史保留在 git 记录中
- **中国市场**: 特定的本地化和支付集成要求
- **受控试点**: 系统不是完整的企业平台
- **演进性**: 架构设计用于渐进式、经过验证的演进
- **重视文档**: 高度强调维护准确的文档

## 文件命名约定

- 服务端组件: `page.tsx`, `layout.tsx`
- 客户端组件: `*.client.tsx`
- 服务端动作: `actions.ts`
- 查询: `queries.ts`
- 测试: `*.test.ts`, `*.test.tsx`
- 类型: `types.ts`

## 环境设置

1. 复制 `.env.example` 到 `.env` 并配置
2. 运行 `npm install` (使用 postinstall 脚本)
3. 设置 MySQL 数据库
4. 运行 `npm run db:generate` 和 `npm run db:migrate`
5. 运行 `npm run db:seed` 获取开发数据
6. 使用 `npm run dev` 启动开发服务器

## 疑难时

1. 先阅读相关基线文档
2. 检查类似功能中的现有模式
3. 维护清晰的治理边界
4. 优先考虑用户信任和系统可靠性
5. 保持建议和承诺的区别
