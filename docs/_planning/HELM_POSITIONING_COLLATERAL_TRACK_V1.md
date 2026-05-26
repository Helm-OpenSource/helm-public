---
status: active
owner: helm-core
created: 2026-05-18
review_after: 2026-05-25
archive_trigger:
  - All four deliverables (1-pager / docker-compose verification / vertical cookbook / demo video) ship with v0.1.0-trial public release
  - 2026-05-31 release is deferred and replaced by a new plan
---

# Helm Positioning Collateral Track to 2026-05-31

更新时间：2026-05-18
状态：Execution track / 平行于 GitHub Apache-2.0 public release execution plan
目标版本：随 `v0.1.0-trial` 同步交付
唯一目标：在 2026-05-31 前让 1-pager 的"对交付工程师"叙事**有可验证的承接物料**

---

## 1. 计划结论

GitHub Apache-2.0 公开发布的技术轨道（secret rotation / history rewrite / mirror clean receipt）解决"能不能公开"。**这条平行轨道解决"公开后第一波 reach 弹得出来吗"**。

没有这条 track 的物料：开源仓 push 出去后社区无法在 30 分钟内验证 1-pager 的叙事真假；交付工程师在 GitHub Discussions 第一周大概率沉默；融资叙事拿不出"实际交付商在用"的弹药。

四个可交付物料：

1. **D1: 1-pager**（已落 V1） — `docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md`
2. **D2: `docker compose up` 30 分钟 onboarding 实跑验证** — 本机或 fresh-clone 环境真跑过，记录每步耗时
3. **D3: 1 个 vertical cookbook** — `extensions/case-management-sample/` 的"从 fork 到第一个 working signal"操作手册
4. **D4: 短 demo video** — 90 秒 ~ 3 分钟，看到 `/operating` / `/approvals` / `/memory` 三张面在跑

---

## 2. 非目标

本 track 不做：

1. 不写宣传文案 / 不做营销页
2. 不组织发布日 livestream / podcast
3. 不做付费推广（Twitter / 微博 / 公众号 amplification）
4. 不准备投资人 deck（独立 track）
5. 不组建社区管理团队
6. 不替代 GitHub Apache-2.0 public release execution plan 的技术轨道

---

## 3. 四个 deliverable 的验收口径

### 3.1 D1：1-pager（已落 — V1）

**Owner**：helm-core
**当前状态**：V1 落地，路径 `docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md`

**验收口径**：

- 路径稳定（自 2026-05-18 起不再迁移）
- 占位项已填实（`<reference-vertical>` → `case-management-sample`）
- 英文 mirror `docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.en.md` 已起并随 zh V1 三稿同步
- README + docs/README 索引已对齐 ✓
- AGENTS.md §3 已加入 `delivery-engineer-facing` / `open-source-first` 轴 ✓

**未做**：正式 release 前的 second-pass copy review

### 3.2 D2：30 分钟 onboarding 实跑验证

**Owner**：helm-core delivery engineer 角色
**当前状态**：未跑

**验收口径**：

- 在 fresh-clone 环境（macOS / Linux / Windows WSL 至少 1 个）执行 1-pager §30 分钟 onboarding 锚点的 6 步
- 每步耗时记录：
  1. `git clone` + `docker compose up` 起服务
  2. 看到 `/operating` / `/approvals` / `/memory` 三个 surface
  3. 读 `extensions/case-management-sample/README.md`
  4. 改 `extensions/case-management-sample/tenant.manifest.json` 的 slug + displayName
  5. 跑 `npm run eval:operating-signal-flow` 跑通
  6. 读 `docs/integrations/INTEGRATION_TEMPLATE.md`
- 总时长 ≤ 35 分钟（容差 + 5 分钟）
- 失败步骤记录到 `docs/_planning/POSITIONING_COLLATERAL_ONBOARDING_VERIFICATION_LOG.md`，每条标 `block` / `soft` / `nit`
- 任一 `block` 触发"30 分钟 onboarding 不真实"红灯，需先修代码或改 1-pager
- **最迟 2026-05-27 完成**（D3 vertical cookbook 依赖其结果）

**风险**：本机无 Docker 时无法验证；需要在装 Docker Desktop / OrbStack / colima 的环境跑。WORKING-CONTEXT 已记录"本机无 Docker"作为 P0 user action。

### 3.3 D3：vertical cookbook — case-management-sample

**Owner**：helm-core
**前置依赖**：`extensions/case-management-sample/` 最小公开参考已落地；worker / BI cookbook minimum slice 已补齐
**当前状态**：minimum public reference 已落；README cookbook 已覆盖 fork / schema / fixture / worker / BI report 路径；fresh-clone Docker onboarding 仍待 D2 环境验证

**验收口径**：

- 路径 `extensions/case-management-sample/README.md` 包含：
  - 5 行 vertical 摘要（域：案件 / 客服 / 经营推进）✓
  - "如何 fork 给你客户"的 5 步操作清单 ✓
  - 信号 schema 改造指引（哪些字段是 domain，哪些是 generic）✓
  - worker driver preview 适配指引 ✓
  - 至少 1 个 fixture 演示 + 验证命令 ✓
