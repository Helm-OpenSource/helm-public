---
status: V1 (released with v0.1.0-trial)
owner: helm-core
created: 2026-05-18
review_after: 2026-06-30
audience: delivery engineers wiring up their customer's existing systems via Helm
public_safety: Intended for the public mirror. No tenant-private references.
---

# Integration Template / 集成模板

> **语言 / Language**: **中文主文本** + **English reference summary**

## English Reference Summary

This template defines what a Helm connector / adapter contributor must prepare
before implementation: the customer use case, data flow, auto / review / never
boundary table, OAuth or API-key security checklist, fixture and dry-run plan,
user-visible naming rules, and disconnect / export behavior.

The default acceptable path is source-intake-first: diagnostic material, fixture
or dry-run proof, then read-only or review-first connector work. Automatic
external send, automatic approval, and automatic write-back are outside the
current PR boundary. A contributor who cannot answer the use case, data flow,
and boundary questions should open an `integration: <system>` issue first.

> 接你客户的现有系统是你的核心交付动作——这一份模板告诉你做一个 Helm 集成（连接器 / 适配器）需要交付的全部内容、按什么顺序、用什么边界。

适用：你正在给 Helm 加一个新的只读 / 草稿型连接器（客户关系系统 / 即时消息 / 邮件 / 日历 / 会议 / 支付 / 大模型等）。

