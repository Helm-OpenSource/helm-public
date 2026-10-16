"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Mounts its children only while the closest `<details>` ancestor is open.
 *
 * Object-first detail pages fold the shared chain shell into the closing
 * `<details data-system-judgement>` block. That shell renders its own
 * PageHeader (an h1 plus a breadcrumb trail), so keeping it out of the DOM
 * until the reader opens the block leaves the object header as the page's
 * only h1 and breadcrumb.
 *
 * 对象优先详情页把共享链路壳折进末尾的系统判断块。链路壳自带页头（h1 和面包屑），
 * 所以只在读者展开时才挂载，页面上唯一的 h1 和面包屑仍是对象页头。
 */
export function MountWhenOpen({ children }: { children: ReactNode }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const details = anchorRef.current?.closest("details");
    if (!details) return;
    const sync = () => setOpen(details.open);
    details.addEventListener("toggle", sync);
    return () => details.removeEventListener("toggle", sync);
  }, []);

  return (
    <>
      <span ref={anchorRef} hidden />
      {open ? children : null}
    </>
  );
}
