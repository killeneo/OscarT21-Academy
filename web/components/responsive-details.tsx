"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Filters panel: collapsible on small screens, always open on wide ones.
 * Without JS the panel stays open (server-rendered `open`), so nothing is ever hidden from the user.
 */
export function ResponsiveDetails({
  summary,
  className,
  summaryClassName,
  children,
}: {
  summary: string;
  className?: string;
  summaryClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 901px)");
    const sync = () => {
      if (ref.current) ref.current.open = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <details ref={ref} className={className} open>
      <summary className={summaryClassName}>{summary}</summary>
      {children}
    </details>
  );
}
