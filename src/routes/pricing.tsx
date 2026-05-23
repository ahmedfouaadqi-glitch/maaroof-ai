import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n, PLAN_KEY_BY_NAME, ADDON_KEY_BY_NAME } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/whatsapp";
import { Check, MessageCircle, Mail, Loader2, X, Sparkles, Star, Bot, Zap } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing · GEO-Iraq" },
      { name: "description", content: "Plans and add-ons for GEO-Iraq — analyze, generate and publish AI-cited content. Starter, Pro, Business and Agent tiers." },
      { property: "og:title", content: "Pricing · GEO-Iraq" },
      { property: "og:description", content: "Plans and add-ons for GEO-Iraq — analyze, generate and publish AI-cited content." },
      { property: "og:url", content: "https://geoiraq.com/pricing" },
    ],
    links: [{ rel: "canonical", href: "https://geoiraq.com/pricing" }],
  }),
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <PricingPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

const SUPPORT_EMAIL = "ahmedfouaad.qi@gmail.com";

const EXAMPLE_KEYS: Record<string, { who: string; use: string }> = {
  Starter: { who: "ex_starter_who", use: "ex_starter_use" },
  Pro: { who: "ex_pro_who", use: "ex_pro_use" },
  Business: { who: "ex_business_who", use: "ex_business_use" },
  "Pro Yearly": { who: "ex_yearly_who", use: "ex_yearly_use" },
};

const AGENT_EXAMPLE_KEYS: Record<string, { who: string; use: string }> = {
  "Agent Lite": { who: "ex_alite_who", use: "ex_alite_use" },
  "Agent Pro": { who: "ex_apro_who", use: "ex_apro_use" },
  "Agent Business": { who: "ex_abiz_who", use: "ex_abiz_use" },
};

function PricingPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [selectedKind, setSelectedKind] = useState<"plan" | "agent">("plan");

  useEffect(() => {
    supabase.from("subscription_plans").select("*").eq("active", true).order("sort_order")
      .then(({ data }) => {
        const seen = new Set<string>();
        setPlans((data || []).filter((p: any) => seen.has(p.name) ? false : (seen.add(p.name), true)));
      });
    supabase.from("agent_addons").select("*").eq("active", true).order("sort_order")
      .then(({ data }) => {
        const seen = new Set<string>();
        setAddons((data || []).filter((a: any) => seen.has(a.name) ? false : (seen.add(a.name), true)));
      });
  }, []);

  const planDesc = (name: string) => {
    const k = PLAN_KEY_BY_NAME[name];
    return k ? t(`plan_${k}_desc` as any) : "";
  };
  const planFeatures = (name: string): string[] => {
    const k = PLAN_KEY_BY_NAME[name];
    const s = k ? t(`plan_${k}_features` as any) : "";
    return s ? s.split("|") : [];
  };
  const addonDesc = (name: string) => {
    const k = ADDON_KEY_BY_NAME[name];
    return k ? t(`addon_${k}_desc` as any) : "";
  };
  const addonFeatures = (name: string): string[] => {
    const k = ADDON_KEY_BY_NAME[name];
    const s = k ? t(`addon_${k}_features` as any) : "";
    return s ? s.split("|") : [];
  };

  const openSelect = (plan: any, kind: "plan" | "agent" = "plan") => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: "/pricing" } });
      return;
    }
    setSelected(plan);
    setSelectedKind(kind);
  };

  const sendWhatsapp = async () => {
    if (!selected || !user) return;
    const payload: any = {
      user_id: user.id, status: "pending",
      whatsapp_contacted_at: new Date().toISOString(),
      request_type: selectedKind,
    };
    if (selectedKind === "plan") payload.plan_id = selected.id;
    else payload.agent_addon_id = selected.id;
    await supabase.from("subscription_requests").insert(payload);
    const label = selectedKind === "agent" ? t("pr_label_agent") : t("pr_label_plan");
    const msg = `${label} ${selected.name} (${selected.price_iqd.toLocaleString()} ${t("pr_iqd")})\n${user.email}`;
    window.open(whatsappLink(msg), "_blank");
    setSelected(null);
  };

  const sendEmail = async () => {
    if (!selected || !user) return;
    const payload: any = { user_id: user.id, status: "pending", request_type: selectedKind };
    if (selectedKind === "plan") payload.plan_id = selected.id;
    else payload.agent_addon_id = selected.id;
    await supabase.from("subscription_requests").insert(payload);
    const label = selectedKind === "agent" ? t("pr_label_agent") : t("pr_label_plan");
    const subject = encodeURIComponent(`${label} ${selected.name}`);
    const body = encodeURIComponent(
      `${label}:\n• ${selected.name}\n• ${selected.price_iqd.toLocaleString()} ${t("pr_iqd")}\n\n${user.email}`,
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSelected(null);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> {t("pr_badge")}
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold text-gradient md:text-5xl">{t("pr_title")}</h1>
          <p className="mt-3 text-muted-foreground">
            {t("pr_intro_1")} <b>{t("pr_whatsapp")}</b> {t("pr_or")} <b>{t("pr_email_word")}</b> {t("pr_intro_2")}
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="mt-12 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const isPopular = p.name === "Pro";
              const isYearly = p.name === "Pro Yearly";
              const exKeys = EXAMPLE_KEYS[p.name];
              const exWho = exKeys ? t(exKeys.who as any) : "";
              const exUse = exKeys ? t(exKeys.use as any) : "";
              return (
                <div
                  key={p.id}
                  className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur transition ${
                    isPopular
                      ? "border-primary/60 bg-card shadow-[var(--shadow-glow)] scale-[1.02]"
                      : "border-border bg-card/70 hover:border-primary/40"
                  }`}
                >
                  {isPopular && (
                    <span className="absolute -top-3 start-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1 text-xs font-semibold text-primary-foreground">
                      <Star className="size-3" /> {t("pr_most_popular")}
                    </span>
                  )}
                  {isYearly && (
                    <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-success px-3 py-1 text-xs font-semibold text-primary-foreground">
                      {t("pr_save_50k")}
                    </span>
                  )}
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{planDesc(p.name) || p.description?.split("(")[0]}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-gradient">
                      {p.price_iqd.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("pr_iqd")}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.duration_days >= 365 ? t("pr_yearly_first") : t("pr_monthly")}
                  </div>

                  {exWho && (
                    <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
                      <div className="font-semibold text-foreground/90">{t("pr_suited_for")} {exWho}</div>
                      <div className="mt-1 text-muted-foreground">{exUse}</div>
                    </div>
                  )}

                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {(planFeatures(p.name).length ? planFeatures(p.name) : (p.features as string[])).slice(0, 5).map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => openSelect(p)}
                    className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02] ${
                      isPopular
                        ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-[var(--shadow-glow)]"
                        : "border border-primary/40 text-primary hover:bg-primary/10"
                    }`}
                  >
                    {user ? t("pr_choose_plan") : t("pr_signin_to_choose")}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Agent Add-on Section */}
        {addons.length > 0 && (
          <div className="mt-20">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-medium text-accent">
                <Bot className="size-3.5" /> {t("pr_optional_addon")}
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold text-gradient md:text-4xl">{t("pr_agent_title")}</h2>
              <p className="mt-3 text-muted-foreground">
                {t("pr_agent_intro")} <b>{t("pr_agent_added_to")}</b>
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {addons.map((a) => {
                const isPro = a.name === "Agent Pro";
                const exKeys = AGENT_EXAMPLE_KEYS[a.name];
                const exWho = exKeys ? t(exKeys.who as any) : "";
                const exUse = exKeys ? t(exKeys.use as any) : "";
                return (
                  <div key={a.id}
                    className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur transition ${
                      isPro
                        ? "border-accent/60 bg-card shadow-[var(--shadow-glow)] scale-[1.02]"
                        : "border-border bg-card/70 hover:border-accent/40"
                    }`}>
                    {isPro && (
                      <span className="absolute -top-3 start-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-accent to-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                        <Zap className="size-3" /> {t("pr_recommended")}
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <Bot className="size-5 text-accent" />
                      <h3 className="font-display text-lg font-bold">{a.name}</h3>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{addonDesc(a.name) || a.description}</p>

                    <div className="mt-4 flex items-baseline gap-1">
                      <span className="text-xs text-muted-foreground">+</span>
                      <span className="font-display text-3xl font-bold text-gradient">
                        {a.price_iqd.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">{t("pr_iqd_per_month")}</span>
                    </div>

                    {exWho && (
                      <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
                        <div className="font-semibold text-foreground/90">{t("pr_suited_for")} {exWho}</div>
                        <div className="mt-1 text-muted-foreground">{exUse}</div>
                      </div>
                    )}

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded-md bg-background/40 px-2 py-1.5 text-center">
                        <div className="font-bold text-accent">{a.monthly_tasks}</div>
                        <div className="text-muted-foreground">{t("pr_tasks_per_month")}</div>
                      </div>
                      <div className="rounded-md bg-background/40 px-2 py-1.5 text-center">
                        <div className="font-bold text-accent">{a.max_targets}</div>
                        <div className="text-muted-foreground">{a.max_targets === 1 ? t("pr_site") : t("pr_sites")}</div>
                      </div>
                    </div>

                    <ul className="mt-4 flex-1 space-y-2 text-sm">
                      {(addonFeatures(a.name).length ? addonFeatures(a.name) : (a.features as string[])).map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-success" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => openSelect(a, "agent")}
                      className={`mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-[1.02] ${
                        isPro
                          ? "bg-gradient-to-r from-accent to-primary text-primary-foreground shadow-[var(--shadow-glow)]"
                          : "border border-accent/40 text-accent hover:bg-accent/10"
                      }`}>
                      {user ? t("pr_add_agent") : t("pr_signin_to_add")}
                    </button>
                  </div>
                );
              })}
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              {t("pr_agent_note")}
            </p>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← {t("pr_back_home")}</Link>
        </div>
      </main>

      {/* Selection modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
          <div className="relative w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-[var(--shadow-glow)]">
            <button onClick={() => setSelected(null)} className="absolute end-3 top-3 text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
            <h3 className="font-display text-xl font-bold">{t("pr_confirm_title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {selectedKind === "agent" ? t("pr_confirm_chose_agent") : t("pr_confirm_chose_plan")} <b className="text-foreground">{selected.name}</b> {t("pr_confirm_at_price")}{" "}
              <b className="text-foreground">{selected.price_iqd.toLocaleString()} {t("pr_iqd")}</b>. {t("pr_confirm_pick_method")}
            </p>

            <div className="mt-5 grid gap-3">
              <button
                onClick={sendWhatsapp}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-success to-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
              >
                <MessageCircle className="size-4" />
                {t("pr_whatsapp")} — <span dir="ltr" style={{ unicodeBidi: "isolate" }}>+964 773 357 0130</span>
              </button>
              <button
                onClick={sendEmail}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/10"
              >
                <Mail className="size-4" />
                {t("pr_email_word")} — <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{SUPPORT_EMAIL}</span>
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              {t("pr_confirm_logged")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
