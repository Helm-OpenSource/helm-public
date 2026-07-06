# scripts/archive/

一次性/时点性脚本的归档区。进入此目录的脚本满足全部条件：

1. 未被 `package.json` scripts 接线；
2. 在本仓（含 `.github/`、docs、lib 回归测试）以及产品交付涉及的其余
   拆分仓库中按文件名 stem 全文检索均为零引用；
3. 属历史时点产物（sprint evals、phase planning、迁移/校准/一次性回填等），
   不再参与任何验证门禁。

归档于 2026-07-06 结构梳理（100 个：`business-advancement-*` 32、
`helm-v2-*` 36、`ask-helm-*` 3、其余为一次性运维/迁移/评测脚本，含
`sqlite-to-mysql-migration.ts`）。

约定：

- 本目录不参与 typecheck / lint / test 门禁，不保证可运行；
- 需要复用时先移回 `scripts/` 并重新接线、补验证；
- 确认彻底无用后可整目录删除（git 历史兜底）。
