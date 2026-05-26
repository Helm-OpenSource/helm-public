---
status: V1 (released with v0.1.0-trial)
owner: helm-core
created: 2026-05-18
review_after: 2026-06-30
audience: delivery engineers wiring up their customer's existing systems via Helm
public_safety: Intended for the public mirror. No tenant-private references.
---

# Integration Template

> 接你客户的现有系统是你的核心交付动作——这一份模板告诉你做一个 Helm 集成（connector / adapter）需要交付的全部内容、按什么顺序、用什么边界。

适用：你正在给 Helm 加一个新的只读 / 草稿型连接器（CRM / IM / Mail / Calendar / Meeting / Payment / LLM / etc.）。

不适用：你想做自动外发 / 自动审批 / 自动写回类的连接器——这超出当前可接受 PR 边界（见 [README.md §可接受 PR 的边界](../../README.md#可接受-pr-的边界)）。

---

## 0. 在写代码前的 90 秒

问自己 3 个问题，答不上来就先开 `integration: <system>` issue：

1. **客户用例**：你客户在这个系统里**真实做什么动作**？哪些动作是经营信号（销售推进 / 客户复核 / 会议承诺）？
2. **数据流向**：数据从 `<external system>` 进入 Helm 后，**落到哪个 object**（Deal / Account / Meeting / SignalEvent / MemoryItem）？反向是否需要回写？
3. **治理边界**：哪些动作走 auto（自动）/ 哪些走 review（复核）/ 哪些是 never（永远手动）？**默认全部 review** 起步，明确的安全 read-only 才能走 auto。

---

## 1. 集成的 6 个交付物

每个新连接器 PR 默认需要交付**这 6 个**。少一个 = 还没完成。

| # | 交付物 | 文件 / 位置 |
|---|---|---|
| 1 | 数据流声明 | 本模板 §2 表格嵌入到 connector README |
| 2 | 边界三轨表 (auto / review / never) | 本模板 §3 表格嵌入到 connector README |
| 3 | OAuth + API key 安全清单 | 本模板 §4 已勾选清单嵌入到 connector README |
| 4 | 测试夹具 + dry-run 模式 | `lib/connectors/<name>/fixtures/` + `*.test.ts` |
| 5 | 用户可见命名规范 | 本模板 §6 检查表 |
| 6 | 退出与数据回收 | 本模板 §7 接入 `/settings` 自助导出与退出流程 |

---

## 2. 数据流声明模板

复制下表，填到你 connector README 的最前面：

```markdown
| 维度 | 内容 |
|---|---|
| Connector 名称 | <name>（必须符合 §6 命名规范） |
| 上游系统 | <external system>（含官方域名 / OAuth provider） |
| 数据方向 | inbound only / inbound + outbound draft / inbound + outbound review-first |
| 拉取频率 | manual / on-demand / scheduled `<interval>` |
| 落地对象 | <Helm domain objects: Deal / Account / Meeting / SignalEvent / etc.> |
| 落地 surface | <Helm route: /dashboard / /approvals / /memory / etc.> |
| 失败降级 | <graceful degrade strategy: empty banner / cached / synthetic placeholder> |
| 凭据持久化 | 加密存储字段名 + 加密 key 来源（CONNECTOR_TOKEN_SECRET） |
| trace 写入 | 写入 `traceId` 的关键路径（list） |
```

填写示例（DingTalk read-only directory）：

```markdown
| 维度 | 内容 |
|---|---|
| Connector 名称 | dingtalk |
| 上游系统 | DingTalk Open API（oapi.dingtalk.com） |
| 数据方向 | inbound only |
| 拉取频率 | on-demand（用户在 /settings 点击 sync） |
| 落地对象 | Workspace member directory + Meeting capture metadata |
| 落地 surface | /settings/connectors · /meetings |
| 失败降级 | 显示 banner "DingTalk 临时不可用"，缓存最近一次成功 sync 结果 |
| 凭据持久化 | `connector_credential.encryptedToken`，AES-GCM with CONNECTOR_TOKEN_SECRET |
| trace 写入 | 目录同步 / 邀请审批通过 |
```

---

## 3. 边界三轨表

每个 connector 必须显式声明：哪些动作 auto，哪些 review，哪些 never。

模板：

```markdown
| 动作 | 轨道 | 依据 |
|---|---|---|
| Read user profile | auto | OAuth scope minimal, no PII shared back |
| Read meeting metadata | auto | scheduled, read-only |
| Capture meeting transcript | review | 高风险，需用户复核后才进入经营记忆 |
| Send invitation message | never | 客户可见外发，永远手动 |
| Write back to CRM | never | 客户系统写入，永远手动复核后才能落 |
```

**默认规则**：

- 任何**读取** = 默认 auto，前提是 OAuth scope 最小化
- 任何**草稿生成**（draft message / proposed reply / etc.） = 默认 review
- 任何**客户可见外发 / 写回 / 状态变更** = 默认 never；只有显式人工复核 + 明确授权按钮才能成立

不允许的：

- ❌ `auto-send`：客户可见外发不能 auto
- ❌ `auto-approve`：审批不能 auto
- ❌ `auto-write-back-on-llm-suggestion`：LLM 建议不能直接 auto 写回客户系统

---

## 4. OAuth + API key 安全清单

构建 OAuth-based connector 时勾选下面 12 条：

```markdown
- [ ] OAuth scope 最小化（只要读不要写，只要 metadata 不要 PII）
- [ ] state 参数防 CSRF（每次 OAuth flow 随机生成）
- [ ] PKCE 启用（mobile / SPA 场景必须）
- [ ] redirect_uri 写死在 server side，不允许 query 注入
- [ ] access_token 加密存储（不写 plain text，不写 client-side）
- [ ] refresh_token 加密存储（如适用）
- [ ] 凭据持久化字段加密 key 走 `process.env.CONNECTOR_TOKEN_SECRET`
- [ ] 凭据失效时显式降级，banner 给用户重新授权入口
- [ ] OAuth callback handler 写 audit log（含 traceId）
- [ ] 撤销 OAuth 时清理凭据 + 相关 cache
- [ ] 没有 hard-code customer-specific token / secret
- [ ] `npm run check:public-release` PASS（连接器目录不出现 tenant slug / 真实凭据 / 内部 host）
```

API key (non-OAuth) 模式额外勾选：

```markdown
- [ ] key 不写入 git history（参考 [scripts/secret-history-check.ts](../../scripts/secret-history-check.ts) 已知 fingerprint）
- [ ] key 从 `process.env` 读，不从 config file 读
- [ ] key 失效时显式降级
- [ ] dev / staging / prod 各自独立 key
```

---

## 5. 测试夹具 + dry-run 模式

每个 connector PR 必须包含：

### 5.1 Fixture 文件

路径约定：`lib/connectors/<name>/fixtures/`

要求：

- 100% 合成数据（不允许真实客户 / 员工 / 案件 ID）
- 覆盖 happy path + 至少 2 个 failure mode（auth expired / rate limited / empty result）
- 文件名带 `.fixture.ts` / `.sample.json` 后缀
- 通过 `npm run check:public-release`（无 tenant slug / 真实凭据 / 内部 host）

### 5.2 Dry-run 模式

连接器**默认必须支持 `authMode=MOCK`**：

```typescript
// lib/connectors/<name>/index.ts
const authMode = process.env[`${NAME_UPPER}_AUTH_MODE`] ?? "MOCK";
if (authMode === "MOCK") {
  return loadFixtureFromDisk();
}
// 真实 API 路径
```

参考实现：[`lib/connectors/salesforce/`](../../lib/connectors/) 中 Salesforce 连接器的 `authMode=MOCK` 默认 fallback 模式。

### 5.3 Test 覆盖

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

## 6. 用户可见命名规范

连接器在用户面前出现的字符串（标题 / 描述 / 按钮 / banner）必须符合：

- **不出现 tenant 客户名**（你的客户 X 不应在公开连接器中被命名）
- **不出现公司商标除非有显式授权**（"Microsoft" / "Google" 这些是公开 OAuth provider 名，可以；客户公司名不可以）
- **使用 generic 表达**（"Account bound" 而非 "X account bound"；"External calendar synced" 而非 "X corp calendar synced"）
- **租户特定文本走 `message` prop / 配置 inject**，不写死在组件里（参考 [`features/dashboard/connector-binding-success-sheet.tsx`](../../features/dashboard/connector-binding-success-sheet.tsx)：title 通用，调用方可通过 `message` 传租户特定描述）
- **bilingual**：zh + en 两个版本都要给，不能只给一种

---

## 7. 退出与数据回收

每个 connector 必须支持：

1. **从 `/settings` 解绑**：用户在 `/settings/connectors` 一键解绑 + 清理凭据
2. **数据可携带**：连接器拉到 Helm 的数据，用户可从 `/settings` 一键导出（first-party）
3. **第三方原数据 stays**：原始数据仍在原系统，Helm 不主张拥有权
4. **保留期符合 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)** — 试点期内 30 天 active + 7 天 grace（目标口径）

