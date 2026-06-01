> **Language / 语言**：**English** · [中文](SECURITY.md)

# Security Policy

Helm is explicitly in the "controlled pilot" stage. This document covers:

1. The current security-posture boundary
2. Private vulnerability-disclosure channels and our time commitments
3. Issue types that are out of scope for this repository
4. Additional notes for the public trial environment

---

## 1. Current Security Posture

Please confirm the following boundaries before submitting a report or starting a security audit.

### 1.1 Controlled pilot, not a production-grade enterprise platform

- **Authentication**: database-backed session auth today; **not** full production-grade SSO / SCIM
- **Multi-tenant isolation**: based on workspace + membership; has not passed a full enterprise multi-org isolation audit
- **Plugin runtime**: there is **no real sandbox**; extensions run in the same trust domain as the main process
- **Audit completeness**: audit events cover key write paths but do not constitute an immutable audit-log system

If you are looking for enterprise SSO, full SCIM, immutable audit, tenant-level KMS, or an isolated plugin sandbox — none of these are in the repo today. Open an issue if you'd like to discuss roadmap fit.

### 1.2 No auto-write / auto-send authority by default

Helm by default does **not** auto-write or auto-send to external systems:

- No auto-approval
- No auto-send: email / DingTalk / WeCom / SMS
- No auto-settlement / auto-payment
- No cross-workspace auto-aggregation or auto-promotion

Any code path that appears to enable the above should be treated as a defect or privilege escalation — please report it.

### 1.3 China market & public trial environment

The public trial environment (Cloud Trial) is deployed in Alibaba Cloud cn-hangzhou:

- RDS MySQL / ECS / OSS / SLS / DirectMail (enabled by default)
- OpenAI API (disabled by default; explicit consent required to enable)
- Payment capability (disabled by default in the public trial)

Data retention and sub-processors are governed by the workspace contract and the effective data policy. The current draft is [docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) (Chinese), pending final legal alignment before public release.

---

## 2. Vulnerability Disclosure Process

### 2.1 Do not disclose publicly

Please do **not** report undisclosed security vulnerabilities through:

- Public GitHub issues
- Public GitHub Discussions
- Public PRs
- Social media

### 2.2 Private disclosure channels

Please use one of the private channels:

- **Email**: `security@helm.run` (preferred)
- **Encryption**: if you need PGP, mention it in the email and we will reply with a public key

In the report, please include where possible:

- **Reproduction steps**: minimal reproducible path with version (commit hash, release tag, or deployment URL)
- **Impact assessment**: your view of severity and the affected assets / data
- **PoC**: optional, but helpful for verification
- **Suggested fix direction**: optional

### 2.3 Our response-time commitments

| Stage | Window |
| --- | --- |
| Acknowledge receipt | Within 3 business days |
| Initial assessment + severity | Within 7 business days |
| Fix or mitigation | P0/P1: within 30 days; P2/P3: within 90 days |
| Coordinated disclosure window | Negotiated after the fix lands; default ≤ 90 days |

If you have not received a substantive response within 30 days, feel free to follow up — or raise it publicly **without disclosing details**.

### 2.4 Acknowledgement

With the reporter's consent, we acknowledge contributions in [CHANGELOG.md](CHANGELOG.md) / [CHANGELOG.en.md](CHANGELOG.en.md) and release notes. If you prefer to remain anonymous, please say so in your report.

---

## 3. Scope

### 3.1 In scope

- Authentication & session-management defects
- Privilege escalation / cross-workspace access
- SQL injection, command injection, SSRF, XSS, CSRF
- Sensitive data leakage (including secrets in logs / responses)
- Deserialization & unsafe input handling
- Public-trial isolation failures
- CI / CD pipeline & supply-chain risks
- Known CVEs in dependencies (please cite the CVE id)

### 3.2 Out of scope by default

The following do not constitute valid vulnerabilities by default unless paired with an executable impact scenario:

- Theoretical risks under unenabled configuration (e.g., placeholder when `OPENAI_API_KEY` is unset)
- Low-confidence output from automated scanners
- Missing security headers without an executable attack path
- Known controlled-pilot boundaries (plugin sandbox absence, incomplete SSO, etc., per §1)
- DDoS / resource exhaustion (controlled pilot does not commit to SLA)
- Social engineering / phishing
- Physical attacks

If you are unsure whether something is in scope, send a short low-confidentiality summary first — we will evaluate and reply.

---

## 4. Notes for the Public Trial Environment

Public-trial users please also note:

- Do not submit real production data during the trial; the trial environment **does not commit to SLA**
- Data retention is governed by the workspace contract and effective data policy; 30/7 remains the current legal-review target, not a public commitment
- Deletion request, revocation window, physical deletion and attestation email behavior follow the effective data policy

If you observe what appears to be unauthorized access in the public-trial environment, please use the §2.2 channels.

---

## 5. Routine Security Practices

Routine security practices we invest in (disclosure, not commitment):

- Monthly `npm audit` / `gh dependabot` runs and P0/P1 fixes
- `/security-review` and the regression chain run before each release
- `scripts/decision-first-boundary-check.ts` guards the recommendation/commitment boundary and the tenant-slug reverse boundary
- `scripts/public-release-guard.ts` guards critical files before public release
- Code review and least-privilege on critical paths
- No telemetry collection unrelated to operations by default

---

## 6. To Researchers

We welcome compliant security research on Helm. Please:

- **Do not** run destructive testing or large-scale scans against production or the public trial
- **Do not** access, download, modify, or delete data from other workspaces
- **Do not** run social engineering against other users without explicit authorization
- **Do not** violate the laws of your jurisdiction

For research within these bounds, we commit not to pursue legal action.

---

## 7. License & Attribution

This file is released with the repository under [Apache-2.0](LICENSE).
