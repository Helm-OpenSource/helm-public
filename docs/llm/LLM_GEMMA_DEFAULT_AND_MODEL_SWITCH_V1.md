---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# LLM Gemma Default And Model Switch V1

## 1. Scope

This document defines the current workspace-level LLM model switching contract under an OpenAI-compatible endpoint.

- Default provider: `qwen`
- Default model: `qwen3.6-plus`
- Qwen default endpoint: `https://dashscope.aliyuncs.com/compatible-mode/v1`
- OpenAI-compatible local endpoint (for `openai` provider): `http://127.0.0.1:8000/v1`
- Credential variables:
  - `DASHSCOPE_API_KEY` (recommended for `qwen`)
  - `OPENAI_API_KEY` (used by `openai`, and fallback for `qwen` when DashScope key is empty)

## 2. Model Catalog (Static)

Settings now exposes a static built-in model catalog grouped by vendor:

- local
  - `google/gemma-4-31B-it`
- openai
  - `gpt-5.4`
  - `gpt-5.2`
  - `gpt-4.1`
  - `gpt-4.1-mini`
- qwen
  - `qwen3.6-plus`
  - `qwen3.6-flash`
  - `qwen-max-latest`
  - `qwen-plus-latest`
  - `qwen-turbo-latest`
- deepseek
  - `deepseek-reasoner`
  - `deepseek-chat`
- anthropic
  - `claude-opus-4-1-20250805`
  - `claude-sonnet-4-20250514`

This list is intentionally static in current scope. It is not a runtime web-synced registry.

## 3. Settings Save Contract

On `Settings > Account > LLM status`, four model slots are editable:

- default model
- extraction model
- briefing model
- reasoning model

Save flow:

1. Probe `${LLM_BASE_URL}` mapped health endpoint (`/healthz`) for connectivity
2. Persist four selected slot values directly (`default/extraction/briefing/reasoning`)
3. If health check fails, still persist selected values and return a connectivity warning

## 4. Boundary Notes

- Supported providers: `openai` and `qwen` (both via OpenAI-compatible transport).
- This does not add native Anthropic / DeepSeek SDK integration.
- `qwen` provider still uses OpenAI-compatible transport (no standalone Qwen SDK runtime in Helm).
- LLM failures or misconfiguration still fall back to rule-based behavior.
- The local OpenAI-compatible endpoint is not required to implement `/v1/models`.
