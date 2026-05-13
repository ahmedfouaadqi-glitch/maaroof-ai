import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { computeFingerprint } from "@/lib/fingerprint";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_subscribed: boolean;
  subscription_tier: string | null;
  subscription_expires_at: string | null;
  monthly_analyses_used: number;
  monthly_suggestions_used: number;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p as Profile | null);
    setIsAdmin(!!roles?.some((r: any) => r.role === "admin"));

    // Multi-device fingerprint enforcement (admin-controlled limit)
    try {
      const fp = await computeFingerprint();
      if (!fp) return;
      const prof: any = p || {};
      const maxDevices = Math.max(1, Number(prof.max_devices ?? 1));
      const legacy = prof.device_fingerprint as string | null | undefined;
      let list: string[] = Array.isArray(prof.device_fingerprints)
        ? prof.device_fingerprints.filter((x: any) => typeof x === "string")
        : [];
      // migrate legacy single fp into the array
      if (legacy && !list.includes(legacy)) list = [legacy, ...list];

      if (list.includes(fp)) return; // already authorized

      if (list.length < maxDevices) {
        const next = [...list, fp];
        await supabase.from("profiles").update({
          device_fingerprints: next,
          device_fingerprint: legacy || fp,
          device_locked_at: prof.device_locked_at || new Date().toISOString(),
        }).eq("id", uid);
      } else {
        alert("This account has reached its device limit. Please contact support to add more devices.");
        await supabase.auth.signOut();
      }
    } catch {}
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Poll profile every 60s to keep usage counters / quota / subscription fresh.
  // (Replaced realtime postgres_changes subscription to avoid broadcasting profile
  // change events through the Realtime publication.)
  useEffect(() => {
    if (!user?.id) return;
    const iv = setInterval(() => { loadProfile(user.id); }, 60000);
    const onFocus = () => loadProfile(user.id);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(iv); window.removeEventListener("focus", onFocus); };
  }, [user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, session, profile, isAdmin, loading, refreshProfile, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}
