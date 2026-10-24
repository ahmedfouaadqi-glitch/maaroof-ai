// Cinematic SVG globe: real land masses, atmospheric halo, specular highlight,
// twinkling starfield, day/night terminator, animated connection arcs.
// All colors driven by semantic tokens (primary/accent/background/foreground).
import { useEffect, useMemo, useRef, useState } from "react";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import { COUNTRY_COORDS, lonLatToOrtho } from "./country-coords";

type Props = {
  highlightCountry?: string;
  activeCountries?: string[];
  worldMode?: boolean;
  size?: number;
  onPickCountry?: (code: string) => void;
};

// ---------- TopoJSON → GeoJSON (once) ----------
const WORLD: any = feature(worldTopo as any, (worldTopo as any).objects.countries);
const LAND_POLYS: number[][][][] = (() => {
  const out: number[][][][] = [];
  for (const f of WORLD.features as any[]) {
    const g = f.geometry;
    if (!g) continue;
    if (g.type === "Polygon") out.push(g.coordinates);
    else if (g.type === "MultiPolygon") for (const p of g.coordinates) out.push(p);
  }
  return out;
})();

// ---------- Orthographic projection ----------
function project(lon: number, lat: number, rotX: number, rotY: number, R: number, cx: number, cy: number) {
  const λ = ((lon + rotX) * Math.PI) / 180;
  const φ = (lat * Math.PI) / 180;
  const φ0 = (rotY * Math.PI) / 180;
  const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(λ);
  if (cosc < 0) return null; // back side
  const x = cx + R * Math.cos(φ) * Math.sin(λ);
  const y = cy - R * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(λ));
  return { x, y };
}