- **不含任何 tenant-private 名称**（pass `npm run check:public-release`）
- 不含真实客户数据（pass `npm run check:secret-history`）
- 长度 600 ~ 1200 字（不长不短）
- **最迟 2026-05-29 完成**

**风险**：最小参考和 worker / BI cookbook 已解除 README / 1-pager dead-link 风险；未通过 D2 fresh-clone / Docker 验证前，仍不得写成 production-ready vertical 或已完整跑通 30 分钟 onboarding。

### 3.4 D4：短 demo video / GIF / asciinema

**Owner**：helm-core
**当前状态**：未录

**验收口径**：

- 90 秒 ~ 3 分钟
- 屏幕录制 + 简短字幕（中文为主，英文字幕可选）
- 包含：
  1. `docker compose up` 起服务
  2. `/operating` 第一屏
  3. `/approvals` 复核闸
  4. 触发一个 signal → 看到经营信号流图变化
- 不带 voice-over（避免本地化负担）
- 上传到 GitHub release notes 内嵌 / asciinema / GIF 任一形式（**不依赖 YouTube / B 站**）
- **最迟 2026-05-30 完成**（D2 onboarding verification 通过后再录，否则录到一半发现路径走不通）

**风险**：屏幕录制工具 + 编辑工具的 OS 依赖；时间预算如果挤压，降级为静态截图 carousel。

---

## 4. 依赖关系图

```
case-management-sample 抽取 spec (done 2026-05-18)
  └─ case-management-sample minimum public reference (done 2026-05-18)
       ├─ D3 cookbook worker / BI minimum slice (done 2026-05-18)
       └─ D2 onboarding step 3-5 fresh-clone verification

1-pager V1 (done 2026-05-18)
  └─ D2 onboarding verification (跑 1-pager 锚点) (2026-05-27)
       └─ D4 demo video (录已验证通过的流程) (2026-05-30)
```

**不可并行项**：

- D2 必须等 case-management-sample 至少 stub 存在（步骤 3 / 4 需要它）
- 当前 stub / minimum reference 已存在；D2 的剩余 blocker 是 fresh-clone + Docker 环境实跑
- D4 必须等 D2 verify 通过（否则录到一半发现不能跑）

---

## 5. 强制停止条件

出现以下任一情况，positioning collateral track 视为 No-Go，1-pager 中相关承诺必须降级：

1. 2026-05-22 前 case-management-sample worker / BI cookbook minimum slice 回归失败
2. 2026-05-27 前 D2 onboarding verification 出现 `block` 级失败且 24h 内无法修复
3. 2026-05-29 前 D3 cookbook 回归验证失败
4. 2026-05-30 前 D4 demo video 未录

任一条触发 → 通知 release plan owner 决定：

- (a) 推迟 5-31 release，等物料补齐
- (b) 5-31 仅发布技术轨道，1-pager 承诺范围缩减（"v0.1 包含 minimum public reference" 而非"完整带电池 vertical 已抽出"）
- (c) 5-31 不发布，重排

---

## 6. 与 GitHub Apache-2.0 public release execution plan 的接口

本 track 与技术轨道（secret rotation / history rewrite / mirror clean）**完全独立**，但**共享 5-31 release window**：

- 技术轨道 Go = release 可以公开
- 本 track Go = release 可以被社区第一波 reach 接住
- **两条都 Go → 发布**
- **任一 No-Go → 重新评估 5-31 是否保留**

建议 GitHub Apache-2.0 public release execution plan 在其 §5 Milestone 列表中**显式 reference 本 track**（例如增加 Milestone E.5 "Positioning collateral 同步验证"），或在其 §7 强制停止条件中增加一行"positioning collateral track No-Go 时同步触发"。

---

## 7. 输出物清单

| 编号 | 产物 | 状态 | 截止 |
|---|---|---|---|
| D1 | 1-pager `docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md` | ✓ 已落 V1 | done |
| D1.en | 1-pager 英文 mirror | ✓ 已起并同步 V1 三稿 | copy review by 2026-05-29 |
| D2 | Onboarding verification log | ⏳ 未起 | 2026-05-27 |
| D2.fix | Onboarding block-level failures 修复 | 视 D2 结果 | 2026-05-28 |
| D3 | `extensions/case-management-sample/README.md` cookbook | ✓ minimum public reference + worker / BI cookbook landed | 2026-05-29 |
| D3.dep | `extensions/case-management-sample/` 抽取 spec | ✓ 已起草 | review by 2026-05-19 |
| D3.exec | `extensions/case-management-sample/` 抽取执行 | ◐ public sample landed；Docker smoke / optional extra signal mappers pending | 2026-05-22 |
| D4 | Demo video / GIF / asciinema | ⏳ 未起 | 2026-05-30 |

---

## 8. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-18 | V1 初版：定义 positioning collateral 4 个 deliverable、依赖关系、与技术轨道的接口、强制停止条件 |
| 2026-05-18 | V1.1：同步英文 mirror / sample extraction spec 已起草事实，并给 sample onboarding 口径补上 release gate 防线 |
