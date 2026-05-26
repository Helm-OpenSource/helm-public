# HELM_FEISHU_OAUTH_CALLBACK_FOUNDATION_BASELINE_V1

日期：2026-05-20

## 目标

把飞书接入收敛为 `workspace-first`、`membership-backed`、`controlled-trial`、`judgement-first` 的 OAuth callback foundation。

本基线只覆盖：

- `/api/auth/feishu/start`
- `/api/auth/feishu/callback`
- `/api/public-auth/feishu/start`
- `/api/public-auth/feishu/callback`
- `providerType = FEISHU_OAUTH`
- workspace-scoped connector metadata / callback audit / settings readout

## 当前仓库真值

- 当前已落地 workspace-scoped Feishu OAuth callback foundation。
- 当前已落地 public auth 入口，可与钉钉同时存在于登录页。
- 当前已落地 settings readout，可显示 callback status、failure posture、matched workspace user。
- 当前仍把 `Bitable read` 和 `message draft(review-first)` 保持为下一层。

## 边界

- recommendation != commitment
- no auto-send
- no broad auto-write
- no execution-authority expansion
- No auto-send, write-back, or auto-execution path

## 配置

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_REDIRECT_URI`

## 运行时说明

- 认证主链使用 Feishu OAuth authorize + user access token exchange。
- 用户身份优先按 email / mobile 绑定到当前 workspace user。
- settings readout 只暴露 callback truth，不把当前 repo truth 写成 Bitable runtime 或 send/write-back connector 已成立。

## 后续仍待下一层

- Bitable read runtime
- message draft(review-first)
- 更宽的 directory platformization
- 更宽的 connector control plane
