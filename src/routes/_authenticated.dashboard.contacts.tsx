import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { UserPlus, Upload, Tag, Search, Phone, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/contacts")({
  head: () => ({ meta: [{ title: "Contacts — Eginta" }] }),
  component: ContactsPage,
});

type Contact = {
  id: string;
  name: string;
  phone: string;
  company: string | null;
  email: string | null;
  website: string | null;
  tags: string[];
  note: string | null;
};

type Form = Omit<Contact, "id" | "tags"> & { tags: string };

const EMPTY: Form = {
  name: "",
  phone: "",
  company: "",
  email: "",
  website: "",
  tags: "",
  note: "",
};

function ContactsPage() {
  const { ready, user } = useAuthState();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const [tagsOpen, setTagsOpen] = useState(false);
  const [bulkTags, setBulkTags] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("id,name,phone,company,email,website,tags,note")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load contacts", { description: error.message });
    } else {
      setContacts((data ?? []) as Contact[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (ready && user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.phone, c.company, c.email, c.website, c.note, c.tags.join(" ")]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [contacts, query]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  }

  function openEdit(c: Contact) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone,
      company: c.company ?? "",
      email: c.email ?? "",
      website: c.website ?? "",
      tags: c.tags.join(", "),
      note: c.note ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!user) return;
    if (!form.name.trim() && !form.phone.trim()) {
      toast.error("Name or phone is required");
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      company: form.company?.trim() || null,
      email: form.email?.trim() || null,
      website: form.website?.trim() || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      note: form.note?.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("contacts").update(payload).eq("id", editing.id)
      : await supabase.from("contacts").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    toast.success(editing ? "Contact updated" : "Contact added");
    setOpen(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this contact?")) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) return toast.error("Delete failed", { description: error.message });
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setContacts((cs) => cs.filter((c) => c.id !== id));
  }

  function toggleAll() {
    setSelected((s) =>
      s.size === filtered.length ? new Set() : new Set(filtered.map((c) => c.id)),
    );
  }

  function toggleOne(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function importCsv(file: File) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("CSV is empty");
      return;
    }
    const header = rows[0].map((h) => h.toLowerCase().trim());
    const idx = (k: string) => header.indexOf(k);
    const cName = idx("name");
    const cPhone = ["phone", "number", "mobile"].map(idx).find((i) => i >= 0) ?? -1;
    const cCompany = idx("company");
    const cEmail = idx("email");
    const cWebsite = idx("website");
    const cTags = idx("tags");
    const cNote = ["note", "notes"].map(idx).find((i) => i >= 0) ?? -1;
    if (cName < 0 && cPhone < 0) {
      toast.error("CSV must have a 'name' or 'phone' column");
      return;
    }
    const payload = rows
      .slice(1)
      .filter((r) => r.some((v) => v.trim() !== ""))
      .map((r) => ({
        user_id: user!.id,
        name: (cName >= 0 ? r[cName] : "")?.trim() ?? "",
        phone: (cPhone >= 0 ? r[cPhone] : "")?.trim() ?? "",
        company: cCompany >= 0 ? r[cCompany]?.trim() || null : null,
        email: cEmail >= 0 ? r[cEmail]?.trim() || null : null,
        website: cWebsite >= 0 ? r[cWebsite]?.trim() || null : null,
        tags:
          cTags >= 0
            ? (r[cTags] ?? "").split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
            : [],
        note: cNote >= 0 ? r[cNote]?.trim() || null : null,
      }));
    if (payload.length === 0) {
      toast.error("No rows to import");
      return;
    }
    const { error } = await supabase.from("contacts").insert(payload);
    if (error) return toast.error("Import failed", { description: error.message });
    toast.success(`Imported ${payload.length} contacts`);
    await load();
  }

  async function applyBulkTags() {
    if (selected.size === 0) {
      toast.error("Select at least one contact");
      return;
    }
    const newTags = bulkTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (newTags.length === 0) {
      toast.error("Enter at least one tag");
      return;
    }
    const targets = contacts.filter((c) => selected.has(c.id));
    const updates = await Promise.all(
      targets.map((c) => {
        const merged = Array.from(new Set([...c.tags, ...newTags]));
        return supabase.from("contacts").update({ tags: merged }).eq("id", c.id);
      }),
    );
    const failed = updates.filter((u) => u.error).length;
    if (failed > 0) toast.error(`${failed} updates failed`);
    else toast.success(`Tagged ${targets.length} contacts`);
    setTagsOpen(false);
    setBulkTags("");
    await load();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your Eginta call list and tag people by group.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={openAdd}>
          <UserPlus /> Add contact
        </Button>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                await importCsv(f);
                e.target.value = "";
              }
            }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground">
            <Upload className="h-4 w-4" /> Import CSV
          </span>
        </label>
        <Button variant="outline" onClick={() => setTagsOpen(true)}>
          <Tag /> Edit tags{selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts..."
          className="h-11 pl-9"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={filtered.length > 0 && selected.size === filtered.length}
                      onCheckedChange={toggleAll}
                    />
                    Select All
                  </div>
                </th>
                <th className="px-3 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-left">Phone</th>
                <th className="px-3 py-3 text-left">Company</th>
                <th className="px-3 py-3 text-left">Email</th>
                <th className="px-3 py-3 text-left">Website</th>
                <th className="px-3 py-3 text-left">Tags</th>
                <th className="px-3 py-3 text-left">Note</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                    No contacts found
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-t border-border/60 hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                      />
                    </td>
                    <td className="px-3 py-3 font-medium">{c.name || "—"}</td>
                    <td className="px-3 py-3">{c.phone || "—"}</td>
                    <td className="px-3 py-3">{c.company || "—"}</td>
                    <td className="px-3 py-3">{c.email || "—"}</td>
                    <td className="px-3 py-3">
                      {c.website ? (
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {c.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {c.tags.length === 0 ? (
                        "—"
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {c.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="font-normal">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 max-w-[220px] truncate" title={c.note ?? ""}>
                      {c.note || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        {c.phone && (
                          <a
                            href={`/dashboard?dial=${encodeURIComponent(c.phone)}`}
                            className={cn(
                              "grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
                            )}
                            title="Call"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        <button
                          onClick={() => openEdit(c)}
                          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(c.id)}
                          className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit contact" : "Add contact"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this person's details." : "Add a new person to your list."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+14155552671"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company">
                <Input
                  value={form.company ?? ""}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Website">
              <Input
                value={form.website ?? ""}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </Field>
            <Field label="Tags (comma separated)">
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="lead, vip"
              />
            </Field>
            <Field label="Note">
              <Textarea
                rows={3}
                value={form.note ?? ""}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk tag dialog */}
      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add tags to selected</DialogTitle>
            <DialogDescription>
              Tags will be merged with each selected contact's existing tags. {selected.size} selected.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={bulkTags}
            onChange={(e) => setBulkTags(e.target.value)}
            placeholder="lead, vip, follow-up"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTagsOpen(false)}>
              <X /> Cancel
            </Button>
            <Button onClick={applyBulkTags}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// Minimal CSV parser supporting quoted fields, commas, and escaped quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else cur += ch;
    }
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}