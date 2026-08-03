# Helm 现场采集 Agent

> 状态：内部设备与协议验证实现。它不是客户部署、生产授权、合规认证或 live ASR 回执。

这个原生桌面端用于没有浏览器可用的销售现场。它把经明确授权的麦克风音频直接发布到
声网 RTC，由声网实时转写；Helm HTTP API 不接收音频，只接收最终转写片段和会话治理元数据。

```text
Insta360 Mic Pro -> Electron Agent -> Agora RTC / STT
                                      |
                                      +-> final transcript -> Helm
```

## 本地设备验证

前置条件：macOS、Node.js 20+、已连接的 Insta360 Mic Pro 接收器。命令行电平检测还需要
`ffmpeg`；桌面端通过 Agora Web SDK 读取系统麦克风，不依赖 `ffmpeg`。

```bash
cd tools/agora-field-capture-agent
npm ci
npm run setup
npm run check
npm run device:check -- --test
npm start
```

没有配置 Helm 时，界面只进入“本地诊断”模式，可以枚举和测试麦克风，不能启动现场记录。
电平测试只把输入送到内存或 `ffmpeg` 的空输出，不保存音频文件。
“本地监听”会把所选麦克风实时送到电脑默认扬声器，用于设备验证；它不录音、不上传，且
不能与正式现场记录同时开启。该诊断链路关闭回声消除、降噪和自动增益以降低监听延迟，
监听时应让麦克风远离扬声器，避免声反馈。

## Live ASR 内部验证

服务端必须先启用声网实时转写并签发 workspace-scoped 的采集端凭证。凭证放在进程环境中，
不得写入仓库或渲染进程存储：

```bash
HELM_BASE_URL=https://helm.example.internal \
HELM_CAPTURE_AGENT_TOKEN=helm_capture_REDACTED \
npm start
```

采集端只会从 Helm 获得短期 RTC token、频道名和本次会话 UID。声网 App Certificate、REST
Customer ID / Secret 与 Webhook Secret 始终只存在于 Helm 服务端。启动前必须完成两项显式
确认：现场员工确认本次记录，以及顾客或对方已完成告知。

## 失败语义

- Helm 为 `MOCK`、凭证无效、设备缺失、授权未确认或 RTC 材料不完整时拒绝启动。
- 麦克风拔出会暂停发布并进入 degraded 状态；不会改用电脑内置麦克风静默续录。
- 网络失败只对最终文本做有界重试，不在本地缓存或补传原始音频。
- Helm API 请求十秒超时；若声网已停止但仍有最终文本未送达，界面进入“已停止·需复核”，
  不把部分分析显示为完整成功，也不伪装成仍可继续录制的会话。
- RTC token 即将到期时自动停止；首版不在会话中刷新 token。
- 停止后未收到任何最终片段时标记失败，不生成模拟逐字稿。

完整边界、API 与仓库归属见
[`docs/integrations/AGORA_FIELD_CAPTURE.md`](../../docs/integrations/AGORA_FIELD_CAPTURE.md)。
