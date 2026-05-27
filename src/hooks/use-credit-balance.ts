import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/lib/auth-client";

export function useCreditBalance() {
  const { ready, user } = useAuthState();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!ready || !user) {
      setBalance(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("credit_balance")
      .eq("id", user.id)
      .maybeSingle();

    if (!error) {
      setBalance(Number(data?.credit_balance ?? 0));
    }
    setLoading(false);
  }, [ready, user]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function load() {
      if (!user) {
        setBalance(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("credit_balance")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;
      if (!error) setBalance(Number(data?.credit_balance ?? 0));
      setLoading(false);

      channel = supabase
        .channel(`profile-balance:${user.id}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload) => {
            const next = (payload.new as { credit_balance?: number }).credit_balance;
            if (typeof next === "number") setBalance(next);
          },
        )
        .subscribe();
    }

    void load();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [ready, user]);

  return { balance, loading, refresh };
}
