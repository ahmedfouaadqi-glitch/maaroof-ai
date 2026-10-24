// WorkspaceSwitcher — sidebar chip to switch between brands/clients or create a new one.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Plus, Check, Loader2, Trash2 } from "lucide-react";
import { listWorkspaces, createWorkspace, deleteWorkspace } from "@/lib/workspaces.functions";

export type Workspace = {
  id: string;
  name: string;
  kind: "own" | "client" | "brand";
  brand_url: string | null;
  language: "ar" | "en" | "ku";
  country: string | null;
};

const STORAGE_KEY = "maaroof.active_workspace_id";

export function WorkspaceSwitcher({ onChange }: { onChange: (ws: Workspace | null) => void }) {
  const { t } = useI18n();
  const list = useServerFn(listWorkspaces);
  const create = useServerFn(createWorkspace);
  const del = useServerFn(deleteWorkspace);
  const [items, setItems] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"own" | "client" | "brand">("brand");
  const [brandUrl, setBrandUrl] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await list();
        const arr = (res.items as unknown as Workspace[]) || [];
        setItems(arr);
        const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
        const found = arr.find((w) => w.id === saved) || arr[0] || null;
        setActiveId(found?.id ?? null);
        onChange(found);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function pick(w: Workspace | null) {
    setActiveId(w?.id ?? null);
    if (typeof window !== "undefined") {
      if (w) localStorage.setItem(STORAGE_KEY, w.id);
      else localStorage.removeItem(STORAGE_KEY);
    }
    onChange(w);
  }

  async function submit() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await create({ data: { name: name.trim(), kind, brand_url: brandUrl.trim() || undefined, keywords: [], language: "ar" } });
      const w = res.workspace as unknown as Workspace;
      setItems((p) => [w, ...p]);
      pick(w);
      setName(""); setBrandUrl(""); setShowForm(false);
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("auto.delete_workspace_sessions_and_memory_within"))) return;
    await del({ data: { id } });
    const next = items.filter((w) => w.id !== id);
    setItems(next);
    if (activeId === id) pick(next[0] || null);
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <h2 className="flex items-center justify-between gap-2 font-semibold text-base m-0">
        <span className="flex items-center gap-2"><Building2 className="w-4 h-4" /> {t("auto.workspaces")}</span>
        <button onClick={() => setShowForm((v) => !v)} className="text-xs text-primary hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> {t("auto.new")}</button>
      </h2>


      {showForm && (
        <div className="space-y-2 p-2 rounded border bg-background/50">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auto.brand_customer_name")} className="w-full border rounded px-2 py-1 bg-background text-sm" />
          <select value={kind} onChange={(e) => setKind(e.target.value as "own" | "client" | "brand")} className="w-full border rounded px-2 py-1 bg-background text-sm">
            <option value="brand">{t("auto.brand_3")}</option>
            <option value="client">{t("auto.client")}</option>
            <option value="own">{t("auto.mine")}</option>
          </select>
          <input value={brandUrl} onChange={(e) => setBrandUrl(e.target.value)} placeholder={t("auto.website_link_optional")} className="w-full border rounded px-2 py-1 bg-background text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="text-xs px-2 py-1 rounded hover:bg-muted">{t("auto.cancel")}</button>
            <button onClick={submit} disabled={!name.trim() || creating} className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50 flex items-center gap-1">
              {creating && <Loader2 className="w-3 h-3 animate-spin" />} {t("auto.save")}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> {t("auto.loading")}</div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("auto.no_spaces_yet_create_the_first")}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((w) => (
            <li key={w.id} className={`group flex items-center gap-2 p-2 rounded ${activeId === w.id ? "bg-primary/10 border border-primary/40" : "hover:bg-muted"}`}>
              <button onClick={() => pick(w)} className="flex-1 text-start truncate">
                <div className="flex items-center gap-1.5 truncate">
                  {activeId === w.id && <Check className="w-3 h-3 text-primary shrink-0" />}
                  <span className="truncate">{w.name}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {w.kind === "brand" ? t("auto.tag") : w.kind === "client" ? t("auto.client") : t("auto.special")}
                  {w.brand_url ? ` · ${new URL(w.brand_url).hostname.replace("www.", "")}` : ""}
                </div>
              </button>
              <button onClick={() => remove(w.id)} className="opacity-0 group-hover:opacity-100 text-destructive p-1 rounded hover:bg-destructive/10" title={t("auto.delete")}>
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
