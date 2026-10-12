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
    <div className="grid min-h-screen place-items-center bg-[#F2F0EB] text-[#1C1C1B] px-4 py-12">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 group">
          <span className="serif text-2xl font-semibold tracking-tighter">
            RINGRINGA<span className="text-[#8B6B55]">.</span>
          </span>
        </Link>

        <div className="border border-black/10 bg-[#FAF8F5] p-7 shadow-sm">
          <div className="flex items-center justify-between border-b-2 border-dashed border-black/10 pb-3 mb-6">
            <span className="mono text-[10px] uppercase tracking-wider text-black/50">SYSTEM_AUTH</span>
            <span className="mono text-[10px] bg-[#2A382E]/10 text-[#2A382E] px-2 py-0.5">AGENT_DIALER</span>
          </div>

          <h1 className="serif text-2xl font-light tracking-tight text-[#1C1C1B]">Log in</h1>
          <p className="mt-1 text-xs text-black/60 font-light">Access your dialer, call tasks & API keys.</p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="mono text-[11px] uppercase tracking-wider text-black/70">
                Email
              </Label>
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
                className="bg-[#F2F0EB] border-black/20 text-[#1C1C1B] focus-visible:ring-black/20"
              />
              {fieldErrors.email ? (
                <p id="email-error" className="mono text-[11px] text-red-600">
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="mono text-[11px] uppercase tracking-wider text-black/70">
                  Password
                </Label>
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
                  className="pr-10 bg-[#F2F0EB] border-black/20 text-[#1C1C1B] focus-visible:ring-black/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 grid w-10 place-items-center text-black/40 hover:text-black"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id="password-error" className="mono text-[11px] text-red-600">
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            {formError ? (
              <Alert variant="destructive" className="border-red-400 bg-red-50 text-red-900">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="mono text-xs">Auth Failed</AlertTitle>
                <AlertDescription className="text-xs">{formError}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="submit"
              className="w-full bg-[#1C1C1B] text-[#F2F0EB] hover:bg-black mono text-xs uppercase tracking-wider py-5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AUTHENTICATING…
                </>
              ) : (
                "LOG IN →"
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-black/60 font-light border-t border-black/10 pt-4">
            No account?{" "}
            <Link to="/auth/signup" className="mono font-medium text-black underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}