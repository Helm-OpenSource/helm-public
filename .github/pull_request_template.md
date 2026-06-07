## 目标 / Goal

用一句话说明本 PR 改了什么，以及为什么它属于 public Core。

One sentence describing what this PR changes and why it belongs in public Core.

## 范围 / Scope

- 主要文件或模块 / Main files or modules touched:
- Public docs 或 manifest 变化 / Public docs or manifest changes:
- UI surface（如有）/ UI surfaces, if any:

## 边界检查 / Boundary Check

- [ ] 不包含客户名称、私人联系方式、私有域名、内网 IP、凭据、私有部署证据，或商业 Pack / Overlay 实现细节。
      No customer names, private contacts, private domains, internal IPs, credentials, private deployment evidence, or commercial Pack / Overlay implementation details are included.
- [ ] 本 PR 不引入自动对外发送、广泛自动写入、自动审批、执行、结算、marketplace、plugin sandbox 或客户承诺路径。
      This PR does not introduce automatic external send, broad auto-write, automatic approval, execution, settlement, marketplace, plugin sandbox, or customer commitment paths.
- [ ] 如果修改客户可见措辞，recommendation 仍与 commitment 区分；任何高风险声明都带 boundary、prerequisite、dependency 或 non-commitment note。
      If this changes customer-facing wording, recommendation remains distinct from commitment and any risky claim has a boundary, prerequisite, dependency, or non-commitment note.
- [ ] 如果触及 integration、connector 或 data ingest path，行为保持 read-first 或 review-first，并有 fixture、dry-run 或 guard plan。
      If this touches an integration, connector, or data ingest path, the behavior is read-first or review-first and has a fixture, dry-run, or guard plan.

## 验证 / Verification

已运行命令 / Commands run:

```bash
npm run check:public-docs
npm run check:public-release
```

未运行命令及原因 / Commands not run and why:

- `npm run db:reset`:
- `npm run self-check`:
- `npm run check:boundaries`:
- `npm run typecheck`:
- `npm run lint`:
- `npm run test`:
- `npm run build`:
- `npm run e2e`:
- `npm run quality:regression`:

剩余风险 / Remaining risk:

## 评审与合并纪律 / Review And Merge Discipline

- [ ] 本 PR 通过 PR audit trail 合入；不会直接 push 到 `main` / `develop` 等受保护分支。
      This PR will merge through the PR audit trail; it will not be pushed directly to protected branches such as `main` or `develop`.
- [ ] 合入路径是二次评审通过，或 PR body 顶端已有 `Break-glass merge intended: <reason>` 并在 Owner Gate 写明 receipt。
      Merge path is either second-reviewer approval, or the PR body starts with `Break-glass merge intended: <reason>` and the Owner Gate records the receipt.
- [ ] 未使用 `--no-verify`、跳过 CI、跳过本地硬门禁；如有 owner 豁免，已在 Remaining risk 写明。
      No `--no-verify`, skipped CI, or skipped local hard gate was used; any owner exemption is documented in Remaining risk.

## 截图或录屏 / Screenshots Or Recording

UI 变化必须提供；否则写 `N/A`。

Required for UI changes. Otherwise write `N/A`.

## 贡献权利 / Contribution Rights

- [ ] 我有权按 Apache-2.0 贡献该工作。
      I have the right to contribute this work under Apache-2.0.
- [ ] 任何第三方代码或资产 license 已在本 PR 中说明。
      Any third-party code or asset license is identified in this PR.

## Owner Gate

仅当 release、certification、external commitment、official brand wording、高风险边界或 protected-branch break-glass 变化时需要。

Required only for release, certification, external commitment, official brand wording, high-risk boundary, or protected-branch break-glass changes.

- Owner decision needed: `yes` / `no`
- Decision or receipt:
