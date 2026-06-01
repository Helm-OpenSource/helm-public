"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UiLocale } from "@/lib/i18n/config";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "helm-theme";

function readTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
}

type ThemeToggleProps = {
  locale?: UiLocale;
};

export function ThemeToggle({ locale }: ThemeToggleProps) {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);
  const [english, setEnglish] = useState(locale === "en-US");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setTheme(readTheme());
      setEnglish(locale ? locale === "en-US" : document.documentElement.lang === "en-US");
      setMounted(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [locale]);

  return (
    <Button
      size="icon"
      variant="secondary"
      onClick={() => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      aria-label={theme === "dark" ? (english ? "Switch to light mode" : "切换到浅色模式") : (english ? "Switch to dark mode" : "切换到深色模式")}
      title={theme === "dark" ? (english ? "Switch to light mode" : "切换到浅色模式") : (english ? "Switch to dark mode" : "切换到深色模式")}
    >
      {!mounted ? <MoonStar className="h-4 w-4" /> : theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
    </Button>
  );
}
