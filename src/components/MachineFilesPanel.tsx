// Generates llms.txt + Schema.org JSON-LD from the user's own analysed text.
// Pure, in-browser, no model call and no charge — it only reorganises facts the user wrote.
import { useMemo, useState } from "react";
import { FileCode2, Copy, Download, Check } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const TX = {
  ar: { title: "ملفات قراءة الآلة (llms.txt + JSON-LD)", hint: "مولّدة من نصك أنت فقط — لا أرقام مختلقة. راجعها ثم ضعها في موقعك.", brand: "اسم العلامة", site: "رابط الموقع", copy: "نسخ", dl: "تنزيل" },
  en: { title: "Machine-readable files (llms.txt + JSON-LD)", hint: "Built only from your own text — no invented numbers. Review, then add to your site.", brand: "Brand name", site: "Website URL", copy: "Copy", dl: "Download" },
  ku: { title: "فایلەکانی خوێندنەوەی ئامێر", hint: "تەنیا لە دەقی خۆت دروستکراوە.", brand: "ناوی براند", site: "لینکی ماڵپەڕ", copy: "کۆپی", dl: "داگرتن" },
};

export function buildMachineFiles(text: string, brand: string, site: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentences = clean.split(/(?<=[.!?؟。])\s+/).filter((s) => s.length > 15);
  const summary = sentences.slice(0, 2).join(" ").slice(0, 300);
  const facts = sentences.filter((s) => /\d/.test(s)).slice(0, 6);
  const name = brand.trim() || "Brand";
  const url = site.trim();
  const llms = [
    `# ${name}`,
    "",
    `> ${summary}`,
    "",
    ...(facts.length ? ["## Key facts", ...facts.map((f) => `- ${f}`), ""] : []),
    ...(url ? ["## Links", `- [Website](${url})`] : []),
  ].join("\n");
  const ld: any = { "@context": "https://schema.org", "@type": "Organization", name, description: summary };
  if (url) ld.url = url;
  const qa = sentences.slice(0, 3).map((s, i) => ({ "@type": "Question", name: `${name} — ${i + 1}`, acceptedAnswer: { "@type": "Answer", text: s } }));
  const jsonld = JSON.stringify([ld, { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa }], null, 2);
  return { llms, jsonld };
}

export function MachineFilesPanel({ text, brand: brand0 = "" }: { text: string; brand?: string }) {
  const { lang } = useI18n();
  const T = TX[(lang === "en" || lang === "ku" ? lang : "ar") as "ar" | "en" | "ku"];
  const [brand, setBrand] = useState(brand0);
  const [site, setSite] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const files = useMemo(() => buildMachineFiles(text, brand, site), [text, brand, site]);
  if (text.trim().length < 30) return null;

  const copy = (k: string, v: string) => { navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(null), 1500); };
  const dl = (name: string, v: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([v], { type }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary"><FileCode2 className="size-4" /> {T.title}</div>
      <p className="text-xs text-muted-foreground">{T.hint}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={T.brand} className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
        <input value={site} onChange={(e) => setSite(e.target.value)} placeholder={T.site} dir="ltr" className="rounded-md border border-border bg-background px-2 py-1 text-xs" />
      </div>
      {([["llms.txt", files.llms, "text/plain"], ["schema.jsonld", files.jsonld, "application/ld+json"]] as const).map(([n, v, ty]) => (
        <div key={n} className="rounded-lg border border-border bg-background/60">
          <div className="flex items-center gap-2 border-b border-border px-2 py-1 text-[11px] font-mono">
            {n}
            <button type="button" onClick={() => copy(n, v)} className="ms-auto inline-flex items-center gap-1">{copied === n ? <Check className="size-3" /> : <Copy className="size-3" />} {T.copy}</button>
            <button type="button" onClick={() => dl(n, v, ty)} className="inline-flex items-center gap-1"><Download className="size-3" /> {T.dl}</button>
          </div>
          <pre dir="ltr" className="max-h-48 overflow-auto p-2 text-[11px] whitespace-pre-wrap">{v}</pre>
        </div>
      ))}
    </div>
  );
}