---

## 8. 提交前自检

合并前 PR 默认应通过：

```bash
npm run check:public-release          # 连接器代码不泄漏 tenant / 凭据 / 内部 host
npm run check:secret-history          # 没引入新 secret 历史
npm run check:boundaries              # 没破 decision-first / Recommendation ≠ Commitment 边界
npm run typecheck
npm run lint
npm run test -- lib/connectors/<name> # 你连接器的本地测试
npm run e2e -- --grep "<name>"        # 如有 e2e 用例
```

并在 PR 描述中粘贴上面 7 条命令的结果或免责（参考 [`docs/_planning/HELM_GITHUB_APACHE_2_0_PUBLIC_RELEASE_EXECUTION_PLAN_TO_2026-05-31`](.) §8 验收命令清单的不可跑回退机制）。

---

## 9. 5 条对集成方的承诺（来自 [README §5 条承诺](../../README.md#我们对集成方的-5-条承诺)）

发起 `integration:` issue 后，作为 Helm 集成方你获得：

1. **7 个工作日内回应**：但不承诺一定排期或实现
2. **3 类清晰边界**：每个集成上线时公开"自动做什么 / 复核后做什么 / 永远只人工"
3. **不替你给客户发送**：所有客户可见的动作永远等用户点击
4. **数据可携带**：所有接入的数据，一键自助导出（`/settings`）
5. **审计 trace**：关键集成动作带 trace ID

---

## 10. 进阶：成为 Certified Integration

完成基础 connector 后，如果你想：

- 把连接器纳入 Helm 官方 `partners` 列表
- 获得 `Helm Certified Connector` 品牌背书
- 进入 Helm Cloud / Enterprise 客户的官方推荐位

见 [`docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md`](../product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md) Certified Connector 章节，明确认证流程 / 时间承诺 / 互斥规则。

---

## 11. 不知道怎么办时

按优先级：

1. **看 README §主流系统接入** ([README.md](../../README.md#主流系统接入)) 已支持连接器的实现模式
2. **看 [`lib/connectors/dingtalk/`](../../lib/connectors/) 或类似 Stable 连接器作为参考**
3. **GitHub Discussions**：把 6 个交付物的草稿贴出来，让社区评审
4. **`integration:` issue**：如果是新系统类型（不只是新 connector），先开 issue 对齐方向

---

## 12. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-18 | V1 初版：定义连接器 6 个交付物 / 数据流声明模板 / 边界三轨表 / OAuth 安全清单 / dry-run 测试规范 / 用户可见命名规范 / 退出与数据回收 |
