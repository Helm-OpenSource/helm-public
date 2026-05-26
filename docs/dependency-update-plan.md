---
status: dormant
owner: helm-core
created: 2026-04-11
review_after: 2026-06-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches transient quick-start / improvements / dependency-update pattern
---
# 依赖更新计划

## 🔴 紧急安全问题 (已修复)
- ✅ **brace-expansion** - 中危漏洞已修复
  - 问题: Zero-step sequence causes process hang and memory exhaustion
  - 修复: npm audit fix 已自动修复

## 📦 依赖更新建议

### 高优先级 (本周内)
#### 1. 小版本升级 (安全)
```bash
# 这些升级风险低，建议立即更新
npm install zustand@latest
npm install @tailwindcss/postcss@latest
npm install tailwindcss@latest
npm install react@latest react-dom@latest
```

#### 2. 测试框架升级
```bash
# Playwright 测试框架
npm install @playwright@test@latest
```

### 中优先级 (本月内)
#### 3. Prisma 主版本升级 ⚠️
```bash
# Prisma 6.x -> 7.x 是主版本升级，需要谨慎
npm install prisma@latest @prisma/client@latest
```

**注意事项**:
- 需要检查 breaking changes
- 可能需要调整 schema.prisma
- 建议在分支上测试

#### 4. ESLint 升级
```bash
# ESLint 9.x -> 10.x 是主版本升级
npm install eslint@latest
```

### 低优先级 (下月)
#### 5. TypeScript 主版本升级 ⚠️
```bash
# TypeScript 5.x -> 6.x 是主版本升级
npm install typescript@latest
```

#### 6. Node.js 类型定义
```bash
# @types/node 20.x -> 25.x
npm install @types/node@latest
```

## 🧪 升级测试清单

对于任何依赖升级，都要运行：

```bash
# 1. 基础检查
npm run typecheck
npm run lint

# 2. 构建验证
npm run build

# 3. 测试套件
npm run test
npm run quality:regression

# 4. 手动测试
npm run dev
# 然后手动检查关键功能
```

## 🚀 推荐升级顺序

### 第一批 (无风险)
```bash
npm install zustand@latest \
  @tailwindcss/postcss@latest \
  tailwindcss@latest \
  react@latest react-dom@latest \
  @playwright/test@latest \
  jsdom@latest
```

### 第二批 (需要测试)
```bash
npm install prisma@latest @prisma/client@latest
npm run db:generate  # 重新生成 Prisma Client
```

### 第三批 (谨慎升级)
```bash
npm install typescript@latest @types/node@latest
npm install eslint@latest
```

## 📋 升级后续工作

1. **更新锁定文件**: `package-lock.json` 会自动更新
2. **更新文档**: 如果有重大变化，更新相关文档
3. **测试覆盖**: 确保所有测试通过
4. **性能监控**: 观察升级后的性能变化
5. **回滚计划**: 保留升级前的 package-lock.json 备份

## ⚠️ 重要提醒

- **不要一次性升级所有依赖**
- **每次升级后都要测试**
- **主版本升级要特别小心**
- **保留回滚选项**
- **关注 release notes**

## 🎯 成功指标

- ✅ 所有测试通过
- ✅ 构建成功
- ✅ 无性能回退
- ✅ 无新增安全漏洞
- ✅ 代码类型检查通过

---

*建议升级时间: 2026-04-12*  
*预计总耗时: 2-3小时*  
*风险等级: 中等*
