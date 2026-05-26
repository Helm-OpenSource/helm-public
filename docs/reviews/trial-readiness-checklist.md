---
status: active
owner: helm-core
created: 2026-03-15
review_after: 2026-06-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# trial-readiness-checklist.md

## 文档目的

本文件用于定义 Helm 项目在进入设计合作伙伴试点前，必须完成的就绪检查项。

目标有四个：

1. 确保项目具备可试点、可交付、可回退的状态
2. 确保 recommendation、memory、LLM、evolution、conversation capture 的边界清楚
3. 确保试点不会因为交付边界、稳定性、合规、环境配置问题翻车
4. 让团队在进入真实客户试用前，有一套统一的人工验收标准
5. 确保 CRM-first 迁移工具能在试点客户现有 HubSpot / Salesforce 上快速起量

---

## 当前仓库对应实现

当前仓库里，与试点前就绪检查直接对应的入口如下：

1. Git 与交付边界
   - [../../README.md](../../README.md)
   - [../pilot/delivery-boundary.md](../pilot/delivery-boundary.md)
2. 试点前总清单与人工验收
   - [../pilot/pre-pilot-checklist.md](../pilot/pre-pilot-checklist.md)
   - [../pilot/manual-acceptance-paths.md](../pilot/manual-acceptance-paths.md)
   - [../pilot/minimal-evals.md](../pilot/minimal-evals.md)
3. 自动检查命令
   - `npm run pilot:check`
   - `npm run pilot:eval`
   - `npm run eval:recommendation`
   - `npm run eval:memory`
4. 当前代码实现边界
   - API 以 [../../app/api](../../app/api) 为准
   - 服务以 [../../lib](../../lib) 为准

本文件定义的是“试点前是否允许进场”的统一标准，不等同于“长期生产可用性标准”。

---

## 一、总体判断标准

只有当下面五类检查同时通过时，项目才可进入小范围设计合作伙伴试点：

1. 交付边界清楚
2. 核心链路稳定
3. 推荐与记忆质量有最小验证
4. 环境、文档、配置可复现
5. 高风险能力边界清楚

---

## 二、Git 与交付边界

### 检查项
1. Git 根目录是否明确
2. 当前试点版本是否有明确 commit 或分支
3. 是否清理了 rename 与功能开发混杂问题
4. 是否存在大量未归档 checkpoint 仅靠临时 snapshot 保存
5. 是否有一份“当前稳定交付边界说明”

### 通过标准
1. `git status` 清晰
2. 当前试点版本可被明确 checkout
3. 当前可试点能力、演示能力、原型能力已被区分

### 当前仓库最小通过口径
1. Git 根目录必须明确，并且当前入口 [../..](../..) 可回到 Helm 仓库根目录
2. 基线提交必须可从 `main` 与至少一条显式命名的 `codex/*` 审计分支回溯
3. 当前交付边界必须能在 `README + docs/pilot/delivery-boundary.md` 里被看懂
4. 不允许依赖“临时 checkpoint 口头说明”来定义当前交付版本

### 不通过的典型情况
1. 根仓库与子目录边界混乱
2. checkpoint 只是临时对象，无法稳定审计
3. 审阅者无法判断当前到底交付了什么

---

## 三、文档与环境配置

### 检查项
1. 根 README 是否存在“文档地图”
2. docs/README 是否与当前目录结构一致
3. 文档中写到的核心 API 是否代码存在
4. `.env.example` 是否完整
5. README 中写到的环境变量是否都出现在 `.env.example`
6. README 中是否明确说明：
   - 推荐引擎
   - 记忆系统
   - LLM integration
   - evolution
   - conversation capture 的当前边界

### 通过标准
1. 新同事能按 README + `.env.example` 启动项目
2. docs 不会误导审阅者和试点客户
3. 未实现能力已被明确标注

### 当前仓库最小通过口径
1. `.env.example` 必须至少包含：
   - `DATABASE_URL`
   - `APP_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI`
   - `CONNECTOR_TOKEN_SECRET`
   - `OPENAI_API_KEY`
   - `LLM_ENABLED`
   - `LLM_DEFAULT_PROVIDER`
   - `LLM_DEFAULT_MODEL`
   - `LLM_EXTRACTION_MODEL`
   - `LLM_BRIEFING_MODEL`
   - `LLM_REASONING_MODEL`
   - `LLM_BASE_URL`
2. 文档中写了但代码没实现的 API，必须明确标成“文档预留，当前代码未实现”
3. 试点评审时，当前实现一律以 `app/api` 和 `lib` 目录为准
4. 如果要演示 CRM-first 迁移，必须同时具备：
   - `/imports/crm`
   - `/imports/jobs/[id]`
   - `/imports/conflicts`
   - `.env.example` 中的 HubSpot / Salesforce 变量

