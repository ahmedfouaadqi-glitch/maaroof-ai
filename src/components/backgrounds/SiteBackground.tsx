import { useEffect, useRef, useState } from "react";

/**
 * Site-wide hybrid background: soft drifting glow + dot grid + a few
 * connected nodes (ten models). Static on phones / reduced motion.
 */
export default function SiteBackground() {
  const [animate, setAnimate] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const small = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const sync = () => setAnimate(!motion.matches && !small.matches);
    sync();
    motion.addEventListener("change", sync);
    small.addEventListener("change", sync);
    return () => { motion.removeEventListener("change", sync); small.removeEventListener("change", sync); };
  }, []);

  useEffect(() => {
    if (!animate) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "oklch(0.7 0.15 260)";
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const resize = () => { w = window.innerWidth; h = window.innerHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    window.addEventListener("resize", resize);
    const nodes = Array.from({ length: 10 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, p: Math.random() * Math.PI * 2 }));
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color; ctx.fillStyle = color;
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 320) { ctx.globalAlpha = (1 - d / 320) * 0.12; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      for (const n of nodes) {
        ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t / 1400 + n.p);
        ctx.beginPath(); ctx.arc(n.x, n.y, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const vis = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(draw); };
    document.addEventListener("visibilitychange", vis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); document.removeEventListener("visibilitychange", vis); };
  }, [animate]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      <div
        className={`absolute -inset-[20%] ${animate ? "animate-[bgDrift_40s_ease-in-out_infinite_alternate]" : ""}`}
        style={{
          backgroundImage:
            "radial-gradient(40% 35% at 30% 20%, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 70%), radial-gradient(35% 30% at 75% 70%, color-mix(in oklab, var(--accent) 18%, transparent) 0%, transparent 70%), radial-gradient(30% 30% at 15% 80%, color-mix(in oklab, var(--primary) 12%, transparent) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(color-mix(in oklab, var(--foreground) 12%, transparent) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />
      {animate && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}
      <style>{`@keyframes bgDrift{0%{transform:translate3d(0,0,0) scale(1)}100%{transform:translate3d(4%,-3%,0) scale(1.08)}}`}</style>
    </div>
  );
}
