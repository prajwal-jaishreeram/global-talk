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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PaginationFooter } from "@/components/pagination-footer";
import { ConfirmAction } from "@/components/confirm-action";

export const Route = createFileRoute("/_authenticated/dashboard/contacts")({
  head: () => ({ meta: [{ title: "Contacts — Ringringa" }] }),
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
const CONTACTS_PAGE_SIZE = 10;

function ContactsPage() {
  const { ready, user } = useAuthState();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

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

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) for (const t of c.tags) s.add(t);
    return Array.from(s).sort();
  }, [contacts]);

  const allCompanies = useMemo(() => {
    const s = new Set<string>();
    for (const c of contacts) if (c.company) s.add(c.company);
    return Array.from(s).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (q) {
        const hit = [c.name, c.phone, c.company, c.email, c.website, c.note, c.tags.join(" ")]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (tagFilter !== "all" && !c.tags.includes(tagFilter)) return false;
      if (companyFilter !== "all" && c.company !== companyFilter) return false;
      return true;
    });
  }, [contacts, query, tagFilter, companyFilter]);

  const activeFilterCount =
    (tagFilter !== "all" ? 1 : 0) + (companyFilter !== "all" ? 1 : 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / CONTACTS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedContacts = filtered.slice(
    (currentPage - 1) * CONTACTS_PAGE_SIZE,
    currentPage * CONTACTS_PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [query, tagFilter, companyFilter]);

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
      pagedContacts.length > 0 && pagedContacts.every((c) => s.has(c.id))
        ? new Set([...s].filter((id) => !pagedContacts.some((c) => c.id === id)))
        : new Set([...s, ...pagedContacts.map((c) => c.id)]),
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
    if (!user) {
      toast.error("Sign in before importing contacts");
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        toast.error("CSV is empty");
        return;
      }
      const header = rows[0].map(normalizeCsvHeader);
      const findColumn = (aliases: string[]) => aliases.map((k) => header.indexOf(k)).find((i) => i >= 0) ?? -1;
      const cName = findColumn(["name", "full name", "contact name", "customer name"]);
      const cFirstName = findColumn(["first name", "firstname", "given name"]);
      const cLastName = findColumn(["last name", "lastname", "surname", "family name"]);
      const cPhone = findColumn(["phone", "number", "mobile", "phone number", "mobile number", "telephone", "tel"]);
      const cCompany = findColumn(["company", "organization", "organisation"]);
      const cEmail = findColumn(["email", "email address", "e mail"]);
      const cWebsite = findColumn(["website", "url", "site"]);
      const cTags = findColumn(["tags", "tag", "labels", "groups"]);
      const cNote = findColumn(["note", "notes"]);
      if (cName < 0 && cFirstName < 0 && cLastName < 0 && cPhone < 0) {
        toast.error("CSV must have a name or phone column");
        return;
      }

      const payload = rows
        .slice(1)
        .filter((r) => r.some((v) => v.trim() !== ""))
        .map((r) => {
          const name =
            cName >= 0
              ? cleanCsvCell(r[cName])
              : [cleanCsvCell(r[cFirstName]), cleanCsvCell(r[cLastName])].filter(Boolean).join(" ");
          const phone = cleanCsvCell(r[cPhone]);
          return {
            user_id: user.id,
            name,
            phone,
            company: cCompany >= 0 ? cleanCsvCell(r[cCompany]) || null : null,
            email: cEmail >= 0 ? cleanCsvCell(r[cEmail]) || null : null,
            website: cWebsite >= 0 ? cleanCsvCell(r[cWebsite]) || null : null,
            tags:
              cTags >= 0
                ? (r[cTags] ?? "").split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
                : [],
            note: cNote >= 0 ? cleanCsvCell(r[cNote]) || null : null,
          };
        })
        .filter((row) => row.name || row.phone);
      if (payload.length === 0) {
        toast.error("No contacts found. Each imported row needs a name or phone number.");
        return;
      }
      const { error } = await supabase.from("contacts").insert(payload);
      if (error) {
        toast.error("Import failed", { description: error.message });
        return;
      }
      toast.success(`Imported ${payload.length} contacts`);
      await load();
    } catch (error) {
      toast.error("Import failed", { description: error instanceof Error ? error.message : "Could not read this CSV file." });
    } finally {
      setImporting(false);
    }
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
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your Ringringa call list and tag people by group.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button variant="outline" onClick={openAdd} className="w-full justify-center sm:w-auto">
          <UserPlus /> Add contact
        </Button>
        <label className="cursor-pointer">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={importing}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                await importCsv(f);
                e.target.value = "";
              }
            }}
          />
          <span className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground sm:w-auto">
            <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Import CSV"}
          </span>
        </label>
        <Button
          variant="outline"
          onClick={() => setTagsOpen(true)}
          className="w-full justify-center sm:w-auto"
        >
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

      {(allTags.length > 0 || allCompanies.length > 0) && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {allTags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger
                className={cn(
                  "h-8 w-full gap-1.5 rounded-full border-border bg-card px-3 text-xs font-medium sm:w-auto",
                  tagFilter !== "all" && "border-primary/50 bg-primary/10 text-primary",
                )}
              >
                <span className="text-muted-foreground">Tag:</span>
                <SelectValue>
                  {tagFilter === "all" ? "All tags" : tagFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {allCompanies.length > 0 && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger
                className={cn(
                  "h-8 w-full gap-1.5 rounded-full border-border bg-card px-3 text-xs font-medium sm:w-auto",
                  companyFilter !== "all" && "border-primary/50 bg-primary/10 text-primary",
                )}
              >
                <span className="text-muted-foreground">Company:</span>
                <SelectValue>
                  {companyFilter === "all" ? "All companies" : companyFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {allCompanies.map((co) => (
                  <SelectItem key={co} value={co}>
                    {co}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="text-xs text-muted-foreground sm:ml-auto">
            {filtered.length} of {contacts.length}
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setTagFilter("all");
                setCompanyFilter("all");
              }}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      <div className="mt-4 space-y-3 md:hidden">
        {loading ? (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            No contacts found
          </div>
        ) : (
          pagedContacts.map((c) => (
            <article key={c.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected.has(c.id)}
                  onCheckedChange={() => toggleOne(c.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold">{c.name || "Unnamed"}</div>
                      <div className="mt-1 truncate font-mono text-sm text-primary">
                        {c.phone || "No phone"}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {c.phone && (
                        <a
                          href={`/dashboard?dial=${encodeURIComponent(c.phone)}`}
                          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Call"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={() => openEdit(c)}
                        className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(c.id)}
                        className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    {c.company && <div className="truncate">Company: {c.company}</div>}
                    {c.email && <div className="truncate">Email: {c.email}</div>}
                    {c.website && (
                      <a
                        href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-primary hover:underline"
                      >
                        {c.website}
                      </a>
                    )}
                    {c.note && <div className="line-clamp-2">Note: {c.note}</div>}
                  </div>

                  {c.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="font-normal">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-4 hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={
                        pagedContacts.length > 0 && pagedContacts.every((c) => selected.has(c.id))
                      }
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
                pagedContacts.map((c) => (
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
                        <ConfirmAction
                          title="Delete contact?"
                          description="This contact will be removed from your saved list. Call history and billing records are not affected."
                          confirmLabel="Delete contact"
                          tone="destructive"
                          onConfirm={() => void remove(c.id)}
                        >
                          <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </ConfirmAction>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && filtered.length > 0 && (
        <div className="mt-4">
          <PaginationFooter
            page={currentPage}
            pageSize={CONTACTS_PAGE_SIZE}
            total={filtered.length}
            itemLabel="contact"
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-md overflow-y-auto">
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
function cleanCsvCell(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeCsvHeader(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

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
