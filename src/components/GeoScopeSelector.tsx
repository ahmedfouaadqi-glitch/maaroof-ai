import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export type GeoScope = { scope: "world" | "country" | "city" | "province"; country?: string; city?: string };

export function GeoScopeSelector({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const initial: GeoScope = (profile as any)?.geo_scope || { scope: "world" };
  const [val, setVal] = useState<GeoScope>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setVal((profile as any)?.geo_scope || { scope: "world" }); }, [profile]);

  const save = async (next: GeoScope) => {
    setVal(next);
    if (!user) return;
    setSaving(true);
    await supabase.from("profiles").update({ geo_scope: next as any }).eq("id", user.id);
    await refreshProfile();
    setSaving(false);
  };

  return (
    <div className={`rounded-xl border border-border bg-card/60 p-3 ${compact ? "" : "p-4"}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Globe2 className="size-4 text-primary" /> {t("geo_scope_title")}
      </div>
      <div className="flex flex-wrap gap-2">
        {(["world", "country", "province", "city"] as const).map((s) => (
          <button
            key={s}
            onClick={() => save({ ...val, scope: s })}
            className={`rounded-full px-3 py-1 text-xs font-semibold border ${val.scope === s ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground/80"}`}
          >
            {t(`geo_scope_${s}`)}
          </button>
        ))}
      </div>
      {(val.scope === "country" || val.scope === "province" || val.scope === "city") && (
        <input
          value={val.country || ""}
          onChange={(e) => setVal({ ...val, country: e.target.value })}
          onBlur={() => save(val)}
          placeholder={t("geo_country_ph")}
          className="mt-2 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm"
        />
      )}
      {(val.scope === "city" || val.scope === "province") && (
        <input
          value={val.city || ""}
          onChange={(e) => setVal({ ...val, city: e.target.value })}
          onBlur={() => save(val)}
          placeholder={t("geo_city_ph")}
          className="mt-2 w-full rounded-lg border border-border bg-background/60 px-3 py-1.5 text-sm"
        />
      )}
      {saving && <div className="mt-1 text-[10px] text-muted-foreground">…</div>}
    </div>
  );
}
