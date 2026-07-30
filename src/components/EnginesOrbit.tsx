import { Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useI18n } from "@/lib/i18n";
import { useVisibility } from "@/lib/visibility";
import morphMp4 from "@/assets/engines-morph.mp4.asset.json";
import morphWebm from "@/assets/engines-morph.webm.asset.json";
import morphPoster from "@/assets/engines-morph-poster.jpg.asset.json";


/**
 * Hero motion piece:
 * - The nine AI engine marks morph into one another on a continuous loop
 * - Replaces the previous SVG orbit while keeping the same slot, copy and CTAs
 */
export function EnginesOrbit() {
  const { t } = useI18n();
  const vis = useVisibility();

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

        {/* Engines morph loop */}
        <div className="relative mx-auto mt-12 grid place-items-center">
          <div className="relative overflow-hidden rounded-[2rem] border border-primary/25 bg-card/40 shadow-[var(--shadow-elevated)] backdrop-blur">
            <div aria-hidden className="pointer-events-none absolute -inset-6 -z-10 bg-gradient-to-br from-primary/25 to-accent/25 blur-2xl" />
            <video
              className="block h-[380px] w-auto max-w-full object-contain motion-reduce:hidden md:h-[420px]"
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              poster={morphPoster.url}
              aria-hidden
            >
              <source src={morphWebm.url} type="video/webm" />
              <source src={morphMp4.url} type="video/mp4" />
            </video>
            <img
              src={morphPoster.url}
              alt=""
              aria-hidden
              className="hidden h-[380px] w-auto max-w-full object-contain motion-reduce:block md:h-[420px]"
            />
          </div>
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
