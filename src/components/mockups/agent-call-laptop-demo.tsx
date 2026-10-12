import { useEffect, useState } from "react";
import { LaptopMockupCard } from "@/components/mockups/laptop-mockup-card";
import { Bot, Phone, CheckCircle2, Mic, Sparkles } from "lucide-react";

export function AgentCallLaptopDemo() {
  const [step, setStep] = useState<number>(0);

  // Stepper simulating Agent queuing -> Dialer ringing -> Human connected
  useEffect(() => {
    const timer = setInterval(() => {
      setStep((prev) => (prev + 1) % 3);
    }, 3600);
    return () => clearInterval(timer);
  }, []);

  return (
    <LaptopMockupCard variant="titanium" className="w-full">
      <div className="flex h-full w-full flex-col bg-card dark:bg-[#111115] text-foreground font-sans select-none overflow-hidden text-left">
        {/* Browser Mock Top Bar */}
        <div className="flex h-8 items-center justify-between border-b border-border bg-muted/40 px-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-[#27C93F]/80" />
          </div>
          <div className="mono text-[10px] text-muted-foreground bg-background px-3 py-0.5 rounded border border-border truncate max-w-[180px]">
            ringringa.com/dashboard
          </div>
          <div className="mono text-[10px] text-muted-foreground">TLS 1.3</div>
        </div>

        {/* Dashboard Simulation Content */}
        <div className="flex flex-1 flex-col p-4 md:p-5 justify-between">
          {/* Top Status */}
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <span className="serif font-semibold text-sm">RINGRINGA</span>
              <span className="mono text-[9px] bg-foreground text-background px-1.5 py-0.2 uppercase font-bold">LIVE</span>
            </div>
            <div className="mono text-[10px] text-muted-foreground">
              BALANCE: <span className="font-bold text-foreground">$48.50 USD</span>
            </div>
          </div>

          {/* Stepper Display */}
          <div className="my-auto space-y-3">
            {step === 0 && (
              <div className="rounded-lg border border-border bg-background p-3 shadow-xs animate-in fade-in duration-500">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-dashed border-border">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8B6B55] dark:text-[#C9A690]">
                    <Bot className="h-3.5 w-3.5" />
                    <span>Claude Agent Triggered Call</span>
                  </div>
                  <span className="mono text-[9px] bg-muted px-1.5 py-0.5 rounded text-foreground font-medium">
                    POST /v1/calls
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between mono text-[10px]">
                    <span className="text-muted-foreground">Destination:</span>
                    <span className="font-bold text-foreground">+1 (415) 555-2671 (San Francisco, CA)</span>
                  </div>
                  <div className="flex justify-between mono text-[10px]">
                    <span className="text-muted-foreground">Goal:</span>
                    <span className="italic text-foreground">"Pitch custom AI agent workflow to founder"</span>
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 shadow-xs animate-in fade-in duration-500">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-dashed border-amber-500/20">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Awaiting Human Connection</span>
                  </div>
                  <span className="mono text-[9px] bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-bold">
                    PRE-LOADED
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <p className="text-[11px] text-foreground font-medium line-clamp-2">
                    Script loaded: "Hi Sarah, our AI found your team is looking to automate outbound calling..."
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button className="mono text-[10px] bg-foreground text-background px-3 py-1 font-semibold flex items-center gap-1 cursor-pointer">
                      <Phone className="h-3 w-3" /> CONNECT CALL
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-xs animate-in fade-in duration-500">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-dashed border-emerald-500/20">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    <Mic className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                    <span>Call in Progress (Human Speaking)</span>
                  </div>
                  <span className="mono text-[9px] bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-1.5 py-0.5 rounded font-bold">
                    01:42 · HD AUDIO
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between mono text-[10px]">
                    <span className="text-muted-foreground">Rate:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-300">$0.02 / min</span>
                  </div>
                  <div className="flex justify-between mono text-[10px]">
                    <span className="text-muted-foreground">Webhook:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">call.started dispatched ✓</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Indicators */}
          <div className="flex items-center justify-between border-t border-border pt-2 mono text-[9px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>DIALER READY</span>
            </div>
            <span>STAGES: AGENT QUEUES → HUMAN TALKS → SETTLED</span>
          </div>
        </div>
      </div>
    </LaptopMockupCard>
  );
}
