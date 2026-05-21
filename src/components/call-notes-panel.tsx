import { useEffect, useRef, useState } from "react";
import {
  FileText,
  NotebookPen,
  Trash2,
  Download,
  Share2,
  Play,
  Pause,
  X,
  Gauge,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
  onClose,
}: {
  inCall: boolean;
  peerNumber?: string;
  onClose?: () => void;
}) {
  const [script, setScript] = useLocal(SCRIPT_KEY);
  const [notes, setNotes] = useLocal(NOTES_KEY);
  const [tab, setTab] = useState<"script" | "notes">("script");
  const [autoScroll, setAutoScroll] = useState(false);
  const [speed, setSpeed] = useState(30); // px per second
  const scriptRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-switch to notes when call becomes active
  useEffect(() => {
    if (inCall) setTab((t) => (t === "script" && notes.length === 0 ? t : "notes"));
  }, [inCall, notes.length]);

  // Auto-scroll loop for script
  useEffect(() => {
    if (!autoScroll || tab !== "script") return;
    const el = scriptRef.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0; // accumulate sub-pixel scroll so slow speeds still move
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      acc += speed * dt;
      if (acc >= 1) {
        const whole = Math.floor(acc);
        el.scrollTop += whole;
        acc -= whole;
      }
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setAutoScroll(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [autoScroll, speed, tab]);

  async function share(kind: "script" | "notes") {
    const text = kind === "script" ? script : notes;
    if (!text) return toast.error(`${kind === "script" ? "Script" : "Notes"} is empty`);
    const title = kind === "script" ? "Call script" : "Call notes";
    const payload = { title, text };
    const canShare =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (typeof (navigator as any).canShare !== "function" ||
        (navigator as any).canShare(payload));
    if (canShare) {
      try {
        await navigator.share(payload);
        return;
      } catch (err: any) {
        // User cancelled — don't fall back, don't error.
        if (err?.name === "AbortError") return;
        // Otherwise (NotAllowedError in iframes, etc.) fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${title} copied to clipboard`);
    } catch {
      toast.error("Could not share. Try Export instead.");
    }
  }

  function exportText(kind: "script" | "notes") {
    const text = kind === "script" ? script : notes;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const header = `# Call ${kind}\nDate: ${new Date().toLocaleString()}\n${
      peerNumber ? `To: ${peerNumber}\n` : ""
    }\n`;
    const blob = new Blob([header + (text || "(empty)")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ringlink-${kind}-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${kind === "script" ? "Script" : "Notes"} downloaded`);
  }

  return (
    <aside className="flex w-full flex-col rounded-2xl border border-border bg-card/50 p-3 shadow-sm lg:max-w-[340px] lg:self-stretch">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "script" | "notes")}
        className="flex flex-1 flex-col"
      >
        <div className="flex items-center gap-2">
          <TabsList className="grid flex-1 grid-cols-2">
            <TabsTrigger value="script" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Script
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <NotebookPen className="h-3.5 w-3.5" /> Notes
            </TabsTrigger>
          </TabsList>
          {onClose && (
            <button
              onClick={onClose}
              className="hidden h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:grid"
              aria-label="Close panel"
              title="Hide panel"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <TabsContent value="script" className="mt-3 flex flex-1 flex-col gap-2">
          <p className="px-1 text-xs text-muted-foreground">
            Paste a script to read while on the call. Auto-saved to this browser.
          </p>
          <Textarea
            ref={scriptRef}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder={`Hi, this is [your name] from [company]…\n\n• Reason for call\n• Key points\n• Closing line`}
            className={`min-h-[320px] flex-1 resize-none font-sans text-sm leading-relaxed lg:min-h-[420px] ${
              inCall ? "text-base leading-7" : ""
            }`}
          />

          {/* Auto-scroll controls */}
          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
            <Button
              size="sm"
              variant={autoScroll ? "default" : "outline"}
              onClick={() => setAutoScroll((a) => !a)}
              disabled={!script}
              className="h-8 gap-1.5 text-xs"
            >
              {autoScroll ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {autoScroll ? "Pause" : "Auto-scroll"}
            </Button>
            <div className="flex flex-1 items-center gap-2">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
              <Slider
                value={[speed]}
                min={10}
                max={120}
                step={5}
                onValueChange={(v) => setSpeed(v[0] ?? 30)}
                className="flex-1"
                aria-label="Scroll speed"
              />
              <span className="w-12 text-right font-mono text-[10px] text-muted-foreground">
                {speed}px/s
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{script.length} chars · auto-saved</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => share("script")}
                disabled={!script}
                className="h-7 gap-1 text-xs"
              >
                <Share2 className="h-3 w-3" /> Share
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => exportText("script")}
                disabled={!script}
                className="h-7 gap-1 text-xs"
              >
                <Download className="h-3 w-3" /> Export
              </Button>
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
            className="min-h-[320px] flex-1 resize-none text-sm leading-relaxed lg:min-h-[420px]"
          />
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{notes.length} chars · auto-saved</span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => share("notes")}
                disabled={!notes}
                className="h-7 gap-1 text-xs"
              >
                <Share2 className="h-3 w-3" /> Share
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => exportText("notes")}
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
