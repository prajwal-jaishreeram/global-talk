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
const AUTH_SESSION_TIMEOUT_MS = 4000;
const AUTH_VALIDATION_TIMEOUT_MS = 7000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

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

function isAuthTimeout(error: unknown) {
  return error instanceof Error && /timed out/i.test(error.message);
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

  initPromise = withTimeout(
    supabase.auth.getSession(),
    AUTH_SESSION_TIMEOUT_MS,
    "Auth session hydration",
  )
    .then(async ({ data: sessionData }) => {
      const session = sessionData.session;

      if (snapshot.session && !session) {
        return snapshot;
      }

      if (session) {
        setSnapshot(session);
        void validateAuthSession(session);
        return snapshot;
      }

      setSnapshot(null);
      return snapshot;
    })
    .catch(async (error) => {
      console.error("Failed to hydrate auth session", error);

      if (snapshot.session) {
        snapshot = { ...snapshot, ready: true };
        emit();
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

async function validateAuthSession(session: Session) {
  try {
    const { data: userData, error } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_VALIDATION_TIMEOUT_MS,
      "Auth session validation",
    );

    if (error || !userData.user || userData.user.id !== session.user.id) {
      if (error && !isRecoverableAuthError(error)) {
        console.error("Failed to validate auth session", error);
      }
      await clearInvalidLocalSession();
      if (snapshot.session?.access_token === session.access_token) {
        setSnapshot(null);
      }
      return;
    }

    if (snapshot.session?.access_token === session.access_token) {
      setSnapshot({ ...session, user: userData.user });
    }
  } catch (error) {
    if (isAuthTimeout(error)) {
      console.warn("Auth session validation timed out; keeping local session", error);
      return;
    }

    console.error("Failed to validate auth session", error);
    if (isRecoverableAuthError(error) && snapshot.session?.access_token === session.access_token) {
      await clearInvalidLocalSession();
      setSnapshot(null);
    }
  }
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
