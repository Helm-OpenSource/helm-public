---
status: draft
owner: 创始人 / 工程
created: 2026-04-30
audit:
  - 与 docs/research/CHINA_AI_SKILL_AND_DIGITAL_WORKER_LANDSCAPE_V1.md §4 OpenClaw 章节对齐（本文件是其深挖）
  - 与 docs/product/HELM_PACK_SKILL_DUAL_LAYER_SPEC_V1.md 对齐（本文件输出双层结构的技术依据）
data_method:
  - Desktop research：OpenClaw 官方文档 + 知乎深度文章 + GitHub 教程仓
  - 未读源码、未跑 demo；如需更精确的内核机制需补充源码阅读
archive_rule:
  - Helm 双层 Skill 结构 V1 落地并完成 Pack A V2 修订后，本文件转入 archive 作为技术决策依据
review_after: 2026-07-29
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
---

# OpenClaw 技术深挖 V1

## 1. 目的
为 Helm Pack 双层 Skill 结构（SKILL.md + worker）设计提供具体技术依据。回答四个问题：
1. OpenClaw 的 SKILL.md schema 与三级加载到底是什么？
2. Helm 应该完整借鉴哪些机制？哪些不借鉴？
3. Helm 的多租户、推荐/承诺、不掉案件 invariant 在 OpenClaw 模式下怎么落？
4. Helm Pack Skill 与 ClawHub 兼容性怎么取舍？

## 2. OpenClaw 五组件架构

### 2.1 组件
| 组件 | 职责 |
|---|---|
| Gateway | 控制平面 + 策略表面；WebSocket 服务；channels 路由；token 鉴权；配置管理 |
| Brain（Agent） | 核心推理引擎；ReAct 循环 + LLM 编排；Skill 选择与调用 |
| Skills | 自然语言操作手册扩展（SKILL.md）+ 可选脚本 |
| Memory | 会话与长期记忆；本地 JSONL 存储 `~/.openclaw/agents/<agentId>/sessions/` |
| Tools | 执行原语（exec / browser / 文件系统 / 自定义插件）；走 sandbox |

**通信模型：** Gateway 处理控制面；nodes 是远程执行表面，通过 token 配对。**会话级路由**而非"每用户授权"——这是单租户假设的体现。

### 2.2 关键限制（Helm 必须注意）
> "OpenClaw is not a multi-tenant security boundary for mutually distrustful users sharing one agent."
> 
> OpenClaw 假设"每个 Gateway 实例 = 一个可信操作员"——是个人助理部署模型。

**对 Helm 的含义：** Helm 是工作区优先的多租户企业系统。**Helm 不能直接套 OpenClaw 模型**——如果借鉴架构，必须在 Gateway 层加多租户隔离 + 工作区成员身份验证。

## 3. SKILL.md schema（关键设计）

### 3.1 Frontmatter 必填
| 字段 | 约束 |
|---|---|
| `name` | 必填，≤64 字符，小写字母/数字/连字符 |
| `description` | 必填，≤1024 字符，非空 |

### 3.2 Frontmatter 可选
| 字段 | 类型 | 默认 | 用途 |
|---|---|---|---|
| `license` | string | — | 许可证 |
| `compatibility` | string | — | ≤500 字符 |
| `homepage` | string | — | macOS Skills UI 显示 |
| `user-invocable` | boolean | true | 是否暴露为 slash command |
| `disable-model-invocation` | boolean | false | 是否从模型 prompt 排除 |
| `command-dispatch` | "tool" | — | 绕过模型直接派发 |
| `command-tool` | string | — | 派发的工具名 |
| `command-arg-mode` | "raw" | "raw" | 参数转发模式 |

### 3.3 metadata.openclaw 子字段
| 字段 | 类型 | 用途 |
|---|---|---|
| `always` | boolean | 跳过所有 gating，总是包含 |
| `emoji` | string | macOS UI 图标 |
| `os` | array | 平台过滤（darwin/linux/win32） |
| `requires.bins` | string[] | 必需 PATH 可执行 |
| `requires.anyBins` | string[] | 至少存在一个 |
| `requires.env` | string[] | 必需环境变量 |
| `requires.config` | string[] | 必需配置路径 |
| `primaryEnv` | string | 关联环境变量 |
| `install` | object[] | 安装器（brew/node/go/uv/download） |
| `skillKey` | string | 配置键覆盖 |

