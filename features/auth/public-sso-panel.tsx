"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Building2, ScanQrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UiLocale } from "@/lib/i18n/config";

export type PublicSsoOption = {
  provider: "dingtalk" | "wecom" | "feishu";
  ready: boolean;
  startUrl: string | null;
};

type DingTalkQrFlowCreateResponse = {
  ok: boolean;
  status: "created";
  flowId: string;
  qrUrl: string;
};

type DingTalkQrFlowPollResponse =
  | {
      ok: true;
      status: "pending";
    }
  | {
      ok: true;
      status:
        | "matched"
        | "unmatched"
        | "oauth-error"
        | "failure"
        | "identity-conflict"
        | "missing-identity";
      completeUrl: string;
    }
  | {
      ok: false;
      status: "expired" | "not-found" | "invalid-owner" | "missing-config";
    };

const DINGTALK_QR_POLL_INTERVAL_MS = 1500;
const DINGTALK_PUBLIC_AUTH_CONTEXT_PARAMS = ["org", "ws", "title"] as const;

export function resolveActivePublicSsoQrUrl(input: {
  activeOption: PublicSsoOption | null;
  dingtalkQrUrl: string | null;
}) {
  if (!input.activeOption?.ready) {
    return null;
  }

  if (input.activeOption.provider === "dingtalk") {
    return input.dingtalkQrUrl;
  }

  return input.activeOption.startUrl;
}

export function isIgnorableDingTalkQrFlowError(input: {
  error: unknown;
  disposed: boolean;
  aborted: boolean;
}) {
  if (input.disposed || input.aborted) {
    return true;
  }

  if (input.error instanceof Error && input.error.name === "AbortError") {
    return true;
  }

  return false;
}

export function buildDingTalkQrFlowCreateUrl(startUrl: string | null) {
  const fallbackOrigin = "http://helm.local";
  const endpoint = new URL("/api/public-auth/dingtalk/qr-flow", fallbackOrigin);

  if (!startUrl) {
    return `${endpoint.pathname}${endpoint.search}`;
  }

  try {
    const parsedStartUrl = new URL(startUrl, fallbackOrigin);
    for (const key of DINGTALK_PUBLIC_AUTH_CONTEXT_PARAMS) {
      const value = parsedStartUrl.searchParams.get(key);
      if (value?.trim()) {
        endpoint.searchParams.set(key, value);
      }
    }
  } catch {
    // Ignore malformed configured start URLs; the QR endpoint will still create
    // a generic public login flow.
  }

  return `${endpoint.pathname}${endpoint.search}`;
}

