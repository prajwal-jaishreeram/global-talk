import { useEffect, useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthSnapshot = {
  ready: boolean;
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
};

let snapshot: AuthSnapshot = {
  ready: false,
  session: null,
  user: null,
  isAuthenticated: false,
};

let initialized = false;
let initPromise: Promise<AuthSnapshot> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setSnapshot(session: Session | null) {
  snapshot = {
    ready: true,
    session,
    user: session?.user ?? null,
    isAuthenticated: !!session,
  };
  emit();
}

export function primeAuthSession(session: Session | null) {
  setSnapshot(session);
}

export function getAuthSnapshot() {
  return snapshot;
}

export async function ensureAuthStore() {
  if (initialized) {
    return initPromise ?? snapshot;
  }

  initialized = true;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    setSnapshot(session);
  });

  void data.subscription;

  initPromise = supabase.auth
    .getSession()
    .then(({ data: sessionData }) => {
      setSnapshot(sessionData.session);
      return snapshot;
    })
    .catch((error) => {
      console.error("Failed to hydrate auth session", error);
      setSnapshot(null);
      return snapshot;
    });

  return initPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAuthState() {
  useEffect(() => {
    void ensureAuthStore();
  }, []);

  return useSyncExternalStore(subscribe, getAuthSnapshot, getAuthSnapshot);
}