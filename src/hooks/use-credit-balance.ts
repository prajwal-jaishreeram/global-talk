import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCreditBalance } from "@/lib/credits.functions";
import { useAuthState } from "@/lib/auth-client";

function parseCreditBalance(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function useCreditBalance() {
  const { ready, user } = useAuthState();
  const fetchBalance = useServerFn(getCreditBalance);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!ready || !user) {
      setBalance(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await fetchBalance();
      setBalance(data.profileFound ? data.balance : null);
    } catch (error) {
      console.error("Failed to refresh credit balance", error);
    }
    setLoading(false);
  }, [fetchBalance, ready, user]);

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
      try {
        const data = await fetchBalance();
        if (!active) return;
        setBalance(data.profileFound ? data.balance : null);
      } catch (error) {
        if (active) console.error("Failed to load credit balance", error);
      } finally {
        if (active) setLoading(false);
      }

      channel = supabase
        .channel(`profile-balance:${user.id}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload) => {
            const next = parseCreditBalance(
              (payload.new as { credit_balance?: unknown }).credit_balance,
            );
            if (next !== null) setBalance(next);
          },
        )
        .subscribe();
    }

    void load();
    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchBalance, ready, user]);

  return { balance, loading, refresh };
}