### 不通过的典型情况
1. README 承诺的能力高于代码
2. `.env.example` 不足以复现环境
3. docs 与代码严重漂移

---

## 四、核心产品页面

### 必须检查的页面
1. 今日工作台
2. 机会面板
3. 联系人详情页
4. 公司详情页
5. 会议详情页
6. 审批中心
7. 记忆页
8. 管理者周报页
9. CRM-first 导入页
10. 导入结果页
11. 冲突处理页
12. 试点诊断页
13. 设置页 Pilot Tab

### 每个页面必须满足
1. 页面能打开
2. 页面有真实数据
3. recommendation / memory / approval 链条在页面上可见
4. 页面不是纯 demo 拼图
5. 出错时不会整页崩掉

### 通过标准
1. 每个页面都可用于演示
2. 至少能支撑一个真实试点工作流

### 当前仓库最小通过口径
1. 页面不要求“全部生产级”，但必须满足：
   - 可打开
   - 有真实 seed 数据
   - recommendation / memory / approval 至少有两条链在页面上可见
2. capture 页面可以作为试点原型进入人工共创，但不能对外表述成成熟录音系统
3. CRM-first 页面必须能说明：
   - 导入了什么
   - 自动绑定了什么
   - 哪些对象需要人工确认
   - warmup 后长出了哪些 today focus / blocker / commitment / recommendation
4. 如果面向 Salesforce / HubSpot 英语客户试点，至少要能验证：
   - shell 已支持英文
   - `/imports/crm`
   - `/imports/jobs/[id]`
   - `/imports/conflicts`
   - `/diagnostics`
   - `/settings?tab=pilot`
   这些关键路径已具备英文前台

---

## 五、记忆系统试点就绪

### 检查项
1. meeting import 能生成 MemoryFact
2. meeting import 能生成 Commitment
3. meeting import 能生成 Blocker
4. 联系人页能看到关键记忆
5. 机会页能看到 blocker / commitment
6. 记忆页四个 tab 都有真实数据
7. correction 会写入 MemoryCorrection 和 AuditLog
8. recommendation explanation 能引用这些结构化对象

### 通过标准
1. 记忆系统已经进入 recommendation 链
2. correction 不只是页面行为，而是真的更新系统状态
3. 承诺链和阻碍链已可见、可读、可追溯

### 当前仓库最小通过口径
1. 至少以 `Acme 采购评估同步会` 为样例，能验证：
   - fact
   - commitment
   - blocker
   - recommendation explanation 引用
2. correction 至少要能影响下一次 recommendation evidence
3. `/memory` 四个 tab 中必须有真实内容，而不是空壳 UI

### 不通过的典型情况
1. 记忆只存在数据库里
2. 页面上看不到承诺和阻碍
3. correction 不影响 recommendation

---

## 六、Recommendation Engine 试点就绪

### 检查项
1. 首页 today focus 可见
2. 联系人页 recommendation 可见
3. 机会页 recommendation 可见
4. 审批中心 explanation 可见
5. recommendation 带 supporting facts
6. recommendation 带 blocker / commitment
7. recommendation 带 policyResult
8. feedback 会写入 RecommendationFeedback
9. 被批准 / 拒绝 / 编辑后批准都能记录

### 通过标准
1. recommendation 已经是系统能力，不只是页面文案
2. explanation 足够让用户理解“为什么”
3. recommendation 可以在试点中被量化验证

### 当前仓库最小通过口径
1. recommendation 至少要满足：
   - 有标题
   - 有 `decisionRole / decisionLabel`
   - 有 blocker / commitment / supporting facts
   - 有 `policyResult`
2. recommendation 质量必须可通过：
   - `npm run eval:recommendation`
   - `npm run pilot:eval`
   两条命令最小验证
3. analytics 或 report 至少能看到 recommendation 质量摘要

### 不通过的典型情况
1. recommendation 只会解释，不够准
2. feedback 没有真正进入闭环
3. 页面显示不到关键信息

---

## 七、LLM Integration 试点就绪

### 检查项
1. 是否至少有一个真实 provider 接入
2. 是否有 provider interface
3. 是否有 model router
4. 是否有 prompt version
5. 是否有 LLMCallLog
6. meeting import 是否能走 LLM 提取
7. briefing 是否能走 LLM
8. explanation 是否能走 LLM 增强
9. LLM 失败是否有 fallback

### 通过标准
1. LLM 已经真实增强产品，但不接管产品逻辑
2. 失败不会破坏主流程
3. 调用行为可观测

### 当前仓库最小通过口径
1. 真实 provider 可以只接一个，但必须有：
   - provider registry
   - model router
   - prompt registry
   - `LLMCallLog`
2. 当前 `LLMCallLog` 至少要带：
   - `promptKey`
   - `promptVersion`
   - `modelRole`
   - `modelVersion`
3. 不得把 today focus 排序交给模型直接决定

