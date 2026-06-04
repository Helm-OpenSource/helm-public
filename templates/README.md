# templates/

本目录托管未来将抽出为独立 GitHub 仓库的骨架。

| 子目录 | 未来仓库 | 状态 | 抽取条件 |
|---|---|---|---|
| `helm-pack-template/` | helm-ai/helm-pack-template | 骨架就绪；含 public-safe Pack artifact templates | 外部 forker 验证与 owner 抽取门通过后抽出 |
| `signal-first-mile/` | helm-ai/helm-signal-first-mile | Draft；含离线 mode selector、一键 first-change proof、客户最小脱敏材料请求、Signal Quality Eval、验收卡、无依赖 JS signal ledger drop-in、HSI fixture converter、review packet generator | 交付工程师用一键 proof package、客户材料请求、脱敏 ledger、quality report、HSI fixture、review packet 和 acceptance card 跑通后抽出 |

抽取步骤见各子目录下的 `EXTRACTION_NOTES.md`。
