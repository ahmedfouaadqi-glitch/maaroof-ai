// AgentPulse — Strands ribbon driven by the agent's live state.
// Moves while the agent thinks / executes / the user types; stills when results land.
import { useEffect, useMemo, useRef, useState } from "react";
import Strands from "./Strands";
import WordStrands from "./WordStrands";

export type PulseEvent = { type: string; data: any; t: number };

type Props = {
  /** Live agent stream events (maaroof stage). Optional. */
  events?: PulseEvent[];
  /** Agent is executing. */
  running?: boolean;
  /** User is typing into the prompt field. */
  typing?: boolean;
  /** Final answer is on screen — force stillness. */
  settled?: boolean;
  className?: string;
  height?: number;
  /** "ribbon" = flowing strands band · "word" = strands that trace the word معروف. */
  variant?: "ribbon" | "word";
  /** Word traced by the "word" variant. */
  word?: string;
};

type Mode = "idle" | "typing" | "thinking" | "executing";

/** Resolve a CSS custom property (oklch/hsl/etc.) to an rgb() string ogl can parse. */
function resolveToken(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const probe = document.createElement("span");
  probe.style.color = raw;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return fallback;
  const hex = (n: string) => Math.round(Number(n)).toString(16).padStart(2, "0");
  return `#${hex(m[0])}${hex(m[1])}${hex(m[2])}`;
}

const MODE_CONF: Record<Mode, { speed: number; intensity: number; glow: number; amplitude: number; opacity: number }> = {
  idle: { speed: 0.12, intensity: 0.25, glow: 1.6, amplitude: 0.5, opacity: 0 },
  typing: { speed: 0.28, intensity: 0.4, glow: 2.0, amplitude: 0.7, opacity: 0.55 },
  thinking: { speed: 0.6, intensity: 0.6, glow: 2.4, amplitude: 1, opacity: 0.85 },
  executing: { speed: 1.15, intensity: 0.85, glow: 3.0, amplitude: 1.25, opacity: 1 },
};

export function AgentPulse({ events = [], running = false, typing = false, settled = false, className = "", height = 64, variant = "ribbon", word = "معروف" }: Props) {
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [palette, setPalette] = useState<string[]>(["#7C3AED", "#06B6D4", "#F97316"]);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stopped, setStopped] = useState(true);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    setPalette([
      resolveToken("--primary", "#7C3AED"),
      resolveToken("--accent", "#06B6D4"),
      resolveToken("--ring", "#F97316"),
    ]);
    return () => mq.removeEventListener("change", on);
  }, []);

  /** Active sub-agents = tool calls still awaiting a result. */
  const activeSubAgents = useMemo(() => {
    const done = new Set<number>();
    let calls = 0;
    for (const e of events) {
      if (e.type === "tool_call") calls++;
      if (e.type === "tool_result" && typeof e.data?.index === "number") done.add(e.data.index);
    }
    return Math.max(0, calls - done.size);
  }, [events]);

  const hasFinal = useMemo(() => events.some((e) => e.type === "final"), [events]);

  const mode: Mode = useMemo(() => {
    if (running) return activeSubAgents > 0 ? "executing" : "thinking";
    if (settled || hasFinal) return "idle";
    if (typing) return "typing";
    return "idle";
  }, [running, activeSubAgents, settled, hasFinal, typing]);

  const conf = MODE_CONF[mode];

  // Keep rendering for a short fade-out, then fully stop the WebGL loop.
  useEffect(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (mode === "idle") {
      idleTimer.current = setTimeout(() => setStopped(true), 700);
    } else {
      setStopped(false);
    }
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, [mode]);

  if (!mounted || reduced) return null;

  const strandCount = mode === "executing" ? Math.min(6, Math.max(2, activeSubAgents + 1)) : mode === "thinking" ? 3 : 2;

  if (variant === "word") {
    const done = settled || hasFinal;
    const progress = mode === "executing" ? 1 : mode === "thinking" ? 0.85 : mode === "typing" ? 0.8 : 0.7;
    const opacity = done ? 0 : mode === "idle" ? 0.72 : Math.max(0.9, conf.opacity);
    return (
      <div
        aria-hidden
        className={`pointer-events-none w-full transition-opacity duration-700 ${className}`}
        style={{ height, opacity }}
      >
        <WordStrands
          word={word}
          colors={palette}
          progress={progress}
          speed={conf.speed}
          glow={conf.glow}
          strandCount={mode === "idle" ? 0 : strandCount}
          animate={!done && (!stopped || mode === "idle")}
        />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      className={`pointer-events-none hidden sm:block w-full transition-opacity duration-700 ${className}`}
      style={{ height, opacity: conf.opacity }}
    >
      <Strands
        colors={palette}
        count={strandCount}
        speed={conf.speed}
        amplitude={conf.amplitude}
        waviness={1.1}
        thickness={0.6}
        glow={conf.glow}
        taper={3}
        spread={1}
        intensity={conf.intensity}
        saturation={1.35}
        opacity={1}
        scale={1.5}
        animate={!stopped}
      />
    </div>
  );
}

export default AgentPulse;
