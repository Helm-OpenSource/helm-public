"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  claimStaleChunkReload,
  classifyClientRuntimeError,
  isRecoverableChunkLoadError,
  toClientRuntimeRouteFamily,
} from "@/lib/client-runtime-error-recovery";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const english = typeof document !== "undefined" ? document.documentElement.lang === "en-US" : false;

  useEffect(() => {
    const payload = {
      code: classifyClientRuntimeError(error),
      digest: error.digest ?? null,
      routeFamily:
        typeof window !== "undefined"
          ? toClientRuntimeRouteFamily(window.location.pathname)
          : "other",
    };

    const endpoint = "/api/runtime/client-errors";
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
    } else {
      void fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
        keepalive: true,
      });
    }

    console.error(error);

    if (
      typeof window !== "undefined" &&
      isRecoverableChunkLoadError(error) &&
      claimBrowserStaleChunkReload()
    ) {
      const timer = window.setTimeout(() => window.location.reload(), 100);
      return () => window.clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="workspace-shell-panel rounded-[28px] border p-8 shadow-sm backdrop-blur">
        <h2 className="text-2xl font-semibold text-[color:var(--foreground)]">{english ? "Something broke. Your data is safe." : "出错了，但你的数据没事。"}</h2>
        <p className="mt-2 max-w-xl text-sm text-[color:var(--muted-foreground)]">
          {english ? "We logged this. Hit retry — most cases recover on the second try. If not, the dashboard still works." : "异常已记录。直接重试一次，多数情况下第二次就好；不行就回工作台，那边一切正常。"}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>{english ? "Try again" : "再试一次"}</Button>
          <Button variant="secondary" onClick={() => window.location.assign("/dashboard")}>
            {english ? "Back to dashboard" : "回到工作台"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function claimBrowserStaleChunkReload() {
  try {
    return claimStaleChunkReload(window.sessionStorage);
  } catch {
    return false;
  }
}
