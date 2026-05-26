"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Button } from "@/components/ui/button";

const ACTIVE_PREFIXES = ["/dashboard", "/opportunities", "/approvals", "/inbox", "/memory"];
const INTERVAL_MS = 30_000;

export function LiveRefreshStatus() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const [pending, startTransition] = useTransition();
  const [lastRefreshAt, setLastRefreshAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const lastRefreshAtRef = useRef(lastRefreshAt);

  const enabled = useMemo(
    () => ACTIVE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)),
    [pathname],
  );

  const runRefresh = () => {
    const refreshedAt = Date.now();
    setLastRefreshAt(refreshedAt);
    lastRefreshAtRef.current = refreshedAt;
    setNow(refreshedAt);
    startTransition(() => {
      router.refresh();
    });
  };

  useEffect(() => {
    lastRefreshAtRef.current = lastRefreshAt;
  }, [lastRefreshAt]);

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);

      if (!document.hidden && !pending && current - lastRefreshAtRef.current >= INTERVAL_MS) {
        const refreshedAt = current;
        setLastRefreshAt(refreshedAt);
        lastRefreshAtRef.current = refreshedAt;
        setNow(refreshedAt);
        startTransition(() => {
          router.refresh();
        });
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [enabled, pending, router, startTransition]);

  if (!enabled) return null;

  const seconds = Math.max(1, Math.ceil((INTERVAL_MS - (now - lastRefreshAt)) / 1000));

  const tooltip = pending
    ? (english ? "Refreshing..." : "同步中...")
    : (english ? `Auto refresh ${seconds}s` : `自动刷新 ${seconds}s`);

  return (
    <Button
      size="icon"
      variant="secondary"
      className="hidden lg:inline-flex"
      onClick={runRefresh}
      disabled={pending}
      aria-label={tooltip}
      title={tooltip}
    >
      <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
      <span className="hidden 3xl:inline ml-2">{tooltip}</span>
    </Button>
  );
}
