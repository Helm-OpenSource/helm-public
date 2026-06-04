# Pack Artifacts / Pack 交付工件

> **语言 / Language**: **中文主文本** + **English reference**

> 把客户问题转成复核优先 Pack 证据的公开安全模板。
>
> Public-safe templates for turning a customer problem into review-first Pack evidence.

这些文件是给交付工程师的入库模板。它们不是运行时模块、数据库模式、API 契约或
工作流 / 编排引擎。

These files are checked-in templates for delivery engineers. They are not runtime
modules, database schema, API contracts, or workflow/orchestration engines.

## Artifact Flow / 工件流程

```text
Context Packet
  -> Pack Studio safe sample
  -> Evidence Matrix
  -> Review-Ready Work Pack
  -> Proof Loop closeout
```

## Files / 文件

| 文件 | 用途 |
|---|---|
| `context-packet.template.json` | 在 Pack 工作开始前采集脱敏上下文行。 |
| `pack-studio.sample.csv` | 用适合表格的格式建模安全样例行和复核闸门。 |
| `evidence-matrix.template.csv` | 在任何内容成为证明候选前追踪声明级证据状态。 |
| `work-pack.template.md` | 定义准备复核、而不是准备执行的静态工作工件。 |
| `proof-loop-closeout.template.md` | 用动作级 72 小时结果和声明边界收口 7 日运行。 |

## Boundaries / 边界

- 只使用合成或脱敏样本数据。/ Use synthetic or redacted sample data only.
- 不包含客户名称、真实邮箱、手机号、私有域名、内网 IP、密钥、部署细节或客户专属配置。/ Do not include customer names, real emails, phone numbers, private domains, intranet IPs, secrets, deployment details, or customer-specific configuration.
- 不用这些模板自动发送、自动审批、自动执行、静默写入客户关系系统字段或创建公开声明。/ Do not use these templates to auto-send, auto-approve, auto-execute, silently write CRM fields, or create public claims.
- 公开或客户可见声明需要单独客户授权与声明复核流程。/ Public or customer-visible claims require separate customer authorization and a separate claim review process.
- 法律、医疗、财务建议、合规等受监管领域需要单独 RFC 与合格专业人士复核。/ Regulated domains require a separate RFC and qualified professional review.
