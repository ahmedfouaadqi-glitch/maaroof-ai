// Branded export identity: who generated the export + privacy-safe email.
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";

export type EmailPrivacy = "mask" | "code" | "hide";

export type ExportIdentity = {
  userName?: string;
  userEmail?: string; // already masked/encoded — never a raw address
  showLogo: boolean;
};

/** ah****f@g****.com — keeps first/last chars only. */
export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  const mask = (s: string, keep: number) =>
    s.length <= keep * 2 ? (s[0] || "") + "****" : s.slice(0, keep) + "****" + s.slice(-keep);
  const dotIdx = domain.lastIndexOf(".");
  const dName = dotIdx > 0 ? domain.slice(0, dotIdx) : domain;
  const tld = dotIdx > 0 ? domain.slice(dotIdx) : "";
  return `${mask(local, 2)}@${mask(dName, 1)}${tld}`;
}

/** Short irreversible code (djb2 hash → base36), for privacy-first footers. */
export function emailCode(email: string): string {
  let h = 5381;
  const s = email.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `#${h.toString(36).toUpperCase().padStart(6, "0").slice(0, 8)}`;
}

export function formatEmailForExport(email: string | null | undefined, privacy: EmailPrivacy): string | undefined {
  if (!email || privacy === "hide") return undefined;
  return privacy === "code" ? emailCode(email) : maskEmail(email);
}

/** Build the export identity from the signed-in user, honoring admin footer policy. */
export function useExportIdentity(opts: { showUser: boolean; emailPrivacy: EmailPrivacy; showLogo: boolean }): ExportIdentity {
  let auth: ReturnType<typeof useAuth> | null = null;
  try { auth = useAuth(); } catch {}
  const profile: any = auth?.profile;
  const email = profile?.email || auth?.user?.email || null;
  const name = profile?.full_name || profile?.username || (email ? String(email).split("@")[0] : undefined);
  return useMemo(() => ({
    userName: opts.showUser ? name || undefined : undefined,
    userEmail: opts.showUser ? formatEmailForExport(email, opts.emailPrivacy) : undefined,
    showLogo: opts.showLogo,
  }), [name, email, opts.showUser, opts.emailPrivacy, opts.showLogo]);
}