不适用：你想做自动外发 / 自动审批 / 自动写回类的连接器——这超出当前可接受 PR 边界（见 [README.md §可接受 PR 的边界](../../README.md#可接受-pr-的边界)）。

---

## 0. 数据接入先走 3 阶段

新增或改造连接器前，先按 [Helm 数据接入体验](../product/HELM_DATA_INTAKE_EXPERIENCE.md)
收敛证据路径：

| 阶段 | 目标 | 典型交付物 | 不代表 |
|---|---|---|---|
| L0 diagnostic intake | 说明客户现在能给什么材料、能形成什么经营信号 | signal ledger、customer materials request | connector 授权、客户系统写回 |
| L1 fixture / dry-run | 用 redacted / synthetic fixture 证明 mapper、eval 和 review packet | fixture、signal-quality report、HSI eval、review packet | 生产 freshness、客户部署批准 |
| L2 read-only connector | 在最小 scope、审计 trace 和撤销路径齐备后接只读采集 | read-only ingest、failure posture、quarantine / retry path | 写回、外发、审批执行、正式 memory promotion |

只有 L0/L1 的材料和边界能说清楚，才进入 L2。L3 写回、客户可见外发和审批执行不属于
public Core 默认接入路径。

---

## 1. 在写代码前的 90 秒

问自己 3 个问题，答不上来就先开 `integration: <system>` 议题：

1. **客户用例**：你客户在这个系统里**真实做什么动作**？哪些动作是经营信号（销售推进 / 客户复核 / 会议承诺）？
2. **数据流向**：数据从 `<external system>` 进入 Helm 后，**落到哪个 object**（Deal / Account / Meeting / SignalEvent / MemoryItem）？反向是否需要回写？
3. **治理边界**：哪些动作走自动 / 哪些走复核 / 哪些永远手动？**默认全部复核** 起步，明确安全的只读动作才能走自动。

---

## 2. 集成的 6 个交付物

每个新连接器 PR 默认需要交付**这 6 个**。少一个 = 还没完成。

| # | 交付物 | 文件 / 位置 |
|---|---|---|
| 1 | 数据流声明 | 本模板 §3 表格嵌入到连接器 README |
| 2 | 边界三轨表（自动 / 复核 / 永远手动） | 本模板 §4 表格嵌入到连接器 README |
| 3 | OAuth + API key 安全清单 | 本模板 §5 已勾选清单嵌入到连接器 README |
| 4 | 测试夹具 + 预演模式 | `lib/connectors/<name>/fixtures/` + `*.test.ts` |
| 5 | 用户可见命名规范 | 本模板 §7 检查表 |
| 6 | 退出与数据回收 | 本模板 §8 接入 `/settings` 自助导出与退出流程 |

---

## 3. 数据流声明模板

复制下表，填到你连接器 README 的最前面：

```markdown
| 维度 | 内容 |
|---|---|
| 连接器名称 | <name>（必须符合 §7 命名规范） |
| 上游系统 | <external system>（含官方域名 / OAuth 提供方） |
| 数据方向 | 仅入站 / 入站 + 出站草稿 / 入站 + 先复核出站 |
| 拉取频率 | 手动 / 按需 / 按 `<interval>` 定时 |
| 落地对象 | <Helm domain objects: Deal / Account / Meeting / SignalEvent / etc.> |
| 落地界面入口 | <Helm route: /dashboard / /approvals / /memory / etc.> |
| 失败降级 | <降级策略：空提示条 / 缓存 / 合成占位> |
| 凭据持久化 | 加密存储字段名 + 加密 key 来源（CONNECTOR_TOKEN_SECRET） |
| 追踪写入 | 写入 `traceId` 的关键路径（list） |
```

填写示例（DingTalk 只读目录）：

```markdown
| 维度 | 内容 |
|---|---|
| 连接器名称 | dingtalk |
| 上游系统 | DingTalk Open API（oapi.dingtalk.com） |
| 数据方向 | 仅入站 |
| 拉取频率 | 按需（用户在 /settings 点击同步） |
| 落地对象 | 工作区成员目录 + 会议采集元数据 |
| 落地界面入口 | /settings?tab=connectors · /meetings |
| 失败降级 | 显示提示条 / banner "DingTalk 临时不可用"，缓存最近一次成功同步结果 |
| 凭据持久化 | `connector_credential.encryptedToken`，通过 `storeConnectorToken()` 写入；版本化 AES-GCM + `CONNECTOR_TOKEN_SECRET_ID`，轮换期配置 previous secret |
| 追踪写入 | 目录同步 / 邀请审批通过 |
```

---

## 4. 边界三轨表

每个连接器必须显式声明：哪些动作自动、哪些动作复核、哪些动作永远手动。

模板：

```markdown
| 动作 | 轨道 | 依据 |
|---|---|---|
| Read user profile | auto | OAuth 范围最小化，不向外回传个人信息 |
| Read meeting metadata | auto | 定时读取，只读 |
| Capture meeting transcript | review | 高风险，需用户复核后才进入经营记忆 |
| Send invitation message | never | 客户可见外发，永远手动 |
| Write back to CRM | never | 客户系统写入，永远手动复核后才能落 |
```

**默认规则**：

- 任何**读取** = 默认自动，前提是 OAuth 范围最小化
- 任何**草稿生成**（草稿消息 / 建议回复等） = 默认复核
- 任何**客户可见外发 / 写回 / 状态变更** = 默认永远手动；只有显式人工复核 + 明确授权按钮才能成立

不允许的：

- ❌ `auto-send`：客户可见外发不能自动执行
- ❌ `auto-approve`：审批不能自动通过
- ❌ `auto-write-back-on-llm-suggestion`：大模型建议不能直接自动写回客户系统

---

## 5. OAuth + API key 安全清单

构建基于 OAuth 的连接器时勾选下面 12 条：

```markdown
- [ ] OAuth 范围最小化（只要读不要写，只要元数据不要个人信息）
- [ ] state 参数防 CSRF（每次 OAuth flow 随机生成）
- [ ] PKCE 启用（mobile / SPA 场景必须）
- [ ] redirect_uri 写死在 server side，不允许 query 注入
- [ ] access_token 通过 `storeConnectorToken()` 加密存储（不写明文，不写客户端）
- [ ] refresh_token 通过 `storeConnectorToken()` 加密存储（如适用）
- [ ] 凭据持久化字段加密 key 走 `process.env.CONNECTOR_TOKEN_SECRET`，密钥版本走 `CONNECTOR_TOKEN_SECRET_ID`
- [ ] 密钥轮换时先配置 `CONNECTOR_TOKEN_SECRET_PREVIOUS` / `CONNECTOR_TOKEN_SECRET_PREVIOUS_ID`，确认旧 token 重写后再清空
- [ ] 凭据失效时显式降级，提示条 / banner 给用户重新授权入口
- [ ] OAuth 回调处理器写审计日志（含 traceId）
- [ ] 撤销 OAuth 时清理凭据 + 相关缓存
- [ ] 没有硬编码客户专属的 token / secret
- [ ] `npm run check:public-release` PASS（连接器目录不出现 tenant slug / 真实凭据 / 内部 host）
```

API key（非 OAuth）模式额外勾选：

```markdown
- [ ] key 不写入 git history（参考 [scripts/secret-history-check.ts](../../scripts/secret-history-check.ts) 已知指纹）
- [ ] key 从 `process.env` 读，不从配置文件读
- [ ] key 失效时显式降级
- [ ] dev / staging / prod 各自独立 key
```

---

## 6. 测试夹具 + 预演模式

每个连接器 PR 必须包含：

### 6.1 Fixture 文件

路径约定：`lib/connectors/<name>/fixtures/`

要求：

- 100% 合成数据（不允许真实客户 / 员工 / 案件 ID）
- 覆盖成功路径 + 至少 2 个失败模式（认证过期 / 速率限制 / 空结果）
- 文件名带 `.fixture.ts` / `.sample.json` 后缀
- 通过 `npm run check:public-release`（无 tenant slug / 真实凭据 / 内部 host）

### 6.2 预演模式

连接器**默认必须支持 `authMode=MOCK`**：

```typescript
// lib/connectors/<name>/index.ts
const authMode = process.env[`${NAME_UPPER}_AUTH_MODE`] ?? "MOCK";
if (authMode === "MOCK") {
  return loadFixtureFromDisk();
}
// 真实 API 路径
```

参考实现：[`lib/connectors/salesforce/`](../../lib/connectors/) 中 Salesforce 连接器的 `authMode=MOCK` 默认回退模式。

### 6.3 测试覆盖

最低要求：

```typescript
describe("connector <name>", () => {
  it("loads fixture in MOCK mode", async () => { /* ... */ });
  it("returns empty + banner when credential expired", async () => { /* ... */ });
  it("returns empty + banner when rate limited", async () => { /* ... */ });
  it("writes traceId on every audit-relevant action", async () => { /* ... */ });
  it("respects review-first boundary on draft actions", async () => { /* ... */ });
  it("does not leak tenant slug to public-mirror-eligible paths", async () => { /* check:public-release subset */ });
});
```

---

## 7. 用户可见命名规范

连接器在用户面前出现的字符串（标题 / 描述 / 按钮 / 提示条）必须符合：

- **不出现 tenant 客户名**（你的客户 X 不应在公开连接器中被命名）
- **不出现公司商标除非有显式授权**（"Microsoft" / "Google" 这些是公开 OAuth 提供方名称，可以；客户公司名不可以）
- **使用通用表达**（"Account bound" 而非 "X account bound"；"External calendar synced" 而非 "X corp calendar synced"）
- **租户特定文本走 `message` prop / 配置注入**，不写死在组件里（参考 [`features/dashboard/connector-binding-success-sheet.tsx`](../../features/dashboard/connector-binding-success-sheet.tsx)：标题通用，调用方可通过 `message` 传租户特定描述）
- **双语**：zh + en 两个版本都要给，不能只给一种

---

## 8. 退出与数据回收

每个连接器必须支持：

1. **从 `/settings` 解绑**：用户在 `/settings?tab=connectors` 一键解绑 + 清理凭据
2. **数据可携带**：连接器拉到 Helm 的数据，用户可从 `/settings` 一键导出（一方数据）
3. **第三方原数据仍留在原系统**：原始数据仍在原系统，Helm 不主张拥有权
4. **保留期符合 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)** — 试点期内 30 天活跃期 + 7 天宽限期（目标口径）

