import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuthState } from "@/lib/auth-client";

export const Route = createFileRoute("/_authenticated")({
  component: AuthGuard,
});

function AuthGuard() {
  const navigate = useNavigate();
  const { ready, isAuthenticated } = useAuthState();

  useEffect(() => {
    if (!ready || isAuthenticated) return;
    void navigate({ to: "/auth/login", replace: true });
  }, [isAuthenticated, navigate, ready]);

  useEffect(() => {
    if (ready || isAuthenticated) return;

    const timeout = window.setTimeout(() => {
      const redirectTo = `${window.location.pathname}${window.location.search}`;
      void navigate({
        to: "/auth/login",
        search: { redirect: redirectTo },
        replace: true,
      });
    }, 2500);

    return () => window.clearTimeout(timeout);
  }, [isAuthenticated, navigate, ready]);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking your session…
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <Outlet />;
}

// Silence the unused import - kept for future SSR-safe guard.
void redirect;
