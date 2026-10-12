import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Key,
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldAlert,
  Code2,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  listMyApiKeys,
  createNewApiKey,
  revokeApiKey,
  listMyWebhooks,
  createNewWebhook,
  deleteWebhookEndpoint,
} from "@/lib/developer.functions";

export const Route = createFileRoute("/_authenticated/dashboard/developers")({
  head: () => ({ meta: [{ title: "Developer API & Webhooks - Ringringa" }] }),
  component: DevelopersPage,
});

function DevelopersPage() {
  const fetchKeys = useServerFn(listMyApiKeys);
  const createKey = useServerFn(createNewApiKey);
  const revokeKey = useServerFn(revokeApiKey);
  const fetchWebhooks = useServerFn(listMyWebhooks);
  const createWebhook = useServerFn(createNewWebhook);
  const deleteWebhook = useServerFn(deleteWebhookEndpoint);

  const [keys, setKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [keyMode, setKeyMode] = useState<"live" | "test">("live");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const [createWebhookOpen, setCreateWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");

  const [copiedKey, setCopiedKey] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [kRes, wRes] = await Promise.all([fetchKeys(), fetchWebhooks()]);
      setKeys(kRes.keys || []);
      setWebhooks(wRes.endpoints || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load developer data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateKey() {
    try {
      const res = await createKey({ data: { name: keyName, mode: keyMode } });
      setRevealedKey(res.fullKey);
      setKeyName("");
      loadData();
      toast.success("API key created");
    } catch (e: any) {
      toast.error(e.message || "Could not create API key");
    }
  }

  async function handleRevokeKey(id: string) {
    if (!confirm("Are you sure you want to revoke this API key? This cannot be undone.")) return;
    try {
      await revokeKey({ data: { id } });
      toast.success("API key revoked");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Could not revoke API key");
    }
  }

  async function handleCreateWebhook() {
    try {
      await createWebhook({ data: { url: webhookUrl } });
      toast.success("Webhook endpoint added");
      setWebhookUrl("");
      setCreateWebhookOpen(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Could not create webhook");
    }
  }

  async function handleDeleteWebhook(id: string) {
    if (!confirm("Delete this webhook endpoint?")) return;
    try {
      await deleteWebhook({ data: { id } });
      toast.success("Webhook endpoint deleted");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Could not delete webhook");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Developer API & Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Empower AI agents (Claude, ChatGPT, n8n, Make, custom scripts) to place phone calls via Ringringa.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <BookOpen className="h-4 w-4" /> API Docs
          </a>
        </div>
      </div>

      <Tabs defaultValue="keys" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="keys" className="gap-2">
            <Key className="h-4 w-4" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your API Keys</h2>
            <Button onClick={() => { setRevealedKey(null); setCreateKeyOpen(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create API Key
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading keys...</div>
            ) : keys.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No API keys yet. Create one to allow your AI agents to trigger phone calls.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Prefix</th>
                    <th className="px-4 py-3 font-medium">Mode</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{k.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{k.key_prefix}…</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            k.mode === "live"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {k.mode}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {k.revoked_at ? (
                          <span className="text-xs text-destructive">Revoked</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(k.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!k.revoked_at && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevokeKey(k.id)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Webhook Endpoints</h2>
            <Button onClick={() => setCreateWebhookOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Webhook
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading webhooks...</div>
            ) : webhooks.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No webhook endpoints. Add a URL to receive real-time notifications when calls start, finish, or fail.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {webhooks.map((w) => (
                  <div key={w.id} className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                      <div className="font-mono text-sm font-medium">{w.url}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Secret: {w.secret.slice(0, 10)}…</span>
                        <span>•</span>
                        <span>Events: {w.events?.join(", ")}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteWebhook(w.id)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Key Dialog */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              {revealedKey
                ? "Copy this key now. For your security, it will never be displayed again."
                : "Give this key a name and choose Live (dials real phone numbers) or Test (simulated)."}
            </DialogDescription>
          </DialogHeader>

          {revealedKey ? (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-2.5">
                <code className="flex-1 font-mono text-xs break-all select-all">{revealedKey}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(revealedKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                >
                  {copiedKey ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-amber-500 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> Keep this secret. Do not expose it in client-side code.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Key Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g. Sales Agent Bot"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Mode</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="live"
                      checked={keyMode === "live"}
                      onChange={() => setKeyMode("live")}
                    />
                    Live (real calls)
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="test"
                      checked={keyMode === "test"}
                      onChange={() => setKeyMode("test")}
                    />
                    Test (simulated)
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {revealedKey ? (
              <Button onClick={() => setCreateKeyOpen(false)}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setCreateKeyOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateKey}>Generate Key</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Webhook Dialog */}
      <Dialog open={createWebhookOpen} onOpenChange={setCreateWebhookOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Webhook Endpoint</DialogTitle>
            <DialogDescription>
              We'll send POST requests with HMAC-SHA256 signatures to this URL when call statuses update.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              placeholder="https://your-server.com/api/webhooks/ringringa"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateWebhookOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateWebhook}>Save Webhook</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
