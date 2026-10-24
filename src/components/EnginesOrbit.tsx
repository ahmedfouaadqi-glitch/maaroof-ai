import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";
import { useVisibility } from "@/lib/visibility";
import { ENGINES } from "@/components/engine-logos";
import { HexBadge } from "@/components/HexBadge";
import OrbitImages from "@/components/orbit/OrbitImages";

/** `true` when the visitor asked the OS to reduce motion. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/**
 * Hero motion piece:
 * - The nine AI engine marks orbit an elliptical path around the MAAROOF hexagon
 * - Uses the React Bits `OrbitImages` motion component in the same hero slot
 */
export function EnginesOrbit() {
  const { t } = useI18n();
  const vis = useVisibility();
  const reduced = usePrefersReducedMotion();

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

        {/* Nine engines orbiting the MAAROOF hexagon */}
        <div className="relative mx-auto mt-12 grid w-full max-w-[420px] place-items-center">
          <OrbitImages
            responsive
            baseWidth={1000}
            shape="ellipse"
            radiusX={410}
            radiusY={330}
            rotation={-8}
            duration={38}
            itemSize={120}
            paused={reduced}
            centerContent={
              <HexBadge size={96}>
                <span className="font-display text-sm font-bold text-gradient">MAAROOF</span>
              </HexBadge>
            }
            items={ENGINES.map((e) => (
              <div
                key={e.key}
                className="grid size-full place-items-center rounded-full border border-border bg-card/80 shadow-[var(--shadow-elevated)] backdrop-blur"
              >
                <e.Logo size={68} />
              </div>
            ))}
          />
          <span className="sr-only">{t("orbit_sub")}</span>
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
