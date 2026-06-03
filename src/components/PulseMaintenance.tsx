import { Link } from "@tanstack/react-router";
import maaroofMark from "@/assets/maaroof-ai-mark.png";
import { HexBadge } from "@/components/HexBadge";
import { Wrench, ArrowLeft } from "lucide-react";

export function PulseMaintenance() {
  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background text-foreground"
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 -z-0"
        style={{ background: "var(--gradient-hero)", opacity: 0.35 }}
      />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-0 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />

      <main className="relative z-10 mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
        {/* Animated logo */}
        <div className="relative mb-8">
          <div className="absolute inset-0 -m-6 rounded-full bg-gradient-to-tr from-primary/40 via-accent/30 to-primary/40 blur-2xl animate-pulse" style={{ animationDuration: "3s" }} />
          <div className="animate-[float_4s_ease-in-out_infinite]">
            <HexBadge size={160} className="drop-shadow-[0_8px_32px_oklch(0.70_0.13_218/0.55)]">
              <img
                src={maaroofMark}
                alt="MAAROOF Ai"
                className="size-[86%] object-contain animate-pulse"
                style={{ animationDuration: "2.5s" }}
              />
            </HexBadge>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
          <Wrench className="size-3.5 animate-pulse" />
          <span>تحت الصيانة</span>
        </div>

        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          نبض موقوف مؤقتاً
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          نظام نبض متوقف بالكامل حالياً. تم إيقاف جميع عمليات الكشط والاتصالات السابقة.
          سنعود قريباً بنسخة محسّنة.
        </p>

        <Link
          to="/dashboard"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-105"
        >
          <ArrowLeft className="size-4" />
          العودة إلى لوحة التحكم
        </Link>
      </main>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
      `}</style>
    </div>
  );
}
