import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, Phone } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { primeAuthSession, useAuthState } from "@/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(255),
  password: z.string().min(1, "Enter your password.").max(72),
});

type FieldErrors = Partial<Record<"email" | "password", string>>;

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Log in - Ringringa" }] }),
  validateSearch: (search) => searchSchema.parse(search),
  component: LoginPage,
});

function mapAuthError(message: string | undefined, code: string | undefined): string {
  const lower = (message ?? "").toLowerCase();
  if (code === "invalid_credentials" || lower.includes("invalid login") || lower.includes("invalid_credentials")) {
    return "Wrong email or password. Please try again.";
  }
  if (code === "email_not_confirmed" || lower.includes("email not confirmed")) {
    return "Your email isn't verified yet. Check your inbox for the verification link.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Network error. Check your connection and try again.";
  }
  return message || "Something went wrong. Please try again.";
}

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth/login" });
  const { ready, isAuthenticated } = useAuthState();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // If already signed in, bounce out.
  useEffect(() => {
    if (ready && isAuthenticated) {
      void navigate({ to: search.redirect ?? "/dashboard", replace: true });
    }
  }, [ready, isAuthenticated, navigate, search.redirect]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setFormError("");
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (error) {
        const friendly = mapAuthError(error.message, (error as { code?: string }).code);
        console.error("[login] supabase error", error);
        setFormError(friendly);
        toast.error(friendly);
        return;
      }
      if (!data.session) {
        const msg = "Could not start a session. Please try again.";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      primeAuthSession(data.session);
      toast.success("Welcome back");
      void navigate({ to: search.redirect ?? "/dashboard", replace: true });
    } catch (err) {
      console.error("[login] unexpected", err);
      const friendly = mapAuthError(err instanceof Error ? err.message : "", undefined);
      setFormError(friendly);
      toast.error(friendly);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Phone className="h-4 w-4" />
          </span>
          Ringringa
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Log in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Continue to your dialer.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                required
                disabled={loading}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email ? (
                <p id="email-error" className="text-xs text-destructive">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id="password-error" className="text-xs text-destructive">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            {formError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Couldn&apos;t log in</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Log in"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/auth/signup" className="font-medium text-primary underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}