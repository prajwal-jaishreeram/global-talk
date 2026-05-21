import { useEffect, useState } from "react";
import { FileText, NotebookPen, Save, Trash2, Download } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const SCRIPT_KEY = "ringlink.callScript";
const NOTES_KEY = "ringlink.callNotes";

function useLocal(key: string) {
  const [val, setVal] = useState("");
  useEffect(() => {
    try {
      setVal(window.localStorage.getItem(key) ?? "");
    } catch {}
  }, [key]);
  useEffect(() => {
    try {
      window.localStorage.setItem(key, val);
    } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}

export function CallNotesPanel({
  inCall,
  peerNumber,
}: {
  inCall: boolean;
  peerNumber?: string;
}) {
  const [script, setScript] = useLocal(SCRIPT_KEY);
  const [notes, setNotes] = useLocal(NOTES_KEY);
  const [tab, setTab] = useState<"script" | "notes">("script");

  // Auto-switch to notes when call becomes active so user can jot down
  useEffect(() => {
    if (inCall) setTab((t) => (t === "script" && notes.length === 0 ? t : "notes"));
  }, [inCall, notes.length]);

  function exportNotes() {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const header = `# Call notes\nDate: ${new Date().toLocaleString()}\n${
      peerNumber ? `To: ${peerNumber}\n` : ""
    }\n`;
    const blob = new Blob([header + (notes || "(empty)")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ringlink-notes-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Notes downloaded");
  }

  return (
    <aside className="flex w-full max-w-[420px] flex-col rounded-2xl border border-border bg-card/50 p-3 shadow-sm lg:max-w-[440px] lg:self-stretch">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "script" | "notes")} className="flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="script" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Script
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <NotebookPen className="h-3.5 w-3.5" /> Notes
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="script" className="mt-3 flex flex-1 flex-col gap-2">
          <p className="px-1 text-xs text-muted-foreground">
            Paste a script to read while on the call. Auto-saved to this browser.
          </p>
          <Textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={`Hi, this is [your name] from [company]…\n\n• Reason for call\n• Key points\n• Closing line`}
            className={`min-h-[260px] flex-1 resize-none font-sans text-sm leading-relaxed ${
              inCall ? "text-base leading-7" : ""
            }`}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{script.length} chars · auto-saved</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm("Clear script?")) setScript("");
              }}
              className="h-7 gap-1 text-xs"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-3 flex flex-1 flex-col gap-2">
          <p className="px-1 text-xs text-muted-foreground">
            Jot down notes during or after the call. Auto-saved locally.
          </p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Call notes, action items, follow-ups…"
            className="min-h-[260px] flex-1 resize-none text-sm leading-relaxed"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{notes.length} chars · auto-saved</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={exportNotes}
                disabled={!notes}
                className="h-7 gap-1 text-xs"
              >
                <Download className="h-3 w-3" /> Export
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm("Clear notes?")) setNotes("");
                }}
                className="h-7 gap-1 text-xs"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

// keep Save icon import used (lint)
export const _save = Save;