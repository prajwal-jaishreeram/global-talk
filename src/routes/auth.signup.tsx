import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

const signupSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name.").max(100),
  email: z.string().trim().email("Enter a valid email address.").max(255),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(72, "Password is too long.")
    .regex(/[a-z]/, "Include at least one lowercase letter.")
    .regex(/[A-Z]/, "Include at least one uppercase letter.")
    .regex(/[0-9]/, "Include at least one number."),
});

type FieldErrors = Partial<Record<"fullName" | "email" | "password", string>>;

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Sign up - Ringringa" }] }),
  component: SignupPage,
});

function mapAuthError(message: string | undefined, code: string | undefined): string {
  const lower = (message ?? "").toLowerCase();
  if (code === "weak_password" || lower.includes("weak password") || lower.includes("pwned")) {
    return "That password is too weak or has appeared in known breaches. Try a longer, more unique one.";
  }
  if (
    code === "user_already_exists" ||
    lower.includes("already registered") ||
    lower.includes("user already") ||
    lower.includes("already been registered")
  ) {
    return "This email already has an account. Please log in instead.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("failed to fetch")) {
    return "Network error. Check your connection and try again.";
  }
  return message || "Something went wrong. Please try again.";
}

function SignupPage() {
  const navigate = useNavigate();
  const { ready, isAuthenticated } = useAuthState();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (ready && isAuthenticated) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [ready, isAuthenticated, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;

    setFormError("");
    setFieldErrors({});

    const parsed = signupSchema.safeParse({ fullName, email, password });
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
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { full_name: parsed.data.fullName },
        },
      });

      if (error) {
        const friendly = mapAuthError(error.message, (error as { code?: string }).code);
        console.error("[signup] supabase error", error);
        setFormError(friendly);
        toast.error(friendly);
        return;
      }

      // Supabase returns a user with empty identities[] when the email already exists.
      const alreadyRegistered =
        !!data.user &&
        !data.session &&
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0;

      if (alreadyRegistered) {
        const msg = "This email already has an account. Please log in instead.";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      if (data.session) {
        primeAuthSession(data.session);
        toast.success("Account created. You're now signed in.");
        void navigate({ to: "/dashboard", replace: true });
        return;
      }

      // Email confirmation required path.
      primeAuthSession(null);
      toast.success("Account created. Check your email for the verification link.");
      void navigate({ to: "/auth/login", replace: true });
    } catch (err) {
      console.error("[signup] unexpected", err);
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
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start with $5 in trial credits.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                autoComplete="name"
                required
                disabled={loading}
                aria-invalid={!!fieldErrors.fullName}
                aria-describedby={fieldErrors.fullName ? "name-error" : undefined}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              {fieldErrors.fullName ? (
                <p id="name-error" className="text-xs text-destructive">
                  {fieldErrors.fullName}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
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
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={loading}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
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
              ) : (
                <p id="password-hint" className="text-xs text-muted-foreground">
                  At least 8 characters with upper, lower, and a number.
                </p>
              )}
            </div>

            {formError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Couldn&apos;t create account</AlertTitle>
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Have an account?{" "}
            <Link to="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}