---

## 9. 提交前自检

合并前 PR 默认应通过：

```bash
npm run check:public-release          # 连接器代码不泄漏 tenant / 凭据 / 内部 host
npm run check:secret-history          # 没引入新密钥历史
npm run check:boundaries              # 没破 decision-first / Recommendation ≠ Commitment 边界
npm run typecheck
npm run lint
npm run test -- lib/connectors/<name> # 你连接器的本地测试
npm run e2e -- --grep "<name>"        # 如有 e2e 用例
```

并在 PR 描述中粘贴上面 7 条命令的结果或免责；如果某条命令不能在本地环境运行，说明原因、剩余风险和补跑计划。

---

## 10. 5 条对集成方的承诺（来自 [README §5 条承诺](../../README.md#我们对集成方的-5-条承诺)）

发起 `integration:` 议题后，作为 Helm 集成方你获得：

1. **7 个工作日内回应**：但不承诺一定排期或实现
2. **3 类清晰边界**：每个集成上线时公开"自动做什么 / 复核后做什么 / 永远只人工"
3. **不替你给客户发送**：所有客户可见的动作永远等用户点击
4. **数据可携带**：所有接入的数据，一键自助导出（`/settings`）
5. **审计追踪**：关键集成动作带 trace ID

---

## 11. 进阶：成为认证集成

完成基础连接器后，如果你想：

- 把连接器纳入 Helm 官方 `partners` 列表
- 获得 `Helm Certified Connector` 品牌背书
- 进入 Helm Cloud / Enterprise 客户的官方推荐位

见 [`docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md`](../product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) Certified Connector 章节，明确认证流程 / 时间承诺 / 互斥规则。

---

## 12. 不知道怎么办时

按优先级：

1. **看 README §主流系统接入** ([README.md](../../README.md#主流系统接入)) 已支持连接器的实现模式
2. **看 [`lib/connectors/dingtalk/`](../../lib/connectors/) 或类似 Stable 连接器作为参考**
3. **GitHub Discussions**：把 6 个交付物的草稿贴出来，让社区评审
4. **`integration:` 议题**：如果是新系统类型（不只是新连接器），先开议题对齐方向

---

## 13. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-06-07 | 补充 source-intake-first 三阶段：L0 诊断材料、L1 fixture / dry-run、L2 只读连接器；明确 L3 写回 / 外发 / 审批执行不属于 public Core 默认接入路径 |
| 2026-05-18 | V1 初版：定义连接器 6 个交付物 / 数据流声明模板 / 边界三轨表 / OAuth 安全清单 / 预演测试规范 / 用户可见命名规范 / 退出与数据回收 |
