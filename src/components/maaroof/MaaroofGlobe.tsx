import { useEffect, useRef, useState } from "react";
import { COUNTRY_COORDS, lonLatToOrtho } from "./country-coords";

type Props = {
  highlightCountry?: string;       // glowing
  activeCountries?: string[];      // smaller pulses
  worldMode?: boolean;             // pulse everything softly
  size?: number;
  onPickCountry?: (code: string) => void;
};

export function MaaroofGlobe({ highlightCountry, activeCountries = [], worldMode, size = 320, onPickCountry }: Props) {
  const [rot, setRot] = useState(0);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last; last = t;
      setRot((r) => (r + dt * 0.015) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cx = size / 2, cy = size / 2, R = size / 2 - 6;
  const codes = Object.keys(COUNTRY_COORDS);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="block mx-auto" role="img" aria-label="globe">
      <defs>
        <radialGradient id="m-globe-bg" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.35)" />
          <stop offset="55%" stopColor="hsl(var(--primary) / 0.10)" />
          <stop offset="100%" stopColor="hsl(var(--background) / 0)" />
        </radialGradient>
        <radialGradient id="m-globe-sphere" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="hsl(220 40% 18%)" />
          <stop offset="100%" stopColor="hsl(220 60% 6%)" />
        </radialGradient>
        <filter id="m-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Outer halo */}
      <circle cx={cx} cy={cy} r={R + 4} fill="url(#m-globe-bg)" />
      {/* Sphere */}
      <circle cx={cx} cy={cy} r={R} fill="url(#m-globe-sphere)" stroke="hsl(var(--primary) / 0.3)" strokeWidth={1} />

      {/* Meridians */}
      {Array.from({ length: 9 }, (_, i) => {
        const ry = R * Math.abs(Math.cos(((i * 20 - rot) * Math.PI) / 180));
        return <ellipse key={i} cx={cx} cy={cy} rx={ry} ry={R} fill="none" stroke="hsl(var(--primary) / 0.08)" strokeWidth={0.6} />;
      })}
      {/* Parallels */}
      {Array.from({ length: 6 }, (_, i) => {
        const lat = (i - 2.5) * 25;
        const φ = (lat * Math.PI) / 180;
        const ry = R * Math.cos(φ);
        const dy = -R * Math.sin(φ);
        return <ellipse key={`p${i}`} cx={cx} cy={cy + dy} rx={ry} ry={ry * 0.18} fill="none" stroke="hsl(var(--primary) / 0.08)" strokeWidth={0.5} />;
      })}

      {/* Country dots */}
      {codes.map((code) => {
        const [lat, lon] = COUNTRY_COORDS[code];
        const p = lonLatToOrtho(lon, lat, rot, R, cx, cy);
        if (!p.visible) return null;
        const isHi = code === highlightCountry;
        const isActive = activeCountries.includes(code);
        const op = isHi ? 1 : isActive ? 0.85 : worldMode ? 0.45 : 0.18;
        const r = isHi ? 5.5 : isActive ? 3.5 : 2;
        const fill = isHi || isActive ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)";
        return (
          <g key={code} className={onPickCountry ? "cursor-pointer" : undefined} onClick={() => onPickCountry?.(code)}>
            {(isHi || isActive) && (
              <circle cx={p.x} cy={p.y} r={r * 2.6} fill={fill} opacity={0.18}>
                <animate attributeName="r" values={`${r * 2};${r * 3.5};${r * 2}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.25;0.05;0.25" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={p.x} cy={p.y} r={r} fill={fill} opacity={op} filter={isHi ? "url(#m-glow)" : undefined}>
              <title>{code}</title>
            </circle>
          </g>
        );
      })}

      {/* Highlight label */}
      {highlightCountry && (
        <text x={cx} y={size - 8} textAnchor="middle" className="fill-primary" style={{ fontSize: 11, fontWeight: 600 }}>
          ◉ {highlightCountry}
        </text>
      )}
    </svg>
  );
}