### 3.4 SKILL.md 示例
```markdown
---
name: image-lab
description: Generate or edit images via provider workflow
metadata: {"openclaw":{"emoji":"🎨","requires":{"bins":["uv"],"env":["GEMINI_API_KEY"]}}}
---

# 操作手册

## 使用场景
- 生成营销素材图
- 修改产品图

## 调用方式
...
```

## 4. 三级加载策略（核心创新）

| 级 | 内容 | 时机 | Token 开销 |
|---|---|---|---|
| L1 | 名片：name + description + 文件位置（XML 标签包裹） | 启动注入系统 prompt | ~24 tokens / Skill |
| L2 | 完整 SKILL.md 操作手册 | Brain 判断相关时主动 read | 按需 |
| L3 | 子文件、参考脚本、辅助资源 | 执行子任务时读 | 按需 |

**实测数据：** 50 个 Skill ≈ 1,200 tokens 固定开销（与传统 MCP / function calling 全 schema 注入相比，节省 80%+）。

**Token cost 公式：** "195 base characters + per-skill 97 characters plus escaped field lengths."

## 5. 加载优先级与多 Agent 可见性

### 5.1 6 层加载层级（高到低）
1. Workspace skills：`<workspace>/skills`
2. Project agent skills：`<workspace>/.agents/skills`
3. User agent skills：`~/.agents/skills`
4. Hosted/local skills：`~/.openclaw/skills`
5. Bundled skills：随安装分发
6. Extra dirs：`skills.load.extraDirs` 配置

**冲突处理：** 高优先级覆盖低优先级（同名）。

### 5.2 多 Agent 可见性
| 范围 | 路径 | 可见性 |
|---|---|---|
| 单 Agent | `<workspace>/skills` | 仅该 Agent |
| 项目 | `<workspace>/.agents/skills` | 工作区内全 Agent |
| 用户 | `~/.agents/skills` | 本机全 Agent |
| 共享托管 | `~/.openclaw/skills` | 本机全 Agent |
| 额外目录 | `skills.load.extraDirs` | 本机全 Agent |

### 5.3 Allowlist 继承
- 省略 `agents.defaults.skills` → 无限制
- 省略 `agents.list[].skills` → 继承默认
- 空数组 `skills: []` → 无 Skill
- 非空 → 最终集合（不与默认合并）

## 6. 防护栏（三层）

### 6.1 Tool Policy
```typescript
{
  tools: {
    profile: 'coding',
    deny: ['group:runtime', 'write', 'edit'],
    elevated: { enabled: false }
  },
  channels: {
    whatsapp: {
      groups: { '*': { tools: { deny: ['group:runtime'] } } }
    },
    telegram: {
      groups: {
        '*': {
          tools: { deny: ['group:runtime'] },
          toolsBySender: { '123456789': { alsoAllow: ['write'] } }
        }
      }
    }
  }
}
```
**核心原则：** "deny 覆盖 allow"，两层强制——逻辑策略 + 提升执行域控制。

### 6.2 Sandbox
- mode：`off` / `non-main` / `all`
- scope：`session` / `agent` / `shared`
- backends：Docker（默认）/ OpenShell（远程）/ SSH（远程主机）

**最佳实践：** 拆分"接入 Agent"（路由）与"执行 Agent"（隔离 sandbox + 受限授权）。

### 6.3 Audit
关键字段：`traceId`, `agentId`, `tool`, `decision`（allowed/denied）, `reason`。诊断默认脱敏，避免日志记密钥。

### 6.4 Exec Approval
"Secret Brokers" 防止明文凭证暴露；危险操作（exec/bash）进入 `approval-pending` 状态，需 Web UI 人工确认才执行。

## 7. 与 Helm 逐项对比

