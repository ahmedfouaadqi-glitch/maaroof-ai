import { useEffect, useRef } from "react";

type Props = { intensity?: number; active?: boolean; className?: string };

const CHARS = "01ابتثجحخدذرزسشصضطظعغفقكلمنهويءABCDEF0123456789{}<>/\\";

export function MatrixRain({ intensity = 0.4, active = true, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, r.width * dpr);
      canvas.height = Math.max(1, r.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    const fontSize = 14 * dpr;
    let drops: number[] = [];
    const reset = () => {
      const cols = Math.floor(canvas.width / fontSize);
      drops = new Array(cols).fill(0).map(() => Math.random() * -50);
    };
    reset();
    let last = 0;
    const speed = Math.max(40, 120 - Math.round(intensity * 80));
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (!active) return;
      if (t - last < speed) return;
      last = t;
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px monospace`;
      ctx.fillStyle = "hsl(var(--primary) / 0.55)";
      for (let i = 0; i < drops.length; i++) {
        if (Math.random() > 0.05 + intensity * 0.5) continue;
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.fillText(ch, i * fontSize, drops[i] * fontSize);
        drops[i]++;
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [intensity, active]);
  return <canvas ref={ref} className={className} aria-hidden />;
}