function ringToPath(ring: number[][], rot: number, R: number, cx: number, cy: number): string {
  let d = "";
  let prevVisible = false;
  let started = false;
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i];
    const p = project(lon, lat, rot, 0, R, cx, cy);
    if (!p) { prevVisible = false; continue; }
    if (!prevVisible || !started) { d += `M${p.x.toFixed(1)},${p.y.toFixed(1)}`; started = true; }
    else d += `L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    prevVisible = true;
  }
  return d;
}

// stable star seeds
function seededStars(n: number, size: number) {
  const stars: { x: number; y: number; r: number; o: number; dur: number }[] = [];
  let s = 1337;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < n; i++) {
    stars.push({
      x: rnd() * size,
      y: rnd() * size,
      r: rnd() * 0.9 + 0.2,
      o: rnd() * 0.6 + 0.2,
      dur: rnd() * 4 + 2,
    });
  }
  return stars;
}

export function MaaroofGlobe({ highlightCountry, activeCountries = [], worldMode, size = 340, onPickCountry }: Props) {
  const [rot, setRot] = useState(0);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last; last = t;
      setRot((r) => (r + dt * 0.012) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cx = size / 2, cy = size / 2, R = size / 2 - 14;
  const stars = useMemo(() => seededStars(70, size), [size]);

  // Re-render land paths every ~2° for perf
  const rotSnap = Math.round(rot / 2) * 2;
  const landPaths = useMemo(() => {
    return LAND_POLYS.map((poly) => poly.map((ring) => ringToPath(ring, rotSnap, R, cx, cy)).filter(Boolean).join(" "));
  }, [rotSnap, R, cx, cy]);

  // Active country screen positions
  const countryPos = (code: string) => {
    const c = COUNTRY_COORDS[code];
    if (!c) return null;
    return project(c[1], c[0], rotSnap, 0, R, cx, cy);
  };
  const hi = highlightCountry ? countryPos(highlightCountry) : null;
  const actives = activeCountries.map((c) => ({ code: c, pos: countryPos(c) })).filter((x) => x.pos);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="block mx-auto select-none" role="img" aria-label="globe">
      <defs>
        {/* Outer atmosphere glow */}
        <radialGradient id="m-atmo" cx="50%" cy="50%" r="50%">
          <stop offset="80%" stopColor="hsl(var(--primary) / 0)" />
          <stop offset="92%" stopColor="hsl(var(--primary) / 0.45)" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
        </radialGradient>
        {/* Ocean sphere with directional lighting */}
        <radialGradient id="m-ocean" cx="32%" cy="28%" r="78%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.55)" />
          <stop offset="35%" stopColor="hsl(var(--primary) / 0.28)" />
          <stop offset="70%" stopColor="hsl(var(--primary) / 0.12)" />
          <stop offset="100%" stopColor="hsl(var(--background))" />
        </radialGradient>
        {/* Specular highlight */}
        <radialGradient id="m-spec" cx="30%" cy="22%" r="35%">
          <stop offset="0%" stopColor="hsl(var(--foreground) / 0.18)" />
          <stop offset="100%" stopColor="hsl(var(--foreground) / 0)" />
        </radialGradient>
        {/* Dark side */}
        <radialGradient id="m-night" cx="78%" cy="78%" r="55%">
          <stop offset="0%" stopColor="hsl(var(--background) / 0.55)" />
          <stop offset="100%" stopColor="hsl(var(--background) / 0)" />
        </radialGradient>
        {/* Land fills */}
        <radialGradient id="m-land" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="hsl(var(--primary) / 0.85)" />
          <stop offset="60%" stopColor="hsl(var(--primary) / 0.55)" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0.30)" />
        </radialGradient>
        <filter id="m-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="m-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
        {/* Sphere clip */}
        <clipPath id="m-clip"><circle cx={cx} cy={cy} r={R} /></clipPath>
      </defs>

      {/* Starfield */}
      <g opacity={0.85}>
        {stars.map((st, i) => (
          <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="hsl(var(--foreground))" opacity={st.o}>
            {!reduce.current && (
              <animate attributeName="opacity" values={`${st.o};${st.o * 0.2};${st.o}`} dur={`${st.dur}s`} repeatCount="indefinite" />
            )}
          </circle>
        ))}
      </g>

      {/* Outer atmosphere ring */}
      <circle cx={cx} cy={cy} r={R + 10} fill="url(#m-atmo)" />

      {/* Ocean sphere */}
      <circle cx={cx} cy={cy} r={R} fill="url(#m-ocean)" />

      {/* Graticule (very subtle) */}
      <g clipPath="url(#m-clip)" opacity={0.18} stroke="hsl(var(--primary) / 0.5)" fill="none" strokeWidth={0.4}>
        {Array.from({ length: 12 }, (_, i) => {
          const ry = R * Math.abs(Math.cos(((i * 15 - rot) * Math.PI) / 180));
          return <ellipse key={`m${i}`} cx={cx} cy={cy} rx={ry} ry={R} />;
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const lat = (i - 3) * 22.5;
          const φ = (lat * Math.PI) / 180;
          const ry = R * Math.cos(φ);
          const dy = -R * Math.sin(φ);
          return <ellipse key={`p${i}`} cx={cx} cy={cy + dy} rx={ry} ry={Math.max(0.5, ry * 0.05)} />;
        })}
      </g>

      {/* Land masses */}
      <g clipPath="url(#m-clip)">
        {landPaths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="url(#m-land)"
            stroke="hsl(var(--primary) / 0.85)"
            strokeWidth={0.45}
            strokeLinejoin="round"
            opacity={worldMode ? 0.95 : 0.82}
          />
        ))}
      </g>

      {/* Night side shadow */}
      <circle cx={cx} cy={cy} r={R} fill="url(#m-night)" pointerEvents="none" />
      {/* Specular highlight */}
      <circle cx={cx} cy={cy} r={R} fill="url(#m-spec)" pointerEvents="none" />

      {/* Rim */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="hsl(var(--primary) / 0.5)" strokeWidth={1} />

      {/* Connection arcs from highlight → actives */}
      {hi && actives.length > 1 && (
        <g fill="none" stroke="hsl(var(--accent))" strokeWidth={1.1} opacity={0.7} filter="url(#m-soft)">
          {actives.map((a, i) => {
            if (!a.pos || a.code === highlightCountry) return null;
            const mx = (hi.x + a.pos.x) / 2;
            const my = (hi.y + a.pos.y) / 2 - Math.hypot(hi.x - a.pos.x, hi.y - a.pos.y) * 0.35;
            const len = 200;
            return (
              <path key={i} d={`M${hi.x},${hi.y} Q${mx},${my} ${a.pos.x},${a.pos.y}`} strokeDasharray={len} strokeDashoffset={len}>
                {!reduce.current && (
                  <animate attributeName="stroke-dashoffset" from={len} to={0} dur="1.8s" repeatCount="indefinite" />
                )}
              </path>
            );
          })}
        </g>
      )}

      {/* Country pins */}
      {actives.map((a) => {
        if (!a.pos) return null;
        const isHi = a.code === highlightCountry;
        const fill = isHi ? "hsl(var(--primary))" : "hsl(var(--accent))";
        const r = isHi ? 4.5 : 3;
        return (
          <g key={`pin-${a.code}`} className={onPickCountry ? "cursor-pointer" : undefined} onClick={() => onPickCountry?.(a.code)}>
            <circle cx={a.pos.x} cy={a.pos.y} r={r * 2.4} fill={fill} opacity={0.22}>
              {!reduce.current && <animate attributeName="r" values={`${r * 2};${r * 3.4};${r * 2}`} dur="2.2s" repeatCount="indefinite" />}
            </circle>
            <circle cx={a.pos.x} cy={a.pos.y} r={r} fill={fill} filter="url(#m-glow)" />
          </g>
        );
      })}

      {/* Hi-light: extra big pulse + label card */}
      {hi && highlightCountry && (
        <g>
          <circle cx={hi.x} cy={hi.y} r={10} fill="hsl(var(--primary))" opacity={0.18}>
            {!reduce.current && <animate attributeName="r" values="8;18;8" dur="2.4s" repeatCount="indefinite" />}
          </circle>
          <circle cx={hi.x} cy={hi.y} r={5} fill="hsl(var(--primary))" filter="url(#m-glow)" />
          {/* Floating label */}
          <g transform={`translate(${Math.min(size - 60, Math.max(30, hi.x))}, ${Math.max(18, hi.y - 14)})`}>
            <rect x={-22} y={-14} rx={6} ry={6} width={44} height={18} fill="hsl(var(--background) / 0.85)" stroke="hsl(var(--primary) / 0.6)" />
            <text x={0} y={-1} textAnchor="middle" className="fill-foreground" style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
              {highlightCountry}
            </text>
          </g>
        </g>
      )}

      {/* Bottom caption */}
      <text x={cx} y={size - 4} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, letterSpacing: 1.5 }}>
        {worldMode ? "GLOBAL SCOPE" : highlightCountry ? `FOCUS · ${highlightCountry}` : "AWAITING SCOPE"}
      </text>
    </svg>
  );
}
