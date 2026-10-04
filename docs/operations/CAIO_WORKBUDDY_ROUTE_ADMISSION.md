---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-10-05
review_after: 2026-11-05
public_safety: Public source contract and synthetic loopback verification only. No deployment approval, private identity, credential or customer data.
---

# WorkBuddy 路由准入 / WorkBuddy route admission

`POST /api/runtime/caio/workbuddy` 先检查固定源码绑定，再读取边缘入口配置和请求体。
绑定不是请求参数，也不从环境变量选择。Core 默认 `legacy-configured` 保留既有边缘只读
入口语义；部署需要关闭此入口时，组合方必须在独立认证的源码与产物链中安装并验证
`disabled` 固定绑定。此模块没有启用授权、设备注册或生产身份发行功能。

## 固定合同

`lib/caio-collaboration/runtime-binding.ts` 提供且只提供三项字段：

- `schemaVersion`: `helm.caio.workbuddy-route-binding.v1`；
- `routePath`: `/api/runtime/caio/workbuddy`；
- `mode`: `legacy-configured` 或 `disabled`。

`admitWorkBuddyRoute` 仅解析闭形普通对象，不把对象形状、摘要或调用方自填字段当批准。
固定绑定仍依赖外层独立验证的构建与安装来源。未知 schema、路径、mode、额外字段、
访问器和 Proxy 均拒绝。`disabled` 和未知绑定返回原有固定 503 响应，不读取边缘凭据、
headers 或 body，不加载此路由的 Prisma 依赖。环境中声称的部署身份不能改变绑定。

`legacy-configured` 继续要求既有入口凭据和工作区配置；缺配置仍 503，GET 仍 405。
有效配置下，原 1 MiB body 上限、JSON 校验、入口身份、成员权限和只读工具合同不变。
数据库、workspace resolver 与 Prisma dispatcher 在配置和 JSON 校验之后才动态加载。
这只限定本路由的加载边界，不代表整个 Web 应用没有 Prisma import 或数据库使用。

## 可重复验证

```bash
npm run test:caio-workbuddy-route
npm run typecheck
npm run lint
npm run check:boundaries
```

必需 CI 的 Node 22 test job 运行同一目标，无缺失依赖 skip 分支。目标包含闭形绑定与
真实 POST 单元回归、既有 edge/dispatcher 合同，以及三份真实 Next production build /
loopback start：原 legacy、固定 disabled、未知固定绑定。夹具复制实际 route 的静态、
动态和类型依赖闭包，使用本次 lock-pinned 安装；不替换 POST 或认证处理器。

loopback 观察器在测试进程内包装真实 Prisma constructor，并计数、拒绝 connect/query。
legacy 配置正对照实际构造 Prisma；disabled/unknown 构造、连接和查询都为零。测试只
使用保留的合成元数据，HTTP 仅允许本次服务的 `127.0.0.1` 有效端口和两条固定路径，
不解析外部主机、不跟随重定向；不连接数据库、不访问 provider、不使用真实边缘凭据。
夹具关闭所有本次 Next 进程并清理临时目录。

源码验证不证明实际部署已安装关闭绑定，也不证明独立来源授权、设备接入、数据库或
生产激活。后续组合消费者必须验证自身绑定与产物身份，不得在准入前提前引入其他
CAIO server/store 的数据库链。

English: a fixed source slot preserves the legacy default or denies the WorkBuddy route before
configuration, request access and its database dependency loading. The slot is not an authority
issuer or an environment-selected deployment identity. Real Next loopback fixtures verify the
route boundary with an actual Prisma constructor positive control and blocked database I/O;
installation, independent source approval and production activation remain separate evidence.
