import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  User, CreditCard, Tag, Phone, UserPlus, KeyRound, LogOut, Mail,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings - Eginta" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [balance, setBalance] = useState(0);
  const [autoTopup, setAutoTopup] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? "");
      setMemberSince(new Date(user.created_at).toLocaleDateString());
      const { data } = await supabase.from("profiles").select("credit_balance").eq("id", user.id).maybeSingle();
      if (data) setBalance(Number(data.credit_balance ?? 0));
    })();
  }, []);

  async function saveAutoTopup(v: boolean) {
    setAutoTopup(v);
    toast.success(v ? "Auto top-up enabled" : "Auto top-up disabled");
  }

  async function submitEmailChange() {
    if (!newEmail) return;
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) return toast.error(error.message);
    toast.success("Confirmation link sent to your new email");
    setChangingEmail(false);
    setNewEmail("");
  }

  async function submitPwdChange() {
    if (newPwd.length < 6) return toast.error("Password must be at least 6 characters");
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setChangingPwd(false);
    setNewPwd("");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account, balance, and devices.</p>
      </div>

      {/* Account Information */}
      <Section icon={<User className="h-4 w-4" />} title="Account Information">
        <Row label="Email" value={email} action={
          <Button variant="ghost" size="sm" onClick={() => setChangingEmail((v) => !v)}>Change email</Button>
        } />
        {changingEmail && (
          <div className="flex gap-2 pt-2">
            <Input type="email" placeholder="new@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Button size="sm" onClick={submitEmailChange}>Save</Button>
          </div>
        )}
        <Row label="Member since" value={memberSince} />
        <div className="pt-3">
          <Link to="/dashboard/credits">
            <Button variant="outline" size="sm" className="gap-2">
              <CreditCard className="h-4 w-4" /> View billing portal
            </Button>
          </Link>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setChangingPwd((v) => !v)}>
            <KeyRound className="h-4 w-4" /> Change password
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
        {changingPwd && (
          <div className="flex gap-2 pt-2">
            <Input type="password" placeholder="New password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            <Button size="sm" onClick={submitPwdChange}>Save</Button>
          </div>
        )}
      </Section>

      {/* Balance */}
      <Section icon={<CreditCard className="h-4 w-4" />} title="Balance">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs text-muted-foreground">Current Balance</Label>
            <div className="text-3xl font-bold">${balance.toFixed(2)}</div>
          </div>
          <Link to="/dashboard/credits">
            <Button size="sm">Add credits</Button>
          </Link>
        </div>
        <div className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <div className="text-sm font-medium">Auto top-up when low</div>
            <div className="text-xs text-muted-foreground">Never interrupt an important call.</div>
          </div>
          <Switch checked={autoTopup} onCheckedChange={saveAutoTopup} />
        </div>
      </Section>

      {/* Promo Codes */}
      <Section icon={<Tag className="h-4 w-4" />} title="Promo Codes">
        <p className="text-sm text-muted-foreground">You don't have any active promo codes at the moment.</p>
        <p className="mt-1 text-xs text-muted-foreground">Complete feedback surveys to earn discount codes.</p>
        <div className="mt-3 flex gap-2">
          <Input placeholder="Enter code" className="max-w-xs" />
          <Button size="sm" variant="outline">Apply</Button>
        </div>
      </Section>

      {/* Phone Numbers */}
      <Section icon={<Phone className="h-4 w-4" />} title="Phone Numbers">
        <p className="text-sm text-muted-foreground">
          No phone numbers found. Buy a number to make and receive calls and SMS messages.
        </p>
        <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => toast.info("Number marketplace coming soon")}>
          <Phone className="h-4 w-4" /> Buy a new phone number
        </Button>
      </Section>

      {/* Caller IDs */}
      <Section icon={<UserPlus className="h-4 w-4" />} title="Caller IDs">
        <p className="text-sm text-muted-foreground">No caller IDs found.</p>
        <Button size="sm" variant="outline" className="mt-3 gap-2" onClick={() => toast.info("Caller ID verification coming soon")}>
          <UserPlus className="h-4 w-4" /> Add a new caller ID
        </Button>
      </Section>

      <div className="pt-4 text-center text-xs text-muted-foreground">
        Need help? <Link to="/contact" className="text-primary hover:underline">Contact support</Link>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function Row({ label, value, action }: { label: string; value: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
      {action}
    </div>
  );
}