| 维度 | OpenClaw | Helm 当前 | 差异 / 借鉴 |
|---|---|---|---|
| 多租户 | ❌ 单租户假设 | ✅ 工作区优先多租户 | Helm 不能直接套 |
| Skill 形态 | SKILL.md 自然语言 + 可选代码 | TS worker 类型化 | **借鉴**——双层结构 |
| Skill schema | 标准化 frontmatter | 无统一规范 | **借鉴**——制定 Helm 自己的 frontmatter |
| 三级加载 | L1 名片 / L2 手册 / L3 资源 | 全量注入 | **借鉴**——降低 LLM 上下文成本 |
| 加载优先级 | 6 层 hierarchy | 模糊 | **借鉴**——制定 Helm 加载优先级 |
| Tool policy | 渠道+sender hierarchical deny | worker 边界（代码层） | **借鉴**——配置化策略 |
| Sandbox | Docker/OpenShell/SSH 可插拔 | 不明确 | **借鉴**——Pack 商业版默认 Docker |
| Exec approval | 危险操作 → Web UI 人工确认 | "建议 vs 承诺"边界 | **超越**——Helm 默认所有对外动作要复核 |
| Audit | traceId/agentId/tool/decision/reason | 推进链全审计 | 平齐 |
| ReAct 循环 | Brain 主导 | worker 家族编排 | 不同设计哲学 |
| 推荐 vs 承诺 | ❌ 默认自动执行 | ✅ 默认建议 | **Helm 独有** |
| 不掉案件 invariant | ❌ | ✅ 脱敏行业样板经验 | **Helm 独有** |
| Skill 自生成 | ✅ Agent 自动写 SKILL.md | ❌ | 选择性借鉴（Pack 演进期可考虑） |

## 8. Helm 借鉴决策

### 8.1 借鉴（写入 Helm 双层 Skill 规范）
1. **SKILL.md frontmatter 风格**——制定 Helm 版（name/description/version/license/pack/level/owner/...）
2. **三级加载策略**——L1 名片、L2 手册、L3 资源
3. **目录优先级层级**——6 层之于 Helm 工作区/Pack/全局/Cookbook 等
4. **Tool policy 配置化**——把 worker 边界从代码层提到配置层
5. **Sandbox 默认 Docker（商业版 Pack）**

### 8.2 不借鉴
1. **单租户假设**——Helm 必须保持工作区多租户
2. **Brain 主导的 ReAct 循环**——Helm 是 worker 家族编排（更可审计、不掉案件）
3. **Skill 自生成**——Pack 早期不开放给客户/工程师自动生成 Skill；保持质量

### 8.3 超越
1. **推荐 vs 承诺**——Helm 默认所有对外动作复核（不只是 exec/bash）
2. **不掉案件 invariant**——Pack worker 家族强制（来自脱敏行业样板经验）

## 9. 与 ClawHub 兼容性取舍

**问题：** Helm Pack Skill 是否兼容 ClawHub 格式？

**建议：** 部分兼容。

| 维度 | 选择 |
|---|---|
| Helm Cookbook（公开案例） | **完全兼容** ClawHub SKILL.md，发到 ClawHub 免费曝光 |
| Helm Pack 商业版 Skill（A/B/C） | **借鉴 schema 风格但不发 ClawHub**——商业版闭源，只在 Helm 商业版工作区可见 |
| Helm Cookbook 与 Pack 的边界 | Cookbook 是 Pack 的"公开教程版"，包含使用模式但不含商业 worker 实现 |

**好处：**
- 开源社区可以直接 import Cookbook 到自己的 OpenClaw / 类 OpenClaw 环境
- Pack 商业版保持闭源护城河
- 认证工程师 L2/L3 可以发布自己的 Cookbook Skill 到 ClawHub（绑定 Helm 品牌）

## 10. 待补充调研
1. 读 OpenClaw 源码（GitHub）——验证 token cost 公式与三级加载实现细节
2. 跑通一个 SKILL.md demo——验证调用链
3. ClawHub 商标/版权政策——确认 Helm Cookbook 上 ClawHub 没有合规风险
4. OpenClaw v2.x roadmap——观察是否往多租户演进

## 11. 数据来源
- OpenClaw 官方文档：https://docs.openclaw.ai
- OpenClaw Skills 文档：https://docs.openclaw.ai/zh-CN/tools/skills
- 防护栏文档：https://yeasy.gitbook.io/openclaw_guide/...11.4_guardrails
- 知乎《深入解析 OpenClaw Skills 扩展系统》《OpenClaw 完整配置指南》系列
- ClawHub 站点：https://clawhub.ai

## 12. 变更记录
| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-04-30 | V1 草稿 | 五组件架构 + SKILL.md schema + 三级加载 + 防护栏 + Helm 借鉴决策 |
