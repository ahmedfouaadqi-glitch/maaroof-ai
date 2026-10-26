import { useEffect, useRef, useState } from "react";

type BackgroundActivity = "idle" | "analyzing" | "running" | "success" | "failed";
type NetworkNode = { x: number; y: number; vx: number; vy: number; phase: number };
type PointerState = { x: number; y: number; active: boolean; lastMovedAt: number };
type RippleState = { x: number; y: number; startedAt: number; active: boolean };

const ACTIVITY_EVENT = "maaroof:background-state";
const SUCCESS_GLOW_MS = 2800;

/**
 * Site-wide knowledge constellation: a theme-aware, canvas-only particle mesh.
 * Animation pauses when the page is hidden or reduced motion is requested.
 * Mobile and coarse-pointer devices use a smaller node count and a lower frame cap.
 */
export default function SiteBackground() {
  const [animate, setAnimate] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } }).connection;
    const sync = () => {
      const lowData = Boolean(connection?.saveData || connection?.effectiveType === "2g");
      setAnimate(!motion.matches && !lowData);
    };
    sync();
    motion.addEventListener("change", sync);
    connection?.addEventListener?.("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      connection?.removeEventListener?.("change", sync);
    };
  }, []);

  useEffect(() => {
    if (!animate) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true, desynchronized: true });
    if (!canvas || !ctx) return;

    const rootStyle = getComputedStyle(document.documentElement);
    const primary = rootStyle.getPropertyValue("--primary").trim() || "oklch(0.60 0.20 262)";
    const accent = rootStyle.getPropertyValue("--accent").trim() || primary;
    const success = rootStyle.getPropertyValue("--success").trim() || primary;
    const smallScreen = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = false;
    let lastFrameAt = 0;
    const initialActivity = document.documentElement.dataset.maaroofActivity as BackgroundActivity | undefined;
    let activity: BackgroundActivity = initialActivity && ["idle", "analyzing", "running", "success", "failed"].includes(initialActivity) ? initialActivity : "idle";
    let successUntil = 0;
    const nodes: NetworkNode[] = [];
    const pointer: PointerState = { x: 0, y: 0, active: false, lastMovedAt: 0 };
    const ripple: RippleState = { x: 0, y: 0, startedAt: 0, active: false };

    const randomNode = (): NetworkNode => ({
      x: Math.random() * Math.max(1, width),
      y: Math.random() * Math.max(1, height),
      vx: (Math.random() - 0.5) * 0.022,
      vy: (Math.random() - 0.5) * 0.022,
      phase: Math.random() * Math.PI * 2,
    });

    const desiredNodeCount = () => {
      const area = Math.max(1, width * height);
      if (smallScreen.matches) return Math.max(12, Math.min(18, Math.round(area / 42000)));
      return Math.max(22, Math.min(34, Math.round(area / 44000)));
    };

    const resize = () => {
      const oldWidth = width;
      const oldHeight = height;
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      dpr = Math.min(smallScreen.matches ? 1.15 : 1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (oldWidth > 0 && oldHeight > 0) {
        const xScale = width / oldWidth;
        const yScale = height / oldHeight;
        for (const node of nodes) {
          node.x *= xScale;
          node.y *= yScale;
        }
      }

      const count = desiredNodeCount();
      while (nodes.length < count) nodes.push(randomNode());
      if (nodes.length > count) nodes.length = count;
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      pointer.lastMovedAt = performance.now();
    };
    const onPointerDown = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
      pointer.lastMovedAt = performance.now();
      ripple.x = event.clientX;
      ripple.y = event.clientY;
      ripple.startedAt = performance.now();
      ripple.active = true;
    };
    const onBlur = () => { pointer.active = false; };
    const onActivity = (event: Event) => {
      const next = (event as CustomEvent<{ state?: BackgroundActivity }>).detail?.state;
      if (!next || !["idle", "analyzing", "running", "success", "failed"].includes(next)) return;
      activity = next;
      if (next === "success") successUntil = performance.now() + SUCCESS_GLOW_MS;
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const start = () => {
      if (running || document.hidden) return;
      running = true;
      lastFrameAt = 0;
      raf = requestAnimationFrame(draw);
    };
    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    const draw = (time: number) => {
      if (!running || document.hidden) return;
      const frameInterval = smallScreen.matches
        ? (activity === "running" || activity === "analyzing" ? 33 : 48)
        : (activity === "running" || activity === "analyzing" ? 16 : 24);
      if (lastFrameAt && time - lastFrameAt < frameInterval) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const elapsed = lastFrameAt ? Math.min(40, Math.max(0, time - lastFrameAt)) : frameInterval;
      lastFrameAt = time;

      if (activity === "success" && time >= successUntil) activity = "idle";
      const active = activity === "running" || activity === "analyzing";
      const successful = activity === "success";
      const networkColor = successful ? success : primary;
      const speed = active ? 1.8 : successful ? 1.2 : 1;
      const linkOpacity = active ? 0.34 : successful ? 0.3 : activity === "failed" ? 0.24 : 0.25;
      const linkDistance = smallScreen.matches ? 285 : 330;
      const pointerRecentlyActive = pointer.active && time - pointer.lastMovedAt < 2600;
      const pointerRadius = smallScreen.matches ? 130 : 170;

      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = active ? 1.25 : 1;
      ctx.strokeStyle = networkColor;
      ctx.fillStyle = networkColor;

      // Slow ambient movement, with a small attraction toward a recently moved pointer.
      for (const node of nodes) {
        if (pointerRecentlyActive) {
          const dx = pointer.x - node.x;
          const dy = pointer.y - node.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 1 && distance < pointerRadius) {
            const force = ((pointerRadius - distance) / pointerRadius) * elapsed * 0.0000015;
            node.vx += (dx / distance) * force;
            node.vy += (dy / distance) * force;
          }
        }
        const maxSpeed = active ? 0.038 : 0.026;
        node.vx = Math.max(-maxSpeed, Math.min(maxSpeed, node.vx));
        node.vy = Math.max(-maxSpeed, Math.min(maxSpeed, node.vy));
        node.x += node.vx * elapsed * speed;
        node.y += node.vy * elapsed * speed;
        node.vx *= Math.pow(0.99992, elapsed);
        node.vy *= Math.pow(0.99992, elapsed);
        if (node.x < 0) { node.x = 0; node.vx = Math.abs(node.vx); }
        if (node.x > width) { node.x = width; node.vx = -Math.abs(node.vx); }
        if (node.y < 0) { node.y = 0; node.vy = Math.abs(node.vy); }
        if (node.y > height) { node.y = height; node.vy = -Math.abs(node.vy); }
      }

      // Knowledge mesh: connect close nodes with a clearly visible but restrained line.
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance >= linkDistance) continue;

          ctx.globalAlpha = (1 - distance / linkDistance) * linkOpacity;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();

          // Active runs send tiny packets along a subset of mesh edges.
          if (active && (i * nodes.length + j) % 3 === 0) {
            const progress = ((time * 0.00022 + i * 0.173 + j * 0.071) % 1 + 1) % 1;
            const px = a.x + (b.x - a.x) * progress;
            const py = a.y + (b.y - a.y) * progress;
            ctx.globalAlpha = 0.78;
            ctx.beginPath();
            ctx.arc(px, py, 1.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // The cursor/finger becomes a temporary node linked to the nearest five particles.
      if (pointerRecentlyActive) {
        const nearest = nodes
          .map((node) => ({ node, distance: Math.hypot(node.x - pointer.x, node.y - pointer.y) }))
          .filter((entry) => entry.distance < (smallScreen.matches ? 210 : 255))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5);
        for (const entry of nearest) {
          ctx.globalAlpha = (1 - entry.distance / (smallScreen.matches ? 210 : 255)) * (active ? 0.42 : 0.3);
          ctx.beginPath();
          ctx.moveTo(pointer.x, pointer.y);
          ctx.lineTo(entry.node.x, entry.node.y);
          ctx.stroke();
        }
      }

      // Soft node glow; use only existing theme colors.
      ctx.shadowColor = successful ? success : active ? accent : primary;
      ctx.shadowBlur = active ? (smallScreen.matches ? 4 : 7) : 3.5;
      for (const node of nodes) {
        ctx.globalAlpha = active
          ? 0.66 + 0.2 * Math.sin(time / 560 + node.phase)
          : 0.48 + 0.17 * Math.sin(time / 1250 + node.phase);
        const radius = active ? 3.2 : 2.7;
        const pulse = 0.35 * (1 + Math.sin(time / (active ? 390 : 850) + node.phase));
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // A restrained click/touch ripple fades away without capturing the interaction.
      if (ripple.active) {
        const age = time - ripple.startedAt;
        if (age >= 1050) {
          ripple.active = false;
        } else {
          ctx.globalAlpha = (1 - age / 1050) * 0.42;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(ripple.x, ripple.y, 12 + (age / 1050) * 115, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      if (running && !document.hidden) raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("blur", onBlur);
    window.addEventListener(ACTIVITY_EVENT, onActivity);
    document.addEventListener("visibilitychange", onVisibilityChange);
    start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener(ACTIVITY_EVENT, onActivity);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
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
