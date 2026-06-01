"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type ConnectorBindingSuccessSheetProps = {
  english: boolean;
  status?: string | null;
  message?: string | null;
};

export function ConnectorBindingSuccessSheet({
  english,
  status,
  message,
}: ConnectorBindingSuccessSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isOpenInitially = status === "binding-succeeded";
  const [open, setOpen] = useState(isOpenInitially);

  const copy = useMemo(
    () => ({
      title: english ? "Connector account bound" : "连接器账号绑定成功",
      description:
        message?.trim() ||
        (english
          ? "The current Helm user has been bound to the connector account."
          : "当前 Helm 用户已成功绑定连接器账号。"),
      confirm: english ? "OK" : "确定",
    }),
    [english, message],
  );

  if (!isOpenInitially) {
    return null;
  }

  const closeAndStayOnDashboard = () => {
    setOpen(false);
    router.replace(pathname || "/dashboard");
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) =>
        !nextOpen ? closeAndStayOnDashboard() : setOpen(nextOpen)
      }
    >
      <SheetContent
        className="inset-x-1/2 inset-y-1/2 h-fit max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[color:var(--border)] p-0"
        closeLabel={english ? "Close dialog" : "关闭弹窗"}
      >
        <SheetHeader className="border-b border-[color:var(--border)] px-6 py-5">
          <SheetTitle>{copy.title}</SheetTitle>
          <SheetDescription>{copy.description}</SheetDescription>
        </SheetHeader>
        <div className="px-6 py-5">
          <div className="flex justify-end">
            <Button onClick={closeAndStayOnDashboard}>{copy.confirm}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