function ProviderQrCode({
  value,
  alt,
}: {
  value: string | null;
  alt: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!value) {
      return;
    }

    QRCode.toDataURL(value, {
      margin: 1,
      width: 176,
      color: {
        dark: "#3f3f46",
        light: "#0000",
      },
    })
      .then((next: string) => {
        if (!cancelled) {
          setDataUrl(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value]);

  return (
    <div className="flex h-[168px] w-[168px] items-center justify-center rounded-[28px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)]">
      {dataUrl ? (
        <Image
          src={dataUrl}
          alt={alt}
          width={144}
          height={144}
          unoptimized
          className="h-[144px] w-[144px] rounded-2xl"
        />
      ) : (
        <div className="flex h-[144px] w-[144px] items-center justify-center rounded-2xl bg-[color:var(--surface-subtle)] text-[color:var(--muted-foreground)]">
          <ScanQrCode className="h-12 w-12" />
        </div>
      )}
    </div>
  );
}

export function PublicSsoPanel({
  locale,
  options,
}: {
  locale: UiLocale;
  options: PublicSsoOption[];
}) {
  const english = locale === "en-US";
  const orderedOptions = [...options].sort((left, right) => {
    if (left.provider === right.provider) {
      return 0;
    }

    const order = {
      dingtalk: 0,
      feishu: 1,
      wecom: 2,
    } as const;
    return order[left.provider] - order[right.provider];
  });
  const [activeProvider, setActiveProvider] = useState<"dingtalk" | "wecom" | "feishu">("dingtalk");
  const [dingtalkQrUrl, setDingtalkQrUrl] = useState<string | null>(null);
  const [dingtalkFlowId, setDingtalkFlowId] = useState<string | null>(null);
  const [dingtalkFlowUnavailable, setDingtalkFlowUnavailable] = useState(false);
  const activeOption =
    orderedOptions.find((option) => option.provider === activeProvider) ?? orderedOptions[0] ?? null;
  const activeProviderName = activeOption?.provider ?? null;
  const activeProviderReady = activeOption?.ready ?? false;
  const activeQrUrl = resolveActivePublicSsoQrUrl({
    activeOption,
    dingtalkQrUrl,
  });
  const dingtalkQrPending =
    activeProviderName === "dingtalk" && activeProviderReady && !dingtalkQrUrl && !dingtalkFlowUnavailable;

  useEffect(() => {
    if (activeProviderName !== "dingtalk" || !activeProviderReady || dingtalkFlowUnavailable) {
      return;
    }

    let disposed = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const abortController = new AbortController();

    const disposePolling = () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
      }
      pollTimer = null;
    };

    const schedulePolling = () => {
      if (disposed) {
        return;
      }
      pollTimer = setTimeout(() => {
        void pollFlow();
      }, DINGTALK_QR_POLL_INTERVAL_MS);
    };

    const pollFlow = async () => {
      if (disposed || !dingtalkFlowId) {
        return;
      }

      if (document.hidden) {
        schedulePolling();
        return;
      }

      try {
        const response = await fetch(
          `/api/public-auth/dingtalk/qr-flow?flowId=${encodeURIComponent(dingtalkFlowId)}`,
          {
            cache: "no-store",
            signal: abortController.signal,
          },
        );
        const payload = (await response.json()) as DingTalkQrFlowPollResponse;

        if (!payload.ok) {
          if (
            payload.status === "expired" ||
            payload.status === "not-found" ||
            payload.status === "invalid-owner"
          ) {
            await createFlow();
            return;
          }

          schedulePolling();
          return;
        }

        if (payload.status === "pending") {
          schedulePolling();
          return;
        }

        if (payload.completeUrl) {
          disposed = true;
          window.location.assign(payload.completeUrl);
          return;
        }
      } catch (error) {
        if (
          isIgnorableDingTalkQrFlowError({
            error,
            disposed,
            aborted: abortController.signal.aborted,
          })
        ) {
          return;
        }
        schedulePolling();
      }
    };

    const createFlow = async () => {
      try {
        const response = await fetch(buildDingTalkQrFlowCreateUrl(activeOption?.startUrl ?? null), {
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          setDingtalkFlowUnavailable(true);
          setDingtalkFlowId(null);
          return;
        }

        const payload = (await response.json()) as DingTalkQrFlowCreateResponse;

        if (!payload.ok || payload.status !== "created") {
          setDingtalkFlowUnavailable(true);
          setDingtalkFlowId(null);
          return;
        }

        if (disposed) {
          return;
        }

        setDingtalkFlowUnavailable(false);
        setDingtalkFlowId(payload.flowId);
        setDingtalkQrUrl(payload.qrUrl);
      } catch (error) {
        if (
          isIgnorableDingTalkQrFlowError({
            error,
            disposed,
            aborted: abortController.signal.aborted,
          })
        ) {
          return;
        }
        setDingtalkFlowUnavailable(true);
        setDingtalkFlowId(null);
        return;
      }
    };

    if (!dingtalkFlowId || !dingtalkQrUrl) {
      void createFlow();
    } else {
      schedulePolling();
    }

    return () => {
      disposed = true;
      abortController.abort();
      disposePolling();
    };
  }, [
    activeProviderName,
    activeProviderReady,
    activeOption?.startUrl,
    dingtalkFlowId,
    dingtalkQrUrl,
    dingtalkFlowUnavailable,
  ]);

  return (
    <div className="flex min-h-[228px] flex-col justify-center gap-4" data-testid="public-landing-sso-panel">
      <div className="flex justify-start">
        <div
          className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] p-1 shadow-[var(--shadow-card)]"
          role="group"
          aria-label={english ? "SSO provider switch" : "扫码方式切换"}
        >
          {orderedOptions.map((option) => {
            const active = option.provider === activeOption?.provider;
            const title =
              option.provider === "dingtalk"
                ? english
                  ? "DingTalk"
                  : "钉钉"
                : option.provider === "feishu"
                  ? english
                    ? "Feishu"
                    : "飞书"
                  : english
                    ? "WeCom"
                    : "企业微信";

            return (
              <Button
                key={option.provider}
                type="button"
                size="sm"
                variant="ghost"
                className={`h-8 rounded-full px-3 text-xs font-semibold ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]"
                    : "text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--foreground)]"
                }`}
                data-testid={`public-landing-sso-${option.provider}`}
                aria-label={
                  english
                    ? `Switch SSO provider to ${title}`
                    : `切换扫码方式到${title}`
                }
                aria-pressed={active}
                onClick={() => {
                  setActiveProvider(option.provider);
                  if (option.provider !== "dingtalk") {
                    setDingtalkFlowUnavailable(false);
                    setDingtalkFlowId(null);
                    setDingtalkQrUrl(null);
                  }
                }}
              >
                {title}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center">
        {activeOption?.ready && activeQrUrl ? (
          <a
            href={activeQrUrl}
            aria-label={
              activeOption.provider === "dingtalk"
                ? english
                  ? "Open DingTalk sign-in"
                  : "打开钉钉登录"
                : activeOption.provider === "feishu"
                  ? english
                    ? "Open Feishu sign-in"
                    : "打开飞书登录"
                : english
                  ? "Open WeCom sign-in"
                  : "打开企业微信登录"
            }
          >
            <ProviderQrCode
              value={activeQrUrl}
              alt={
                activeOption.provider === "dingtalk"
                  ? english
                    ? "DingTalk QR code"
                    : "钉钉二维码"
                  : activeOption.provider === "feishu"
                    ? english
                      ? "Feishu QR code"
                      : "飞书二维码"
                  : english
                    ? "WeCom QR code"
                    : "企业微信二维码"
              }
            />
          </a>
        ) : activeProviderName === "dingtalk" && activeProviderReady ? (
          <div className="flex h-[168px] w-[168px] items-center justify-center rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--muted-foreground)]">
            <div className="space-y-2 px-4 text-center">
              <ScanQrCode className="mx-auto h-8 w-8" />
              <p className="text-xs font-medium">
                {dingtalkQrPending
                  ? english
                    ? "Preparing DingTalk QR..."
                    : "正在生成钉钉扫码入口..."
                  : english
                    ? "Unable to load DingTalk QR. Refresh to retry."
                    : "钉钉二维码加载失败，请刷新后重试。"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-[168px] w-[168px] items-center justify-center rounded-[28px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--muted-foreground)]">
            <div className="space-y-2 px-4 text-center">
              <Building2 className="mx-auto h-8 w-8" />
              <p className="text-xs font-medium">
                {english ? "Config pending" : "待配置"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
