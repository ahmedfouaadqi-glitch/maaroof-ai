import { Link } from "@tanstack/react-router";
import { usePulseI18n } from "@/lib/pulse-i18n";
import { useAuth } from "@/lib/auth";

export function PulseSubNav() {
  const { t } = usePulseI18n();
  const auth = useAuth();

  const itemCls =
    "rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-card/80 transition";
  const activeCls = "!bg-primary !text-primary-foreground !border-primary";

  return (
    <nav className="flex flex-wrap items-center gap-2 border-b border-border/40 pb-3 mb-6">
      <Link to="/pulse" activeOptions={{ exact: true }} activeProps={{ className: activeCls }} className={itemCls}>
        {t("pulse_overview")}
      </Link>
      <Link to="/pulse/compare" activeProps={{ className: activeCls }} className={itemCls}>
        {t("pulse_compare")}
      </Link>
      <Link to="/pulse/assistant" activeProps={{ className: activeCls }} className={itemCls}>
        {t("pulse_assistant")}
      </Link>
      <Link to="/pulse/sources" activeProps={{ className: activeCls }} className={itemCls}>
        {t("pulse_sources")}
      </Link>
      {auth?.isAdmin && (
        <Link to="/admin/pulse" activeProps={{ className: activeCls }} className={itemCls + " text-accent"}>
          {t("pulse_admin")}
        </Link>
      )}
    </nav>
  );
}
