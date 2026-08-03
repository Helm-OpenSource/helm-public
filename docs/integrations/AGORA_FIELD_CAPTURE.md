---
status: implementation_in_progress
owner: helm-core
created: 2026-07-18
review_after: 2026-08-18
audience: delivery engineers implementing governed field-sales voice capture
public_safety: Public-safe architecture and protocol. No tenant credentials, customer data, or deployment authorization.
---

# 声网直连的销售现场采集 / Agora-direct Field Capture

> **语言 / Language**: **中文主文本** + **English reference summary**

## English Reference Summary

The field-capture media plane is `authorized microphone -> native capture agent ->
Agora RTC -> Agora Speech-to-Text`. Raw audio never traverses Helm HTTP routes and
is not stored by Helm. Helm owns the control and analysis plane: scoped device
credentials, consent evidence, server-side Agora task orchestration, idempotent
final-transcript ingestion, retention policy, audit, and review-first operating
analysis. Agora lifecycle webhooks do not carry live transcript text; a trusted
RTC client receives the STT bot's Protobuf data stream and relays final segments
to Helm. This document and its MOCK path are implementation evidence, not a
customer deployment, production authorization, compliance certification, or
proof of live Agora credentials.

## 1. 本轮目标

第一条现场路径服务于没有浏览器可用的线下销售场景：

1. Insta360 Mic Pro 接收器通过 USB 连接一台有网络的电脑。
2. 电脑运行常驻原生采集端，并显式选择 `Insta360 Mic Pro` 作为录音设备。
3. 采集端把音频直接发布到声网 RTC 频道，Helm 不转发音频。
4. Helm 服务端创建和停止声网实时转写任务。
5. 声网转写机器人在 RTC 数据流中发布转写结果。
6. 采集端只转发最终转写片段到 Helm；Helm 保存、分析并生成复盘与经营动作候选。

第二条手机路径复用同一协议，但不是本轮完成项：Mic Pro 发射器可在兼容的
第三方录音 / 直播应用中作为蓝牙音频输入；原生系统相机并非通用支持路径，兼容性
必须逐机型验证。稳定试点仍以 USB-C 接收器为首选。

## 2. 不做什么

- 不让音频经过 Helm API、Helm 数据库、Helm 日志或 Helm 对象存储。
- 不把浏览器录音上传路径描述成销售现场主路径；浏览器路径只用于会议和本地调试。
- 不把声网客户 ID、客户密钥、App Certificate 或 Webhook 密钥发给采集端。
- 不接受采集端自报 workspace、retention policy、provider agent ID 或分析完成状态。
- 不接收中间转写；只接收 `is_final=true` 的最终片段。
- 不因网络断开而在电脑本地缓存原始音频并自动补传。POC 默认 fail closed。
- 不自动外发提示、写回 CRM、评价员工、排名或生成绩效结论。
- 不把 MOCK、自测或设备枚举写成客户部署、生产合规或声网服务开通证明。

## 3. 数据流

```text
Insta360 Mic Pro
        |
        | local microphone PCM (device-local only)
        v
Native capture agent ---------------------------+
        |                                        |
        | Agora RTC audio                        | final STT segments only
        v                                        v
Agora RTC -> Agora Speech-to-Text bot -> RTC data stream -> Helm ingest API
                                                          |
                                                          v
                                      governed transcript + analysis + audit
```

| 维度 | 内容 |
|---|---|
| 上游媒体 | 经授权的标准企业麦克风或客户授权设备 |
| 媒体方向 | 采集端 -> 声网 RTC / ASR；不经过 Helm |
| 文本方向 | 声网 STT bot -> RTC 数据流 -> 受信采集端 -> Helm |
| Helm 落地对象 | `CaptureSession`、provider session、最终片段、`ConversationTranscript`、经营洞察与复核候选 |
| 声网 Webhook | 只处理任务生命周期 / 异常 / 字幕存储状态，不承载实时转写正文 |
| 失败降级 | 不生成演示逐字稿；会话标记 degraded / failed，保留可审计原因，人工决定是否重试 |
| 原始音频 | `rawAudioAcceptedByHelm=false`、`rawAudioStoredByHelm=false` |

