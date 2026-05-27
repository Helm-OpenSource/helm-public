# Case Management Sample

`extensions/case-management-sample/` 是 Helm 公开仓库附带的最小 vertical 参考包。

- 只包含 `synthetic` / `public-safe` 示例
- 只证明 pack 结构、signal/worker cookbook 形态和 HSI 契约
- 不代表 production-ready vertical
- 不连接 tenant-private 连接器、数据库或外发通道

起步入口：

1. 读 `tenant.manifest.json`
2. 读 `hsi-pack.manifest.json`
3. 看 `fixtures/case.sample.json`
4. 从 `signals/` 和 `workers/` 的最小样例开始 fork
