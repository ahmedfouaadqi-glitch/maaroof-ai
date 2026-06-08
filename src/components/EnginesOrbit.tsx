import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import maaroofMark from "@/assets/maaroof-ai-mark.png";

import { useI18n } from "@/lib/i18n";
import { useVisibility } from "@/lib/visibility";
import { ENGINES } from "./engine-logos";


/**
 * Hero orbit animation:
 * - 9 AI engines orbit a central brand logo
 * - Animated beams converge toward the brand → conveys "AI engines cite YOU"
 * - Tagline reinforces: smart idea = simplicity
 */
export function EnginesOrbit() {
  const { t } = useI18n();
  const vis = useVisibility();
  const radius = 140; // px in viewBox space
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;

  if (!vis.loading && !vis.isWidgetVisible("engines_orbit")) return null;

  return (
    <section id="orbit" className="relative border-t border-border/60 py-20 overflow-hidden">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-[320px] rounded-full bg-accent/10 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
      </div>

      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <Sparkles className="size-3 animate-pulse" /> {t("orbit_badge")}
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold md:text-5xl">
            <span className="text-gradient">{t("orbit_title")}</span>
          </h2>
          <p className="mt-3 text-muted-foreground">{t("orbit_sub")}</p>
        </div>

        {/* Orbit canvas */}
        <div className="relative mx-auto mt-12 grid place-items-center" style={{ width: size, height: size, maxWidth: "100%" }}>
          <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full" aria-hidden>
            <defs>
              <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
                <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
              </radialGradient>
              <linearGradient id="beamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.95" />
              </linearGradient>
            </defs>

            {/* orbit rings */}
            <circle cx={cx} cy={cy} r={radius} fill="none" stroke="hsl(var(--border))" strokeOpacity="0.5" strokeDasharray="3 6" />
            <circle cx={cx} cy={cy} r={radius - 28} fill="none" stroke="hsl(var(--border))" strokeOpacity="0.25" />
            <circle cx={cx} cy={cy} r={radius + 24} fill="none" stroke="url(#ringGlow)" strokeWidth="1.5" />

            {/* beams pointing inward */}
            <g className="orbit-beams">
              {ENGINES.map((_, i) => {
                const angle = (i / ENGINES.length) * Math.PI * 2 - Math.PI / 2;
                const x = cx + Math.cos(angle) * (radius - 6);
                const y = cy + Math.sin(angle) * (radius - 6);
                return (
                  <line
                    key={i}
                    x1={x}
                    y1={y}
                    x2={cx}
                    y2={cy}
                    stroke="url(#beamGrad)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    style={{ animationDelay: `${i * 0.25}s` }}
                  />
                );
              })}
            </g>
          </svg>

          {/* Rotating orbit layer with engine chips (counter-rotates so labels stay upright) */}
          <div className="absolute inset-0 orbit-spin">
            {ENGINES.map((e, i) => {
              const angle = (i / ENGINES.length) * 360 - 90;
              return (
                <div
                  key={e.name}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: `rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg) translate(-50%, -50%)`,
                  }}
                >
                  <div className="orbit-spin-reverse group flex flex-col items-center">
                    <div className="relative size-14">
                      <div aria-hidden className="absolute inset-0 clip-hex bg-gradient-to-br from-[var(--cyber)]/70 via-primary/40 to-[var(--accent)]/70" />
                      <div className="absolute inset-[2px] clip-hex grid place-items-center bg-background/90 backdrop-blur transition group-hover:bg-background">
                        <e.Logo size={28} />
                      </div>
                    </div>
                    <div className="mt-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-foreground/90 backdrop-blur">
                      {e.name}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Central brand core */}
          <div className="relative z-10 grid place-items-center">
            {/* radar waves */}
            <div className="pointer-events-none absolute inset-0 -m-2 clip-hex border border-primary/40 radar-ping" />
            <div className="pointer-events-none absolute inset-0 -m-2 clip-hex border border-accent/40 radar-ping radar-ping-delay" />
            {/* soft halo */}
            <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 blur-2xl animate-pulse" style={{ animationDuration: "3s" }} />
            {/* rotating conic shimmer */}
            <div className="absolute inset-0 -m-4 rounded-full logo-conic opacity-70" />
            {/* logo container — hexagon */}
            <div className="relative size-28 md:size-32 logo-float">
              <div aria-hidden className="absolute inset-0 clip-hex bg-gradient-to-br from-[var(--cyber)] via-primary/70 to-[var(--accent)] logo-glow" />
              <div className="absolute inset-[3px] clip-hex grid place-items-center bg-background/90 backdrop-blur-sm overflow-hidden">
                <img
                  src={maaroofMark}
                  alt="MAAROOF Ai"
                  className="size-[88%] object-contain drop-shadow-[0_4px_18px_oklch(0.70_0.13_218/0.55)]"
                />
              </div>
              <span className="absolute left-1/2 -translate-x-1/2 -bottom-7 whitespace-nowrap rounded-full border border-primary/40 bg-background/90 px-3 py-1 text-[11px] font-bold text-foreground backdrop-blur">
                {t("brand")}
              </span>
            </div>
          </div>


        </div>

        {/* Tagline */}
        <div className="mx-auto mt-16 max-w-2xl text-center">
          <p className="font-display text-lg font-semibold md:text-xl">
            <span className="text-gradient">{t("orbit_tagline")}</span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{t("orbit_tagline_sub")}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/guide"
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/60 px-5 py-2.5 text-xs font-semibold text-foreground hover:border-primary/60"
            >
              {t("orbit_cta_guide")}
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-glow)] hover:scale-[1.03] transition"
            >
              {t("orbit_cta_pricing")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