## 4. 信任与授权边界

### 4.1 设备凭证

- 每台采集端使用一枚 workspace-scoped 的高熵 bearer credential。
- 数据库只保存 SHA-256 token hash、可展示前缀、状态、过期时间和最近使用时间。
- token 权限仅限：启动自己的现场会话、写入该会话最终片段、停止该会话。
- token 不能读取 CRM 对象、其他会话、完整逐字稿、分析结果或 workspace 设置。
- 吊销或过期后立即 fail closed；日志不得记录完整 token。

### 4.2 同意与告知

- 启动请求必须带 `confirmed=true` 与 `counterpartyNotified=true`。
- Helm 服务端继续执行 workspace 的 `captureConsentRequired` 门禁并落库确认人、告知版本和时间。
- 采集端必须提供可见的录音状态与立即停止能力；隐藏采集不属于允许路径。
- 顾客或员工撤回后必须停止媒体发布；逐会话删除与撤回执行仍需独立产品面补齐。

### 4.3 留存

关闭集：

- `DERIVED_ONLY`：默认。最终片段只在处理窗口内用于生成派生结果，处理后删除逐字文本。
- `TRANSCRIPT_AND_DERIVED`：仅由管理员在设备授权时显式授予，并受 workspace 保留期约束。

采集端不能在启动请求里提升留存级别。当前 conversation pipeline 会先持久化文本再完成
理解；因此 `DERIVED_ONLY` 的首版实现属于“处理后清除”，不是“从未写入数据库”。在完成
内存式处理和可验证删除回执前，不得把它描述为零持久化。

## 5. 声网任务编排

### 5.1 服务端配置

真实模式只从服务端环境读取：

```text
AGORA_STT_MODE=REAL
AGORA_APP_ID
AGORA_APP_CERTIFICATE
AGORA_CUSTOMER_ID
AGORA_CUSTOMER_SECRET
AGORA_STT_WEBHOOK_SECRET
AGORA_STT_BASE_URL=https://api.sd-rtn.com
AGORA_RTC_TOKEN_TTL_SECONDS=3600
```

默认 `AGORA_STT_MODE=MOCK`。MOCK 只验证协议和状态机，不加入 RTC，不产生真实 ASR。
REAL 模式的 provider base URL 必须为 HTTPS；声网 REST 请求固定带超时，不自动重试具有外部
副作用的 start。停止失败由设备端显式重试。

### 5.2 启动

Helm 服务端生成不可预测的频道名、publisher UID、subscriber bot UID、publisher bot UID
和短期 RTC token，然后调用：

```text
POST https://api.sd-rtn.com/cn/api/speech-to-text/v1/projects/{appid}/join
```

关键约束：

- REST Basic Auth 只在服务端。
- `subscribeAudioUids` 只包含本次采集端 publisher UID。
- `subBotUid` 与 `pubBotUid` 必须不同。
- 默认使用 Protobuf 数据协议。
- 同一设备最多一个 active session；重复启动返回已有结果或明确冲突，不创建第二个任务。

服务端只向采集端返回短期 RTC 加入材料：App ID、频道、publisher UID / token、
transcript bot UID、过期时间。不得返回声网 REST 凭据或 App Certificate。

### 5.3 接收转写

采集端在 RTC `onStreamMessage` 回调中：

1. 只接受 `remoteUid == transcriptBotUid` 的消息。
2. 按声网 `Agora.SpeechToText.Text` Protobuf schema 解码。
3. 只提取 `Word.is_final=true` 的文本。
4. 使用 `providerSessionId + uid + sentence_id` 作为幂等键。
5. 将文本、语言、`text_ts`、时长和 source UID 发往 Helm；不附带音频。

Helm 对重复片段返回成功但不重复落库。片段可乱序到达；停止时按 `text_ts`、
`sentence_id`、接收时间做稳定排序。未知会话、非 active credential、非最终片段、超长文本、
跨 workspace 写入和已结束会话全部 fail closed。

