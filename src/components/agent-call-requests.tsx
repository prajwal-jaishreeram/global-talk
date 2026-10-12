import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Bot, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface AgentCallTask {
  id: string;
  to_number: string;
  from_number?: string | null;
  mode: string;
  status: string;
  goal?: string | null;
  script?: string | null;
  notes?: string | null;
  scheduled_for?: string | null;
  destination_timezone?: string | null;
  rate_per_minute: number;
  created_at: string;
}

interface AgentCallRequestsTrayProps {
  onAcceptCall: (task: AgentCallTask) => void;
}

export function AgentCallRequestsTray({ onAcceptCall }: AgentCallRequestsTrayProps) {
  const [tasks, setTasks] = useState<AgentCallTask[]>([]);

  async function loadPending() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data } = await supabase
      .from("call_tasks")
      .select("*")
      .eq("user_id", userData.user.id)
      .in("status", ["awaiting_human", "queued"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setTasks(data as AgentCallTask[]);
  }

  useEffect(() => {
    loadPending();

    // Listen to Supabase Realtime changes on call_tasks
    const channel = supabase
      .channel("call_tasks_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_tasks",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newTask = payload.new as AgentCallTask;
            setTasks((prev) => [newTask, ...prev]);
            toast.info(`New agent call request for ${newTask.to_number}!`);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as AgentCallTask;
            if (updated.status !== "awaiting_human" && updated.status !== "queued") {
              setTasks((prev) => prev.filter((t) => t.id !== updated.id));
            } else {
              setTasks((prev) =>
                prev.map((t) => (t.id === updated.id ? updated : t))
              );
            }
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            setTasks((prev) => prev.filter((t) => t.id !== old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleReject(id: string) {
    try {
      await supabase
        .from("call_tasks")
        .update({ status: "canceled", updated_at: new Date().toISOString() })
        .eq("id", id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast.success("Agent call rejected");
    } catch {
      toast.error("Failed to cancel task");
    }
  }

  if (tasks.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-3 font-semibold text-primary">
        <Bot className="h-5 w-5 animate-pulse" />
        <span>Pending Agent Call Requests ({tasks.length})</span>
      </div>

      <div className="flex flex-col gap-3">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-sm"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-semibold">{task.to_number}</span>
                {task.scheduled_for && (
                  <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> Scheduled: {new Date(task.scheduled_for).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              {task.goal && <p className="text-xs text-muted-foreground font-medium">Goal: {task.goal}</p>}
              {task.script && (
                <p className="text-xs text-muted-foreground line-clamp-1 italic">
                  "{task.script}"
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleReject(task.id)}
                className="text-xs text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-4 w-4 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                onClick={() => onAcceptCall(task)}
                className="text-xs gap-1.5 bg-primary font-medium"
              >
                <Phone className="h-4 w-4" /> Call Now
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
