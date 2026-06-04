# Signal First Mile Extraction Notes

Target future repository: `helm-ai/helm-signal-first-mile`.

Do not extract this template until:

1. At least one delivery engineer has used a redacted ledger to prepare an HSI fixture.
2. The ledger-to-quality-report-to-fixture path has a public-safe receipt.
3. The drop-in and converter files still have no default network transport, no credentials, and no customer-system writeback.
4. The public method doc, Signal Quality Eval, and HSI eval remain aligned.

Extraction must preserve the review-first boundary:

- no automatic external send
- no automatic approval
- no automatic writeback
- no raw customer data by default
- no memory promotion without human review
