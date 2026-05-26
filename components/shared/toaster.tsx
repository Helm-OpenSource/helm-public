"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          toast: "!rounded-2xl !border !border-[color:var(--border)] !bg-[color:var(--surface)] !text-[color:var(--foreground)]",
          description: "!text-[color:var(--muted-foreground)]",
        },
      }}
    />
  );
}
