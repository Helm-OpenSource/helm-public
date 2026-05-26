---
status: active
owner: helm-core
created: 2026-04-11
review_after: 2026-07-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Prisma 升级计划: 6.x → 7.x

## 升级前检查清单

### 当前状态
- Prisma版本: 6.19.3
- 目标版本: 7.7.0 (最新稳定版)
- 数据库: SQLite (开发), 需确认生产环境

### 升级风险评估
**风险等级**: 中等 ⚠️

**原因**:
- 主版本升级 (6.x → 7.x)
- Prisma 7.0 有重大变更
- 需要更新 schema 语法
- 需要重新生成 Client

### 已知的 Breaking Changes (Prisma 7.0)

1. **Node.js 版本要求**: 最低 Node.js 18.18+
2. **TypeScript 配置变更**: 某些类型定义变化
3. **查询引擎更新**: 可能影响性能
4. **Schema 验证更严格**: 之前允许的写法现在可能报错

## 升级步骤

### 第1步: 备份和准备 ✅
```bash
# 1. 确认当前工作状态正常
npm run typecheck
npm run build

# 2. 备份关键文件
cp prisma/schema.prisma prisma/schema.prisma.backup
cp package.json package.json.backup

# 3. 创建升级分支
git checkout -b upgrade/prisma-7.x
```

### 第2步: 执行升级
```bash
# 升级 Prisma
npm install prisma@latest @prisma/client@latest

# 重新生成 Client
npm run db:generate

# 验证 schema
npx prisma validate
```

### 第3步: 测试和验证
```bash
# 类型检查
npm run typecheck

# 构建测试
npm run build

# 运行测试
npm run test

# 数据库操作测试
npm run db:migrate
```

### 第4步: 修复可能的破坏性变更

#### 可能的问题和解决方案:

1. **类型导入错误**
   ```typescript
   // 可能需要更新导入方式
   import { PrismaClient } from "@prisma/client";
   ```

2. **查询语法变更**
   ```typescript
   // Prisma 7.0 可能对某些查询更严格
   // 需要检查复杂的查询和关联
   ```

3. **生成器配置**
   ```prisma
   // schema.prisma 可能需要更新
   generator client {
     provider = "prisma-client-js"
     previewFeatures = [] // 检查是否需要
   }
   ```

## 回滚计划

如果升级失败：

```bash
# 1. 恢复备份
cp prisma/schema.prisma.backup prisma/schema.prisma
cp package.json.backup package.json

# 2. 重新安装旧版本
npm install

# 3. 重新生成
npm run db:generate

# 4. 验证
npm run typecheck
npm run build
```

## 升级后验证清单

- ✅ TypeScript 编译通过
- ✅ 项目构建成功
- ✅ 数据库迁移正常
- ✅ 开发服务器启动正常
- ✅ 核心功能测试通过
- ✅ 没有性能回退

## 时间估算

- 升级执行: 15-30分钟
- 测试验证: 30-60分钟
- 问题修复: 0-2小时 (取决于遇到的问题)
- **总计**: 1-3小时

## 成功指标

- ✅ 零TypeScript错误
- ✅ 所有测试通过
- ✅ 开发流程正常
- ✅ 性能无回退
- ✅ 代码质量维持

---

**准备开始**: 2026-04-11
**预计完成**: 同日
**负责人**: 自动化执行
