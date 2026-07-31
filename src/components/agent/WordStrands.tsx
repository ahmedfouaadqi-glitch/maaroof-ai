// WordStrands — canvas-2D particle strands whose motion traces the word "معروف".
// Drifts while idle, converges into the glyphs while the agent thinks/executes.
import { useEffect, useRef } from "react";

type Props = {
  word?: string;
  colors: string[];
  /** 0 = free drift, 1 = fully formed word. */
  progress: number;
  /** Motion speed multiplier. */
  speed: number;
  /** Glow strength (px blur). */
  glow: number;
  /** Number of flowing strands drawn over the point cloud. */
  strandCount: number;
  animate: boolean;
  className?: string;
};

type P = { x: number; y: number; vx: number; vy: number; tx: number; ty: number; c: string; r: number; ph: number };

export function WordStrands({
  word = "معروف",
  colors,
  progress,
  speed,
  glow,
  strandCount,
  animate,
  className = "",
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ progress, speed, glow, strandCount, animate, colors, word });
  stateRef.current = { progress, speed, glow, strandCount, animate, colors, word };

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let visible = true;
    let particles: P[] = [];
    let targets: Array<{ x: number; y: number }> = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let fontSize = 140;

    /** Rasterize the word offscreen and sample its pixels into target points. */
    function sample() {
      const st = stateRef.current;
      const off = document.createElement("canvas");
      off.width = Math.max(1, Math.floor(w));
      off.height = Math.max(1, Math.floor(h));
      const octx = off.getContext("2d");
      if (!octx) return;
      const size = Math.min(h * 0.62, w * 0.32);
      fontSize = size;
      octx.fillStyle = "#fff";
      octx.textAlign = "center";
      octx.textBaseline = "middle";
      octx.direction = "rtl";
      octx.font = `700 ${size}px "Cairo","Tajawal","Noto Sans Arabic",system-ui,sans-serif`;
      octx.fillText(st.word, off.width / 2, off.height / 2);

      const img = octx.getImageData(0, 0, off.width, off.height).data;
      const step = Math.max(2, Math.round(size / 45));
      const pts: Array<{ x: number; y: number }> = [];
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          if (img[(y * off.width + x) * 4 + 3] > 128) pts.push({ x, y });
        }
      }
      targets = pts;
      buildParticles();
    }

    function buildParticles() {
      const st = stateRef.current;
      const n = targets.length;
      const next: P[] = [];
      for (let i = 0; i < n; i++) {
        const t = targets[i];
        const prev = particles[i];
        next.push(
          prev
            ? { ...prev, tx: t.x, ty: t.y }
            : {
                x: t.x + (Math.random() - 0.5) * 45 * (fontSize / 140),
                y: t.y + (Math.random() - 0.5) * 45 * (fontSize / 140),
                vx: 0,
                vy: 0,
                tx: t.x,
                ty: t.y,
                c: st.colors[i % st.colors.length] || "#7C3AED",
                r: 1 + Math.random() * 1.1,
                ph: Math.random() * Math.PI * 2,
              },
        );
      }
      particles = next;
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = host!.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      sample();
    }

    let time = 0;
    function frame() {
      const st = stateRef.current;
      raf = requestAnimationFrame(frame);
      if (!visible || !st.animate) return;
      time += 0.016 * (0.4 + st.speed);


      ctx!.clearRect(0, 0, w, h);
      const pull = 0.03 + st.progress * 0.09;
      const drift = ((1 - st.progress) * 26 + 1.2) * (fontSize / 140);

      ctx!.globalCompositeOperation = "lighter";
      ctx!.shadowBlur = st.glow * 1.2;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const nx = Math.sin(time * 0.9 + p.ph) * drift;
        const ny = Math.cos(time * 0.7 + p.ph * 1.7) * drift;
        p.vx += (p.tx + nx - p.x) * pull;
        p.vy += (p.ty + ny - p.y) * pull;
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx;
        p.y += p.vy;
      }

      // Batched fill: one path per color keeps large point clouds cheap.
      for (const color of st.colors) {
        ctx!.shadowColor = color;
        ctx!.fillStyle = color;
        ctx!.beginPath();
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          if (p.c !== color) continue;
          ctx!.moveTo(p.x + p.r, p.y);
          ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        }
        ctx!.fill();
      }


      // Flowing strands sewn through the point cloud.
      const strands = Math.max(0, Math.round(st.strandCount));
      if (particles.length > 8 && strands > 0) {
        ctx!.lineWidth = 1;
        for (let s = 0; s < strands; s++) {
          const color = st.colors[s % st.colors.length] || "#7C3AED";
          ctx!.strokeStyle = color;
          ctx!.shadowColor = color;
          ctx!.globalAlpha = 0.5;
          ctx!.beginPath();
          const span = 42;
          const head = Math.floor(((time * 18 * (1 + s * 0.2)) % particles.length));
          for (let k = 0; k < span; k++) {
            const p = particles[(head + k * 3) % particles.length];
            if (k === 0) ctx!.moveTo(p.x, p.y);
            else ctx!.lineTo(p.x, p.y);
          }
          ctx!.stroke();
        }
        ctx!.globalAlpha = 1;
      }

      ctx!.shadowBlur = 0;
      ctx!.globalCompositeOperation = "source-over";
    }

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; }, { threshold: 0 });
    io.observe(host);

    resize();
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [word]);

  // Re-sample colors when the palette changes (cheap: reassign per particle on next build).
  return (
    <div ref={hostRef} className={`w-full h-full ${className}`} aria-hidden>
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
}

export default WordStrands;
