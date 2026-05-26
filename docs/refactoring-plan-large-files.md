---
status: active
owner: helm-core
created: 2026-04-11
review_after: 2026-07-10
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# 大文件重构策略

## 问题分析

当前有3个文件超过500KB，影响Babel编译性能：

1. **settings-client.tsx** (9,407行) - 客户端设置组件
2. **runtime-upgrade.ts** (15,736行) - Helm v2运行时逻辑
3. **helm-self-check.ts** (15,407行) - 项目自检脚本

## 重构优先级

### 阶段1: 立即行动 (本周)
**目标**: 降低文件大小到300KB以下

#### 1. settings-client.tsx 拆分策略
```
features/settings/
├── settings-client.tsx (主组件, ~2000行)
├── formatters/
│   ├── governance-formatters.ts
│   ├── auth-formatters.ts
│   ├── connector-formatters.ts
│   └── business-formatters.ts
├── hooks/
│   ├── use-settings-state.ts
│   ├── use-billing-overview.ts
│   └── use-governance-actions.ts
└── types/
    └── settings-types.ts
```

#### 2. runtime-upgrade.ts 拆分策略
```
lib/helm-v2/
├── runtime-upgrade.ts (核心接口, ~1000行)
├── continuity/
│   ├── runtime-continuity.ts
│   ├── continuity-snapshot.ts
│   └── recovery-mechanisms.ts
├── payload/
│   ├── payload-selection.ts
│   ├── payload-verification.ts
│   └── budget-management.ts
├── memory/
│   ├── reflection-candidates.ts
│   ├── memory-promotion.ts
│   └── world-model.ts
└── types/
    └── runtime-types.ts
```

#### 3. helm-self-check.ts 拆分策略
```
scripts/
├── helm-self-check.ts (主入口, ~500行)
├── checks/
│   ├── database-check.ts
│   ├── dependencies-check.ts
│   ├── api-check.ts
│   └── integration-check.ts
└── reporters/
    ├── console-reporter.ts
    └── json-reporter.ts
```

### 阶段2: 性能优化 (下周)
- 懒加载组件和模块
- 优化导入依赖
- 代码分割策略

## 实施步骤

### 步骤1: 备份和测试
```bash
# 创建备份分支
git checkout -b refactor/large-files

# 确保现有测试通过
npm run test
npm run quality:regression
```

### 步骤2: 逐个文件重构
1. 先重构最小影响文件 (helm-self-check.ts)
2. 再重构中等等文件 (settings-client.tsx)
3. 最后重构核心文件 (runtime-upgrade.ts)

### 步骤3: 验证和部署
```bash
# 每次重构后运行
npm run typecheck
npm run lint
npm run build
npm run test
```

## 成功指标

- ✅ 所有文件 < 500KB
- ✅ 编译时间减少30%+
- ✅ 无功能回归
- ✅ 测试通过率100%

## 风险评估

**低风险**: helm-self-check.ts (独立脚本)
**中风险**: settings-client.tsx (UI组件)
**高风险**: runtime-upgrade.ts (核心逻辑)

## 缓解措施

1. 逐步重构，每次重构一个文件
2. 保持向后兼容的API
3. 增加集成测试覆盖
4. 创建功能分支，不直接影响main
