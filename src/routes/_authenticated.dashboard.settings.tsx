import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  User,
  CreditCard,
  Tag,
  Phone,
  UserPlus,
  KeyRound,
  LogOut,
  CheckCircle2,
} from "lucide-react";
import {
  listMyPhoneNumbers,
  listVerifiedCallerIds,
} from "@/lib/telnyx.functions";
import {
  getBillingStatus,
  saveAutoTopupSettings,
} from "@/lib/polar.functions";
import { formatMoneyExact } from "@/lib/rates";
import { useCreditBalance } from "@/hooks/use-credit-balance";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({ meta: [{ title: "Settings - AgentCall" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const fetchNumbers = useServerFn(listMyPhoneNumbers);
  const fetchCallerIds = useServerFn(listVerifiedCallerIds);
  const fetchBilling = useServerFn(getBillingStatus);
  const saveAutoTopupFn = useServerFn(saveAutoTopupSettings);
  const { balance } = useCreditBalance();

  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [autoTopup, setAutoTopup] = useState(false);
  const [autoTopupThreshold, setAutoTopupThreshold] = useState(2);
  const [autoTopupAmount, setAutoTopupAmount] = useState(20);
  const [savingAutoTopup, setSavingAutoTopup] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [numbers, setNumbers] = useState<
    { id: string; phone_number: string; country_code: string | null; monthly_cost: number; status: string }[]
  >([]);
  const [callerIds, setCallerIds] = useState<
    { phone_number: string; status: string }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      setEmail(user.email ?? "");
      setMemberSince(new Date(user.created_at).toLocaleDateString());

      const [billing, nums, cids] = await Promise.all([
        fetchBilling().catch(() => null),
        fetchNumbers().catch(() => ({ numbers: [] })),
        fetchCallerIds().catch(() => ({ numbers: [] })),
      ]);
      if (cancelled) return;
      if (billing) {
        setAutoTopup(!!billing.autoTopupActive);
        setAutoTopupThreshold(Number(billing.autoTopupThreshold ?? 2));
        setAutoTopupAmount(Number(billing.autoTopupAmount ?? 20));
      }
      setNumbers((nums?.numbers as any[]) ?? []);
      setCallerIds(
        ((cids?.numbers as any[]) ?? []).map((n) => ({
          phone_number: n.phone_number,
          status: n.status,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveAutoTopup(enabled: boolean) {
    const prev = autoTopup;
    setAutoTopup(enabled);
    setSavingAutoTopup(true);
    try {
      await saveAutoTopupFn({
        data: { enabled, threshold: autoTopupThreshold, amount: autoTopupAmount },
      });
      toast.success(enabled ? "Auto top-up enabled" : "Auto top-up disabled");
    } catch (e: any) {
      setAutoTopup(prev);
      toast.error(e?.message ?? "Could not save auto top-up");
    } finally {
      setSavingAutoTopup(false);
    }
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
            <div className="text-3xl font-bold">
              {balance === null ? "-" : formatMoneyExact(balance)}
            </div>
          </div>
          <Link to="/dashboard/credits">
            <Button size="sm">Add credits</Button>
          </Link>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Auto top-up when low</div>
              <div className="text-xs text-muted-foreground">
                Charges your saved card when balance drops below the threshold.
              </div>
            </div>
            <Switch
              checked={autoTopup}
              disabled={savingAutoTopup}
              onCheckedChange={saveAutoTopup}
            />
          </div>
          {autoTopup && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs text-muted-foreground">Top up when balance &lt; ($)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={autoTopupThreshold}
                  onChange={(e) => setAutoTopupThreshold(Number(e.target.value))}
                  onBlur={() =>
                    saveAutoTopupFn({
                      data: {
                        enabled: true,
                        threshold: autoTopupThreshold,
                        amount: autoTopupAmount,
                      },
                    }).catch((e: any) => toast.error(e?.message ?? "Save failed"))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Add credits ($)</Label>
                <Input
                  type="number"
                  min={5}
                  max={500}
                  value={autoTopupAmount}
                  onChange={(e) => setAutoTopupAmount(Number(e.target.value))}
                  onBlur={() =>
                    saveAutoTopupFn({
                      data: {
                        enabled: true,
                        threshold: autoTopupThreshold,
                        amount: autoTopupAmount,
                      },
                    }).catch((e: any) => toast.error(e?.message ?? "Save failed"))
                  }
                  className="mt-1"
                />
              </div>
            </div>
          )}
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
        {numbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No phone numbers found. Buy a number to make and receive calls and SMS messages.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {numbers.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <span className="font-medium">{n.phone_number}</span>
                  <span className="text-xs text-muted-foreground">
                    {n.country_code ?? "—"} · ${Number(n.monthly_cost).toFixed(2)}/mo
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{n.status}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/dashboard/numbers" className="mt-3 inline-block">
          <Button size="sm" variant="outline" className="gap-2">
            <Phone className="h-4 w-4" /> Manage phone numbers
          </Button>
        </Link>
      </Section>

      {/* Caller IDs */}
      <Section icon={<UserPlus className="h-4 w-4" />} title="Caller IDs">
        {callerIds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No verified caller IDs yet. Verify a number you own to use it as your
            outbound caller ID.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {callerIds.map((c) => (
              <li
                key={c.phone_number}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={
                      c.status === "verified"
                        ? "h-4 w-4 text-emerald-500"
                        : "h-4 w-4 text-muted-foreground"
                    }
                  />
                  <span className="font-medium">{c.phone_number}</span>
                </div>
                <span
                  className={
                    c.status === "verified"
                      ? "text-xs text-emerald-500"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/dashboard" className="mt-3 inline-block">
          <Button size="sm" variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" /> Add a new caller ID
          </Button>
        </Link>
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
