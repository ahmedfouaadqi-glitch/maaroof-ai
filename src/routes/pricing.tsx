import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { whatsappLink } from "@/lib/whatsapp";
import { Check, MessageCircle, Mail, Loader2, X, Sparkles, Star } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  component: () => (
    <I18nProvider>
      <AuthProvider>
        <PricingPage />
      </AuthProvider>
    </I18nProvider>
  ),
});

const SUPPORT_EMAIL = "ahmedfouaad.qi@gmail.com";

const EXAMPLES: Record<string, { who: string; use: string }> = {
  Starter: { who: "صانع محتوى أو فريلانسر", use: "تحليل ~1 منشور يومياً + تحسين كتابتك للذكاء الاصطناعي" },
  Pro: { who: "متجر إلكتروني أو شركة صغيرة", use: "تحليل 4 منشورات يومياً + اقتراح محتوى مستمر لصفحاتك" },
  Business: { who: "وكالة تسويق أو فريق محتوى", use: "إدارة عدة عملاء + تقارير PDF + تصدير وتحليل بكميات" },
  "Pro Yearly": { who: "من يريد توفير 50,000 د.ع", use: "كل مزايا Pro لمدة سنة كاملة بسعر اول مره مخفض" },
};

function PricingPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    supabase.from("subscription_plans").select("*").eq("active", true).order("sort_order")
      .then(({ data }) => setPlans(data || []));
  }, []);

  const openSelect = (plan: any) => {
    if (!user) {
      navigate({ to: "/auth", search: { mode: "signup", redirect: "/pricing" } });
      return;
    }
    setSelected(plan);
  };

  const sendWhatsapp = async () => {
    if (!selected || !user) return;
    await supabase.from("subscription_requests").insert({
      user_id: user.id, plan_id: selected.id, status: "pending",
      whatsapp_contacted_at: new Date().toISOString(),
    });
    const msg = `السلام عليكم، أرغب بالاشتراك في خطة ${selected.name} (${selected.price_iqd.toLocaleString()} د.ع)\nالبريد: ${user.email}`;
    window.open(whatsappLink(msg), "_blank");
    setSelected(null);
  };

  const sendEmail = async () => {
    if (!selected || !user) return;
    await supabase.from("subscription_requests").insert({
      user_id: user.id, plan_id: selected.id, status: "pending",
    });
    const subject = encodeURIComponent(`طلب اشتراك — خطة ${selected.name}`);
    const body = encodeURIComponent(
      `السلام عليكم،\n\nأرغب بتفعيل الاشتراك في خطة:\n• ${selected.name}\n• السعر: ${selected.price_iqd.toLocaleString()} د.ع\n• المدة: ${selected.duration_days} يوم\n\nبريدي: ${user.email}\n\nشكراً.`,
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    setSelected(null);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" /> اختر الخطة المناسبة لك
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold text-gradient md:text-5xl">الأسعار</h1>
          <p className="mt-3 text-muted-foreground">
            خطط مبسّطة بأسعار واضحة. عند الاختيار تواصل معنا عبر <b>واتساب</b> أو <b>البريد الإلكتروني</b> ليتم تفعيل الخطة فوراً.
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="mt-12 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p, i) => {
              const isPopular = p.name === "Pro";
              const isYearly = p.name === "Pro Yearly";
              const ex = EXAMPLES[p.name] ?? { who: "", use: "" };
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
                      <Star className="size-3" /> الأكثر اختياراً
                    </span>
                  )}
                  {isYearly && (
                    <span className="absolute -top-3 start-1/2 -translate-x-1/2 rounded-full bg-success px-3 py-1 text-xs font-semibold text-primary-foreground">
                      وفّر 50,000 د.ع
                    </span>
                  )}
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{p.description?.split("(")[0]}</p>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-gradient">
                      {p.price_iqd.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground">د.ع</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.duration_days >= 365 ? "سنوياً (لأول مرة)" : "شهرياً"}
                  </div>

                  {ex.who && (
                    <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
                      <div className="font-semibold text-foreground/90">مناسبة لـ: {ex.who}</div>
                      <div className="mt-1 text-muted-foreground">{ex.use}</div>
                    </div>
                  )}

                  <ul className="mt-4 flex-1 space-y-2 text-sm">
                    {(p.features as string[]).slice(0, 4).map((f, idx) => (
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
                    {user ? "اختر هذه الخطة" : "سجّل الدخول للاختيار"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">← {t("back_home")}</Link>
        </div>
      </div>

      {/* Selection modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
          <div className="relative w-full max-w-md rounded-2xl border border-primary/30 bg-card p-6 shadow-[var(--shadow-glow)]">
            <button onClick={() => setSelected(null)} className="absolute end-3 top-3 text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
            <h3 className="font-display text-xl font-bold">تأكيد الاشتراك</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              اخترت خطة <b className="text-foreground">{selected.name}</b> بسعر{" "}
              <b className="text-foreground">{selected.price_iqd.toLocaleString()} د.ع</b>. اختر طريقة التواصل لتفعيل اشتراكك:
            </p>

            <div className="mt-5 grid gap-3">
              <button
                onClick={sendWhatsapp}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-success to-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)]"
              >
                <MessageCircle className="size-4" />
                واتساب — <span dir="ltr" style={{ unicodeBidi: "isolate" }}>+964 773 357 0130</span>
              </button>
              <button
                onClick={sendEmail}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/40 px-5 py-3 text-sm font-semibold text-primary hover:bg-primary/10"
              >
                <Mail className="size-4" />
                بريد إلكتروني — <span dir="ltr" style={{ unicodeBidi: "isolate" }}>{SUPPORT_EMAIL}</span>
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              يتم تسجيل طلبك تلقائياً وسنفعّل الاشتراك خلال دقائق.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