### 不通过的典型情况
1. 页面或业务层直接依赖某个 SDK
2. 无日志
3. 无 fallback
4. today focus 排序被模型接管

---

## 八、主动进化系统试点就绪

### 检查项
1. DeltaEvent 存在
2. PatternFact 至少有 3 类
3. StrategySuggestion 可见
4. StrategySuggestion 可接受 / 忽略
5. PolicyRule 类 suggestion 被采纳后能真实影响系统行为
6. PreferenceSignal 类 suggestion 至少能影响 explanation 或 insights
7. 首页“系统最近学到了什么”可见
8. 审计完整

### 通过标准
1. 系统的学习结果用户可见
2. 学习不会越权
3. 至少一条策略收敛链被证明成立

### 当前仓库最小通过口径
1. 至少一条 `PreferenceSignal` 类 suggestion 必须可验
2. `PolicyRule` 类 suggestion 若当前 seed 没样例，必须在人工验收包里明确写“需受控验证”
3. `pilot:eval` 必须能看见：
   - `stalled_opportunity_pattern`
   - `contact_cooling_pattern`
   - 至少一条 `ACCEPTED` 的 `StrategySuggestion`

### 不通过的典型情况
1. 只有 pattern，没有行为变化
2. suggestion 被采纳但系统没有变化
3. 会自动放宽高风险边界

---

## 九、Conversation Capture 试点边界检查

### 检查项
1. 是否能开始一次 capture session
2. 是否能停止并处理
3. 是否有 transcript
4. 是否能生成 insights
5. 是否能写回 memory system
6. 是否能增强 recommendation / approval
7. 是否明确区分：
   - 已真实实现
   - 半实现
   - 原型 / 文档能力

### 通过标准
1. 它至少是“会话理解处理链”原型
2. 对内和对外边界表述清楚
3. 不会被误当成完整实时录音系统

### 当前仓库最小通过口径
1. 必须明确区分：
   - 浏览器录音 / 音频上传 / transcript 入库：可真实实现
   - ASR 是否成功：可配置、可 fallback
   - 实时录音 / 实时转写 / 外部会议系统原生接入：当前不作为硬通过项
2. 人工验收必须能证明 transcript 已进入 memory / recommendation / approval 链

### 不通过的典型情况
1. 被包装成成熟录音产品
2. transcript 之后没有进入经营闭环
3. recommendation 没有被增强

---

## 十、导入与连接器试点就绪

### 检查项
1. CSV 导入联系人可用
2. CSV 导入机会可用
3. CSV 导入会议纪要可用
4. Gmail 只读接入可用
5. 对象绑定有基本准确率
6. 导入错误可见
7. 冷启动后首页能快速出现价值

### 通过标准
1. 至少一种真实数据入口可用于试点
2. 接入后 10 分钟内用户能感知价值

### 当前仓库最小通过口径
1. CSV 导入必须是硬通过项
2. Gmail 只读接入允许以 mock fallback 作为本地演示路径，但文档里必须讲清楚
3. 首页 / 收件箱 / 导入页至少有一处能说明“真实数据进来后价值立刻出现”

### 不通过的典型情况
1. 数据接入后页面仍然空
2. recommendation 无法消费真实数据
3. 对象绑定错误严重

---

## 十一、Analytics 与 Weekly Report

### 检查项
1. EventLog 有基础埋点
2. DailyUsageSnapshot 可见
3. Analytics 页面可用
4. WeeklyReport 可生成
5. 管理者周报页可用
6. recommendation / approval / usage / risk 基础指标可见

### 通过标准
1. 团队能看见试点期间的真实使用情况
2. 管理者至少能看一份有意义的周报

### 不通过的典型情况
1. 页面存在但没有真实指标
2. 周报只是空模板或静态内容

---

## 十二、安全与合规

### 检查项
1. 高风险动作不会自动越权
2. conversation capture 有明确授权提示
3. transcript / insight 有 retention 策略
4. delete / export 能力存在或有明确边界
5. connector secret 与 API key 配置收口
6. 审计日志可追溯关键行为

### 通过标准
1. 当前试点不会因为权限和合规边界不清而翻车
2. 高风险动作始终在控制链内

### 不通过的典型情况
1. conversation capture 无明确提示
2. recommendation 能越权执行
3. 审计无法追溯

---

## 十三、最终试点判定

### 允许进入试点
当且仅当：
1. Git / 文档 / env 收口
2. 主页面可用
3. 记忆与 recommendation 链路可验
4. evolution 边界可控
5. conversation capture 边界讲清
6. 至少一类真实数据入口成立

### 不建议进入试点
如果出现以下任一情况：
1. 版本边界混乱
2. recommendation 无法解释
3. memory 无法稳定生成
4. 对外边界表述不清
5. `.env.example` 与 README 严重不一致
