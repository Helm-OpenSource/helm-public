# Resource reservation contract / 资源预留协议

This module accepts decoded plain data, copies and freezes it, and produces a
stable, version-separated demand digest. It does not implement a store or make a
caller-provided identity, topology or proof reference trustworthy. Proxy objects
and executable in-process adversaries are outside the decoded-data boundary.

本模块只接受解码后的普通数据，复制并冻结结果，计算版本隔离的稳定需求摘要。
类型、摘要、proofRef 均不是身份或签名认证，也不代表数据库事务已经完成。

```ts
import { normalizeReserveRequest, type AtomicResourceReservationPort }
  from "./contract";

// The trusted composition root supplies an authenticated transactional adapter.
async function reserveExample(store: AtomicResourceReservationPort) {
  const request = normalizeReserveRequest({
    operationRef: "operation:example",
    topologyRevision: "revision:example",
    requirements: [
      { scopeRef: "resource:shared", generation: 1, units: 1 },
      { scopeRef: "resource:local", generation: 2, units: 1 },
    ],
  });
  return store.reserveAll(request);
}
```

An adapter must revalidate authorization, trusted topology and the complete
request. It must reserve all resources and preserve idempotency atomically.
Identical duplicate demand is a repeated path to the same scope, not extra units;
independent consumption is aggregated explicitly before normalization. A digest
covers demand, not topology or operation identity. Retry equality includes the
whole request. Request builders accept only documented input fields; the reserve
builder `normalizeReserveRequest` takes the three-field `ReserveRequestInput`,
computes its digest and rejects a supplied vectorDigest. At the receiving wire
boundary, use `validateReserveRequest` on the full four-field request; it
recomputes and compares the digest and supports JSON roundtrips. Neither operation
authenticates the request.

适配器必须重新认证完整请求，以事务实现全资源预留和幂等；同 scope 的相同需求
去重，不累加，独立消耗由领域层先汇总。重试必须比较完整请求而非只比较向量摘要。

Release is per resource and requires separately verified domain evidence matching
the frozen operation and claim generation. Unknown state, an elapsed deadline or
network error is not evidence of release. An expired lease must never silently
return capacity. Store implementations require real concurrent database tests;
this pure contract suite does not prove those obligations.

释放需要逐资源核验终态证据；UNKNOWN、租期到期和网络错误不证明资源已释放。
真实并发与数据库原子性需适配器的集成测试，本模块测试不能替代。

Run `npm test -- lib/resource-reservation/contract.test.ts --cache=false`.
The existing public Vitest include and CI `npm run test` discover this test.
