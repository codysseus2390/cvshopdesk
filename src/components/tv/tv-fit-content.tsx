import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fit complete TV values/tables into their allotted space without truncation. */
export function TvFitContent({
  children,
  className,
  fullWidth = false,
}: {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const refit = useRef(() => {});

  useLayoutEffect(() => {
    const outer = container.current;
    const inner = content.current;
    if (!outer || !inner) return;
    let active = true;
    const fit = () => {
      if (!active) return;
      const scale = Math.min(
        1,
        Math.max(0, outer.clientWidth - 2) / Math.max(1, inner.scrollWidth),
        Math.max(0, outer.clientHeight - 2) / Math.max(1, inner.scrollHeight),
      );
      inner.style.transform = `scale(${scale})`;
    };
    refit.current = fit;
    const observer = new ResizeObserver(fit);
    observer.observe(outer);
    observer.observe(inner);
    void document.fonts.ready.then(fit);
    fit();
    return () => {
      active = false;
      refit.current = () => {};
      observer.disconnect();
    };
  }, []);

  // A value can grow without changing a fixed-width table's observed dimensions.
  useLayoutEffect(() => refit.current());

  return (
    <div ref={container} className={cn("tv-fit-content", className)}>
      <div ref={content} className={cn("tv-fit-inner", fullWidth && "tv-fit-full-width")}>
        {children}
      </div>
    </div>
  );
}