### 5.4 停止

Helm 服务端调用：

```text
POST https://api.sd-rtn.com/cn/api/speech-to-text/v1/projects/{appid}/agents/{agentId}/leave
```

停止采用单次原子状态领取：`STARTING|RUNNING|DEGRADED -> STOPPING`。采集端先停止
麦克风发布但保持 RTC 在线；Helm 停止声网任务后保留一个有界尾部窗口，`STOPPING` 期间仍只
接受匹配本会话的最终片段，随后才读取文本账本并分析。采集端收到停止结果后再离开 RTC。
重复停止不能再次运行经营分析。没有任何最终片段时会话失败，不允许回退为演示逐字稿。

## 6. API 契约

所有采集端 API 使用 `Authorization: Bearer <capture-agent-token>`。

管理员先通过工作区登录态调用 `POST /api/capture-agents/credentials` 签发设备凭证：

```json
{
  "name": "服装门店试点 Mac",
  "transcriptRetention": "DERIVED_ONLY",
  "expiresInDays": 30
}
```

响应中的明文 token 只显示一次；列表接口只返回 prefix、状态、留存模式、到期与最近使用时间。
吊销使用 `DELETE /api/capture-agents/credentials/{credentialId}`，存在 active session 时必须先停止。

### 6.1 启动

`POST /api/capture-agents/sessions/start`

```json
{
  "title": "门店销售现场 2026-07-18 14:00",
  "language": "zh-CN",
  "consent": {
    "confirmed": true,
    "counterpartyNotified": true,
    "noticeTextVersion": "field-capture-consent/v1"
  }
}
```

### 6.2 最终片段

`POST /api/capture-agents/sessions/{providerSessionId}/segments`

```json
{
  "segments": [
    {
      "sourceUid": "123456",
      "sentenceId": "789",
      "text": "这件外套还有小一码吗",
      "textTsMs": "1784354400123",
      "durationMs": 1840,
      "language": "zh-CN",
      "isFinal": true
    }
  ]
}
```

### 6.3 停止并分析

`POST /api/capture-agents/sessions/{providerSessionId}/stop`

响应只返回会话状态和 Helm 会话 ID，不把完整逐字稿返回给设备。

### 6.4 生命周期 Webhook

`POST /api/integrations/agora/stt/webhook`

- 必须基于未解析的 raw body 校验 `Agora-Signature-V2` HMAC/SHA-256。
- `noticeId` 幂等；重复和乱序事件不回滚终态。
- 10 秒内响应；耗时分析不在 Webhook 请求内执行。

## 7. 状态机

```text
STARTING -> RUNNING -> STOPPING -> STOPPED
     |         |           |
     v         v           v
   FAILED   DEGRADED     FAILED
                |
                +------> STOPPING
```

- `STARTING`：Helm 会话已建，声网任务尚未确认。
- `RUNNING`：声网已接受任务，采集端可发布音频与转发最终片段。
- `DEGRADED`：网络 / 设备 / RTC / STT 异常；不自动补传原始音频。
- `STOPPING`：单一调用者已领取停止与分析权。
- `STOPPED`：声网任务已停止，Helm 分析已完成或已产生明确失败回执。
- `FAILED`：不可自动恢复；必须保留原因并由人工决定新建会话。

为确保任何阶段都能停止采集，声网已返回 `providerAgentId` 的 `STARTING` 会话允许接收最终
片段并进入 `STOPPING`；这不等于把 `STARTING` 宣称为 live-ready。

## 8. 仓库归属

| 能力 | 归属 |
|---|---|
| provider-neutral 会话、设备凭证、最终片段、审计与分析 | `helm-public` Core |
| 声网公开 REST / RTC adapter 与 public-safe MOCK / sample agent | `helm-public` |
| 服装零售销售过程模型与指标 | `helm-packs` sales-process Pack |
| 客户设备策略、客户网络、客户专属告知文案与 provider 参数 | `helm-overlays` |
| 部署登记、BOM、授权、健康心跳与生产回执 | `helm-control-plane` |

