---
status: active
owner: helm-core
created: 2026-10-06
review_after: 2026-11-06
public_safety: Generic metadata protocol and synthetic verification; no deployment roots, credentials or provider invoices.
---

# 独立用量证据与同事务核销 / Independent usage and atomic settlement

Core 默认没有 collector、生产签审根或普通付费组合。`installOrdinaryPaidServerBootstrap` 仍须显式接入同数据库的三个不同 principal：应用 writer、charge、insert-only collector。空 map、未知 schema、失效 grant 不产生收费许可。本单元只是可复刻的 generic 合成协议，不能据此声称生产月度上限生效。

`createGovernedOrdinaryHttpAdapter` 固定 server composition 的 endpoint/registration/key/grant，不接受 task URL、金额或证据。endpoint fingerprint 从实际规范化 origin/path 重算；不跟随 redirect、不重试，有界 body/deadline 和真实 AbortSignal。`probeReadiness` 不冒充模型探测成功；持久路由与 readiness 必须由独立来源提供。真实 provider 的认证、完整 SKU/cached/reasoning 账单和正式授权尚未提供。

协议 `helm.controlled-model-response/v1` 要求原始有界 UTF-8 canonical JSON：唯一 requestId、opaque requestRef、完整 prompt/completion/total 与确定 modelVersion/output。未知类别、缺字段、重复键、坏 UTF-8、越界数字及非 200 都是 unknown，不从 HTTP 错误推断未接受，也不补零。

collector 先读真实 claim/runtime、预约原价格与汇率，独立持久签名元数据；证据表不存 prompt、output、URL 或明文 provider ref。collector 的签名证明本方受控采集，不是 provider 签名。grant/content hash 只是固定完整性来源，不等于 owner 审批或代码执行来源证明。生产 provisioning 与 signer/source/principal 根仍须独立提供，公开仓没有发行端点或默认密钥。

`createRegisteredGovernedSpendAuthority` 只有可选受钉 usage map 才消费证据；缺省行为仍拒绝终态。原 charge SERIALIZABLE tx 锁原 claim/ledger，重验独立证据、原签名价格/FX/预算/期间及原 quote，从实际 units 以 BigInt 原规则重算，再原子提交 sequence2/settled/counter。工作区后来改价不会改写预约历史；过期/撤销和无法证明的响应保留占额。

已提交而 ACK 丢失，只允许同原键 committed readback，不再 HTTP；没有提交或已为 unknown 的迟到证据仍不自动核销。旧 bridge 是否交付正文服从其原语义，不从“状态成功”生成正文。此接口不是 unknown→settled 恢复工具。

## 合成验证 / Synthetic verification

```sh
npm run test:trusted-usage-evidence:mysql
npm run check:model-egress-governance
```

required `Model Egress MySQL` job 使用空库完整迁移、不同合成账号及真实 loopback HTTP，执行全部原 MySQL cases 和新的纯验证；缺 required 配置失败，不用 skip 证明阳性。本机只准自有 Unix socket 私有库或该 CI service；禁止生产 DSN/客户值。没有真实 provider/SKU/部署/密钥/安装证据，生产资格始终 unknown。

迁移 `20261006090000_llm_trusted_usage_evidence` 追加两个空表，签名单位为 signed BIGINT 并有显式范围/JSON witness CHECK；UPDATE/DELETE 被触发器拒绝。收回此 opt-in 组合可恢复旧关闭路径；不能 DROP 非空证据、补零、移除旧账本或修改审计历史。

## 版本化启动屏障 / Versioned startup barrier

`instrumentation.register()` 通过固定 Core `server-bootstrap-binding.ts` 准入 slot 调用通用私有 aggregator。旧 `registerAllPacks():void` 注册保持同步；新 `helm.server-bootstrap/v1` ABI 分别声明 `serverBootstrapVersion`、`serverBootstrapMode` 和 `registerServerBootstrap():Promise<void>`。当前公开 slot 为 `legacy-optional`，旧缺失 aggregator 仍可 Core-only。版本化 optional 只接受 disabled；required 不能由模板、env 或请求自行选择。源树、部署身份、支付 authority 必须独立验证。

启动缓存跨 Next server bundles 在同一进程共享：成功或失败都不重试；slot policy 不同则拒绝。required 失败在原 crons/DB-derived spend observer 导入前抛出，不降级 Core-only。10秒超时只拒绝启动，不取消已经调用的异步 initializer；晚完成仍可能产生自身副作用，但不能把缓存拒绝转成成功。未来真实 required 安装需独立的取消/安装承诺合同和收费来源根，本片不发行它们。Next 宿主可保留进程并对请求返回500，进程存活不等于 readiness。

`npm run test:server-bootstrap` 是 required Linux `Test` job 的真实 Next build/start 目标，使用 reserved 合成贡献、实际 registry/instrumentation/transitive source，以及实际 Prisma 构造计数与禁止连接的测试观察器。它不证明整个应用无 Prisma，不安装收费组合、不调用 provider 或数据库。生产价格、SKU、用途、预算及凭据仍 unknown。

The fixed Core slot controls source admission only. Legacy registration remains compatible; versioned initialization is awaited once per process. Required refusal is sticky and precedes downstream startup. Timeout cannot cancel an initializer already invoked; future paid installation needs an independent cancellation/commit contract. Synthetic Next evidence is neither payment approval nor production readiness.
