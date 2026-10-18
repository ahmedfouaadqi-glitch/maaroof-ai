import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_INTERFACE_POLICY, resolveInterfacePolicy, type InterfacePolicy } from "@/lib/interface-policy";

/**
 * Resolves the global interface policy with the current user's optional
 * profile override. Passing null explicitly means anonymous/global-only;
 * omitting the argument resolves the currently signed-in user.
 */
export async function fetchInterfacePolicy(userId?: string | null): Promise<InterfacePolicy> {
  try {
    const resolvedUserId = userId === undefined
      ? (await supabase.auth.getUser()).data.user?.id ?? null
      : userId;
    const [settingsResult, profileResult] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle(),
      resolvedUserId
        ? supabase.from("profiles").select("ui_visibility").eq("id", resolvedUserId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const globalPolicy = settingsResult.data?.value ?? DEFAULT_INTERFACE_POLICY;
    const visibility = (profileResult.data as any)?.ui_visibility;
    return resolveInterfacePolicy(globalPolicy, visibility?.interface);
  } catch {
    return DEFAULT_INTERFACE_POLICY;
  }
}

export function useInterfacePolicy() {
  const [policy, setPolicy] = useState<InterfacePolicy>(DEFAULT_INTERFACE_POLICY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = (userId?: string | null) => {
      void fetchInterfacePolicy(userId).then((next) => {
        if (!active) return;
        setPolicy(next);
        setReady(true);
      });
    };

    // Resolve once immediately, then recompute whenever sign-in state changes.
    refresh();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      refresh(session?.user?.id ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  return { policy, ready };
}
