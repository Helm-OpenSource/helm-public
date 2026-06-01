# SKILL.md frontmatter 字段参考

> 与 Helm 主仓 docs/product/HELM_PACK_SKILL_DUAL_LAYER_SPEC_V1.md §4 对齐。

## 必填字段
| 字段 | 类型 | 约束 |
|---|---|---|
| `name` | string | ≤64 字符，小写字母/数字/连字符 |
| `description` | string | ≤1024 字符，非空，建议中英双语 |
| `pack` | string | Pack ID |
| `version` | string | semver |
| `license` | string | `Apache-2.0` / `proprietary` / 自定 |

## helm.* 字段（建议默认值，不锁死）

| 字段 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `helm.level` | string | `certified` | basic / pro / certified / community |
| `helm.multi_tenant` | bool | `true` | 工作区多租户（与 OpenClaw 单租户区分） |
| `helm.recommendation_only` | bool | `true` | 默认建议；任何对外动作要复核 |
| `helm.audit_required` | bool | `true` | 进 audit chain |
| `helm.invariant` | string | `case-no-drop` | 不掉案件 invariant |
| `helm.workspace_scope` | string | `workspace` | workspace / manager_only / member |

**软化原则：** `recommendation_only`、`invariant`、`multi_tenant` 是**建议默认值**——如 Pack 决定不采用需在 Pack 调研文档中说明理由。

## requires.* 字段
| 字段 | 类型 | 用途 |
|---|---|---|
| `requires.models` | string[] | 可用模型供应商列表（不绑定单一） |
| `requires.connectors` | string[] | 必须的连接器 |
| `requires.permissions` | string[] | 工作区权限 |

## metadata.* 字段
| 字段 | 类型 | 用途 |
|---|---|---|
| `metadata.industry` | string | ICP id |
| `metadata.trigger` | string | 事件类型 |
| `metadata.pack_skill` | string | Pack 内 Skill 编号（如 A1） |
| `metadata.emoji` | string | UI 图标 |

## acceptance.* 字段
作业质量门槛（强约束 B）：

| 段 | 含义 |
|---|---|
| `acceptance.pilot_4w` | 历史字段名；表示 pilot 量化验收目标，不作为公开 4 周交付承诺 |
| `acceptance.steady_6m` | 6 月稳态量化目标 |
| `acceptance.business_readable` | 业务侧可读验证机制 |

## 完整示例
见 `pack-template/skills/example-skill/SKILL.md`。
