# Pack Artifacts / Pack 交付 Artifacts

> **语言 / Language**: **中文主文本** + **English reference**

> 把客户问题转成 review-first Pack evidence 的 public-safe templates。
>
> Public-safe templates for turning a customer problem into review-first Pack evidence.

这些文件是给 delivery engineers 的 checked-in templates。它们不是 runtime modules、
database schema、API contracts 或 workflow / orchestration engines。

These files are checked-in templates for delivery engineers. They are not runtime
modules, database schema, API contracts, or workflow/orchestration engines.

## Artifact Flow / Artifact 流程

```text
Context Packet
  -> Pack Studio safe sample
  -> Evidence Matrix
  -> Review-Ready Work Pack
  -> Proof Loop closeout
```

## Files / 文件

| File | Purpose |
|---|---|
| `context-packet.template.json` | Capture redacted context rows before Pack work starts. |
| `pack-studio.sample.csv` | Model safe sample rows and review gates in a spreadsheet-friendly format. |
| `evidence-matrix.template.csv` | Track claim-level evidence states before anything becomes a proof candidate. |
| `work-pack.template.md` | Define the static work artifact that prepares review, not execution. |
| `proof-loop-closeout.template.md` | Close a 7-day Run with action-level 72h outcomes and claim boundaries. |

## Boundaries / 边界

- 只使用 synthetic 或 redacted sample data。/ Use synthetic or redacted sample data only.
- 不包含客户名称、真实邮箱、手机号、私有 domain、内网 IP、secret、部署细节或客户专属配置。/ Do not include customer names, real emails, phone numbers, private domains, intranet IPs, secrets, deployment details, or customer-specific configuration.
- 不用这些模板 auto-send、auto-approve、auto-execute、silent CRM write 或创建 public claims。/ Do not use these templates to auto-send, auto-approve, auto-execute, silently write CRM fields, or create public claims.
- Public 或 customer-visible claim 需要单独 customer authorization 与 claim review process。/ Public or customer-visible claims require separate customer authorization and a separate claim review process.
- Legal、medical、financial advice、compliance 等 regulated domains 需要单独 RFC 与 qualified professional review。/ Regulated domains require a separate RFC and qualified professional review.
