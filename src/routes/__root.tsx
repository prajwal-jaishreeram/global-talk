import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import logoUrl from "@/assets/logo and favicon/logo.png";
import { ensureAuthStore } from "@/lib/auth-client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F2F0EB] text-[#1C1C1B] px-4">
      <div className="max-w-lg border border-black/10 bg-[#FAF8F5] p-8 text-center shadow-sm">
        <div className="mono text-[10px] text-red-600 uppercase tracking-widest mb-3">
          RUNTIME_EXCEPTION
        </div>
        <h1 className="serif text-2xl font-light tracking-tight text-[#1C1C1B]">
          This page didn't load
        </h1>
        <p className="mt-2 text-xs text-black/60 font-light">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>

        {error?.message ? (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-left mono text-[11px] text-red-800 break-words overflow-auto max-h-40">
            {error.message}
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center bg-[#1C1C1B] text-[#F2F0EB] hover:bg-black mono text-xs uppercase tracking-wider px-5 py-2.5 transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center border border-black/20 bg-transparent text-black hover:border-black mono text-xs uppercase tracking-wider px-5 py-2.5 transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Ringringa" },
      {
        name: "description",
        content: "Browser-native international calling for individuals and teams.",
      },
      { name: "author", content: "Ringringa" },
      { property: "og:title", content: "Ringringa" },
      {
        property: "og:description",
        content: "Browser-native international calling for individuals and teams.",
      },
      { property: "og:image", content: logoUrl },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:image", content: logoUrl },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: logoUrl },
      { rel: "shortcut icon", type: "image/png", href: logoUrl },
      { rel: "apple-touch-icon", href: logoUrl },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t?t==='dark':true;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    void ensureAuthStore();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
