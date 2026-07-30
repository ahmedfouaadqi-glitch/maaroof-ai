import { useEffect, useState } from "react";
import Lightfall from "./Lightfall";

/**
 * Site-wide ambient background.
 * Fixed behind all content, never interactive, tuned for readability.
 */
export default function SiteBackground() {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    setMounted(true);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smallQuery = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const sync = () => {
      setReduced(motionQuery.matches);
      setCompact(smallQuery.matches);
    };
    sync();
    motionQuery.addEventListener("change", sync);
    smallQuery.addEventListener("change", sync);
    return () => {
      motionQuery.removeEventListener("change", sync);
      smallQuery.removeEventListener("change", sync);
    };
  }, []);

  const staticFallback = (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundColor: "var(--background)",
        backgroundImage:
          "radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, var(--primary) 20%, transparent) 0%, transparent 62%), radial-gradient(90% 60% at 85% 100%, color-mix(in oklab, var(--accent) 16%, transparent) 0%, transparent 68%), radial-gradient(80% 55% at 10% 55%, color-mix(in oklab, var(--primary) 12%, transparent) 0%, transparent 70%)",
      }}
    />
  );

  if (!mounted || reduced) return staticFallback;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {staticFallback}
      <Lightfall
        className="absolute inset-0"
        colors={["#8FB7FF", "#5A4BFF", "#7DE2FF"]}
        backgroundColor="#101A3F"
        speed={0.4}
        streakCount={compact ? 1 : 2}
        streakWidth={1}
        streakLength={1.2}
        glow={0.9}
        density={0.55}
        twinkle={0.8}
        zoom={3.2}
        backgroundGlow={0.35}
        opacity={compact ? 0.35 : 0.5}
        mouseInteraction={!compact}
        mouseStrength={0.4}
        mouseRadius={0.9}
        dpr={compact ? 1 : Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)}
        mixBlendMode="screen"
      />
    </div>
  );
}
