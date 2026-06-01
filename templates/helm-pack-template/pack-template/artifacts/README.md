# Pack Artifacts

> Public-safe templates for turning a customer problem into review-first Pack evidence.

These files are checked-in templates for delivery engineers. They are not runtime modules, database schema, API contracts, or workflow/orchestration engines.

## Artifact Flow

```text
Context Packet
  -> Pack Studio safe sample
  -> Evidence Matrix
  -> Review-Ready Work Pack
  -> Proof Loop closeout
```

## Files

| File | Purpose |
|---|---|
| `context-packet.template.json` | Capture redacted context rows before Pack work starts. |
| `pack-studio.sample.csv` | Model safe sample rows and review gates in a spreadsheet-friendly format. |
| `evidence-matrix.template.csv` | Track claim-level evidence states before anything becomes a proof candidate. |
| `work-pack.template.md` | Define the static work artifact that prepares review, not execution. |
| `proof-loop-closeout.template.md` | Close a 7-day Run with action-level 72h outcomes and claim boundaries. |

## Boundaries

- Use synthetic or redacted sample data only.
- Do not include customer names, real emails, phone numbers, private domains, intranet IPs, secrets, deployment details, or customer-specific configuration.
- Do not use these templates to auto-send, auto-approve, auto-execute, silently write CRM fields, or create public claims.
- Public or customer-visible claims require separate customer authorization and a separate claim review process.
- Regulated domains such as legal, medical, financial advice, or compliance require a separate RFC and qualified professional review.
