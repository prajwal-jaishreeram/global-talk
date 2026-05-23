import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { primeAuthSession } from "@/lib/auth-client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Log in - Eginta" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const friendly =
        error.message?.toLowerCase().includes("email not confirmed")
          ? "Your email isn't verified yet. Check your inbox for the verification link."
          : error.message?.toLowerCase().includes("invalid login")
          ? "Wrong email or password. Please try again."
          : error.message;
      setSubmitError(friendly);
      toast.error(friendly);
      return;
    }
    primeAuthSession(data.session);
    toast.success("Welcome back");
    void navigate({ to: "/dashboard", replace: true });
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
          <h1 className="text-xl font-semibold">Log in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Continue to your dialer.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {submitError ? (
              <Alert variant="destructive">
                <AlertTitle>Couldn&apos;t log in</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Log in"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/auth/signup" className="text-primary underline-offset-4 hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}