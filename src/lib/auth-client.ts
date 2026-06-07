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

function isRecoverableAuthError(error: unknown) {
  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : "";

  return /refresh token not found|user.*not.*found|invalid.*jwt|jwt.*expired/i.test(message);
}

async function clearInvalidLocalSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Ignore cleanup failures; the auth snapshot is still reset below.
  }
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
    .then(async ({ data: sessionData }) => {
      const session = sessionData.session;

      if (snapshot.session && !session) {
        return snapshot;
      }

      if (session) {
        const { data: userData, error } = await supabase.auth.getUser();
        if (error || !userData.user || userData.user.id !== session.user.id) {
          if (error && !isRecoverableAuthError(error)) {
            console.error("Failed to validate auth session", error);
          }
          await clearInvalidLocalSession();
          setSnapshot(null);
          return snapshot;
        }

        setSnapshot({ ...session, user: userData.user });
        return snapshot;
      }

      setSnapshot(null);
      return snapshot;
    })
    .catch(async (error) => {
      console.error("Failed to hydrate auth session", error);

      if (snapshot.session) {
        return snapshot;
      }

      if (isRecoverableAuthError(error)) {
        await clearInvalidLocalSession();
      }

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
