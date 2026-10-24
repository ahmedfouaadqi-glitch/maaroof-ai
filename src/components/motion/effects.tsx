import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from "react";

/** SpotlightCard — React Bits inspired: a soft light follows the pointer. */
export function SpotlightCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--sx", `${e.clientX - r.left}px`);
    el.style.setProperty("--sy", `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onMouseMove={onMove} className={`spotlight-card group relative overflow-hidden rounded-2xl border border-border bg-card/40 ${className}`}>
      <div aria-hidden className="spotlight-layer pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">{children}</div>
    </div>
  );
}

/** CountUp — animates to a real number once visible. */
export function CountUp({ to, suffix = "", className = "" }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduced) { setV(to); return; }
    const c = animate(0, to, { duration: 1.4, ease: "easeOut", onUpdate: (n) => setV(Math.round(n)) });
    return () => c.stop();
  }, [inView, to, reduced]);
  return <span ref={ref} className={className}>{v.toLocaleString()}{suffix}</span>;
}

/** RotatingText — cycles words with a vertical slide. */
export function RotatingText({ words, interval = 2200, className = "" }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || words.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval, reduced]);
  return (
    <span className={`relative inline-block ${className}`}>
      <motion.span key={i} initial={reduced ? false : { y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4 }} className="inline-block">
        {words[i]}
      </motion.span>
    </span>
  );
}

/** ShinyText — a light sweep over text (CSS only). */
export function ShinyText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`shiny-text ${className}`}>{children}</span>;
}

export type PulseState = "running" | "done" | "failed" | "skipped";
/** PulseBadge — status dot with a pulse while running. */
export function PulseBadge({ state, label }: { state: PulseState; label: string }) {
  const tone = state === "done" ? "bg-success" : state === "failed" ? "bg-destructive" : state === "skipped" ? "bg-muted-foreground" : "bg-primary";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="relative flex size-2">
        {state === "running" && <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:hidden ${tone}`} />}
        <span className={`relative inline-flex size-2 rounded-full ${tone}`} />
      </span>
      {label}
    </span>
  );
}

/** LogoLoop — infinite marquee; pauses on hover and for reduced motion. */
export function LogoLoop({ children }: { children: ReactNode }) {
  return (
    <div className="logo-loop group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]" dir="ltr">
      <div className="logo-loop-track flex w-max gap-3 group-hover:[animation-play-state:paused]">
        {children}
        <div aria-hidden className="flex gap-3">{children}</div>
      </div>
    </div>
  );
}

/** Magnetic — wrapper that nudges toward the pointer (desktop only). */
export function Magnetic({ children, strength = 0.25 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 });
  const y = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 });
  return (
    <motion.span
      ref={ref}
      style={{ x, y, display: "inline-block" }}
      onMouseMove={(e) => {
        if (reduced || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      {children}
    </motion.span>
  );
}
