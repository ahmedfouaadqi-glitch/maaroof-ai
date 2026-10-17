import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_INTERFACE_POLICY, normalizeInterfacePolicy, type InterfacePolicy } from "@/lib/interface-policy";

export async function fetchInterfacePolicy(): Promise<InterfacePolicy> {
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "user_interface_policy").maybeSingle();
    return normalizeInterfacePolicy(data?.value);
  } catch {
    return DEFAULT_INTERFACE_POLICY;
  }
}

export function useInterfacePolicy() {
  const [policy, setPolicy] = useState<InterfacePolicy>(DEFAULT_INTERFACE_POLICY);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    fetchInterfacePolicy().then((p) => { if (on) { setPolicy(p); setReady(true); } });
    return () => { on = false; };
  }, []);
  return { policy, ready };
}
