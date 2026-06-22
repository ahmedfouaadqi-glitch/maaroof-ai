import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface RevealProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Stagger delay in ms */
  delay?: number;
  /** Reveal only once (default true) */
  once?: boolean;
  /** Margin around the root to trigger earlier */
  rootMargin?: string;
  as?: "div" | "section" | "article" | "li" | "header" | "footer";
}

/**
 * Reveal — unified scroll-triggered fade/slide using IntersectionObserver.
 * Respects prefers-reduced-motion (CSS guard in styles.css forces visible state).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  once = true,
  rootMargin = "0px 0px -10% 0px",
  as: Tag = "div",
  style,
  ...rest
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
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
      style={{ transitionDelay: delay ? `${delay}ms` : undefined, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
