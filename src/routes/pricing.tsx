import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/whatsapp";
import { Check, MessageCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <PricingPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

function PricingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("subscription_plans").select("*").eq("active", true).order("sort_order")
      .then(({ data }) => setPlans(data || []));
  }, []);

  const subscribe = async (plan: any) => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: "/pricing" } });
      return;
    }
    await supabase.from("subscription_requests").insert({
      user_id: user.id,
      plan_id: plan.id,
      status: "pending",
      whatsapp_contacted_at: new Date().toISOString(),
    });
    const msg = `${t("whatsapp_msg")}${plan.name} (${plan.price_iqd} ${t("pricing_iqd")})`;
    window.open(whatsappLink(msg), "_blank");
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-4xl font-bold text-gradient md:text-5xl">{t("pricing_title")}</h1>
          <p className="mt-3 text-muted-foreground">{t("pricing_sub")}</p>
        </div>

        {plans.length === 0 ? (
          <div className="mt-12 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((p, i) => (
              <div
                key={p.id}
                className={`relative rounded-2xl border p-6 backdrop-blur ${
                  i === 1
                    ? "border-primary/60 bg-card shadow-[var(--shadow-glow)]"
                    : "border-border bg-card/70"
                }`}
              >
                {i === 1 && (
                  <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-semibold text-primary-foreground">
                    ★
                  </span>
                )}
                <h3 className="font-display text-xl font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold text-gradient">
                    {p.price_iqd === 0 ? t("pricing_free") : p.price_iqd.toLocaleString()}
                  </span>
                  {p.price_iqd > 0 && <span className="text-sm text-muted-foreground">{t("pricing_iqd")}</span>}
                </div>
                {p.price_iqd > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {t("pricing_per").replace("{days}", String(p.duration_days))}
                  </div>
                )}
                <ul className="mt-5 space-y-2 text-sm">
                  {(p.features as string[]).map((f, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.price_iqd > 0 && (
                  <button
                    onClick={() => subscribe(p)}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-success to-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition hover:scale-[1.02]"
                  >
                    <MessageCircle className="size-4" />
                    {user ? t("pricing_subscribe") : t("pricing_login_required")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link>
        </div>
      </div>
    </div>
  );
}