## 9. 手机直连复用协议（P2 设计边界）

手机路径不把蓝牙音频先送到 Helm，也不复用浏览器录音上传接口。原生 iOS / Android 采集端
应与电脑 Agent 使用同一控制协议：

1. 原生端在系统授权范围内选择 Mic Pro 蓝牙输入，并显示当前实际输入设备。
2. 以设备凭证调用 Helm start API，只取得短期 RTC 加入材料。
3. 原生端直接向声网 RTC 发布音频，并在同一频道接收 STT bot 的 Protobuf 数据流。
4. 只把 `is_final=true` 的最终文本片段按现有幂等契约发给 Helm。
5. 撤回、蓝牙断开、App 进入不允许采集的后台状态或 token 到期时立即停止发布。

由于 Mic Pro 的蓝牙输入支持依赖手机型号、系统版本和应用音频会话配置，正式试点前必须维护
逐机型兼容矩阵，至少覆盖：设备识别、来电 / 音频焦点打断、锁屏与后台限制、蓝牙断连、权限
撤回、三十分钟稳定性和功耗。未完成矩阵前，手机链路保持 `DESIGN_ONLY`，不能写成已支持。

实时手机提示属于独立的建议输出面，需要新的延迟、错误建议、顾客可见性和人工确认门禁；它
不是采集链路自然附带的能力。第一阶段只做记录后总结与复盘。

## 10. 桌面 Agent 运行

public-safe 示例实现位于 `tools/agora-field-capture-agent`。本地检查：

```bash
npm --prefix tools/agora-field-capture-agent ci
npm --prefix tools/agora-field-capture-agent run setup
npm run field-capture-agent:check
npm run field-capture-agent:device-check
```

`device-check` 的三秒电平检测不保存音频。真实启动所需的设备凭证只通过进程环境注入；完整
运行说明见 `tools/agora-field-capture-agent/README.md`。

## 11. 验收门槛

P0（本轮）：

- Helm 路由不接受任何音频 MIME 或二进制 payload。
- 设备 token 的签发、校验、过期、吊销和 workspace 隔离有自动化测试。
- 声网 REST adapter 在 MOCK 与 REAL 配置缺失时都 fail closed。
- 最终片段重复 / 乱序测试通过；停止只能分析一次。
- Webhook raw-body HMAC、重复通知和终态不回滚测试通过。
- 原生电脑采集端能列出并选择 `Insta360 Mic Pro`，且不依赖浏览器。
- 无声网凭据时只声明 MOCK + 设备枚举通过，不声明 live ASR。

P1：

- 在显式内部测试授权和真实声网凭据下完成一段合成 / 自愿测试语音 E2E。
- 验证浏览器 Network、Helm access log、数据库与对象存储均无音频内容。
- 记录 RTC 断网、Mic 拔出、重复 stop 与 Webhook 重放回执。

P2：

- 复用相同 API 契约实现原生手机采集端；逐机型验证蓝牙输入兼容性。
- 经独立门禁后再考虑实时手机提示；默认仍是复盘后建议，不是自动指挥销售。

## 12. 官方依据

- [声网实时转写快速开始](https://doc.shengwang.cn/doc/speech-to-text/restful/get-started/quick-start)
- [声网 Protobuf 转写数据解析](https://doc.shengwang.cn/doc/speech-to-text/restful/user-guides/how-to-use-protobuf)
- [声网 Webhook 接收与签名](https://doc.shengwang.cn/doc/speech-to-text/restful/webhook/receive-webhook)
- [Insta360 Mic Pro 连接手机](https://onlinemanual.insta360.com/micpro/en-us/camera/connect-devices/connect-phone)
- [Insta360 Mic Pro 连接手机、平板与电脑](https://onlinemanual.insta360.com/micpro/en-us/operation-tutorial/connection-pairing/phone-tablet-computer)
