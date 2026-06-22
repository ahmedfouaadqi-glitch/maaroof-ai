import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type RevealTag = "div" | "section" | "article" | "li" | "header" | "footer";

type RevealProps<T extends RevealTag = "div"> = {
  children: ReactNode;
  delay?: number;
  once?: boolean;
  rootMargin?: string;
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, "children">;

/**
 * Reveal — unified scroll-triggered fade/slide using IntersectionObserver.
 * Respects prefers-reduced-motion (CSS guard in styles.css forces visible state).
 */
export function Reveal<T extends RevealTag = "div">({
  children,
  className,
  delay = 0,
  once = true,
  rootMargin = "0px 0px -10% 0px",
  as,
  style,
  ...rest
}: RevealProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setRevealed(true);
            if (once) io.disconnect();
          } else if (!once) {
            setRevealed(false);
          }
        }
      },
      { rootMargin, threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, rootMargin]);

  return (
    <Tag
      ref={ref as never}
      data-revealed={revealed ? "true" : "false"}
      className={cn("reveal", className)}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined, ...(style as React.CSSProperties | undefined) }}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
