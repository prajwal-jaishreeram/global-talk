import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, MailCheck, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { primeAuthSession } from "@/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Sign up - Eginta" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const hasSubmitted = submittedEmail.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setLoading(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: fullName } },
    });
    setLoading(false);
    if (error) {
      const friendlyMessage =
        error.code === "weak_password"
          ? "That password is too weak or has appeared in known breaches. Use a longer password with uppercase, lowercase, numbers, and a symbol."
          : error.message;

      setSubmitError(friendlyMessage);
      toast.error(friendlyMessage);
      return;
    }

    const alreadyRegistered =
      !!data.user &&
      !data.session &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0;

    if (alreadyRegistered) {
      const message = "This email already has an account. Please log in instead.";
      setSubmitError(message);
      toast.error(message);
      return;
    }

    if (data.session) {
      primeAuthSession(data.session);
      toast.success("Account created. You're now signed in.");
      void navigate({ to: "/dashboard", replace: true });
      return;
    }

    primeAuthSession(null);

    setSubmittedEmail(email);
    setFullName("");
    setEmail("");
    setPassword("");
    toast.success("Account created. Check your email for the verification link.");
  }

  async function handleResendVerification() {
    if (!submittedEmail) return;
    setResending(true);
    const redirectUrl = `${window.location.origin}/dashboard`;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: submittedEmail,
      options: { emailRedirectTo: redirectUrl },
    });
    setResending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Verification email sent again.");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Phone className="h-4 w-4" />
          </span>
          Eginta
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h1 className="text-xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start with $5 in trial credits.</p>
          {hasSubmitted ? (
            <Alert className="mt-6 border-primary/30 bg-primary/5">
              <MailCheck className="h-4 w-4" />
              <AlertTitle>Check your inbox</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  We sent a verification email to <strong>{submittedEmail}</strong>. Open it and click the link to activate your account.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" onClick={handleResendVerification} disabled={resending}>
                    {resending ? <Loader2 className="animate-spin" /> : null}
                    Resend email
                  </Button>
                  <Button type="button" variant="outline" onClick={() => navigate({ to: "/auth/login" })}>
                    Go to login
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Use at least 8 characters with uppercase, lowercase, a number, and a symbol.
                  </p>
                </div>
                {submitError ? (
                  <Alert variant="destructive">
                    <AlertTitle>Couldn&apos;t create account</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                  </Alert>
                ) : null}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating…" : "Sign up"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Have an account?{" "}
                <Link to="/auth/login" className="text-primary underline-offset-4 hover:underline">Log in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}