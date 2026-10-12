import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function holdBalanceForCallTask(input: {
  userId: string;
  taskId: string;
  estimatedCost: number;
  isTest: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const { userId, taskId, estimatedCost, isTest } = input;

  if (isTest || estimatedCost <= 0) {
    return { ok: true };
  }

  const { data: held, error } = await supabaseAdmin.rpc("hold_credits_for_task", {
    _user_id: userId,
    _task_id: taskId,
    _estimated_cost: estimatedCost,
  });

  if (error || !held) {
    return {
      ok: false,
      error: "Insufficient credit balance for this call. Please top up your account.",
    };
  }

  return { ok: true };
}

export async function settleBalanceForCallTask(input: {
  taskId: string;
  actualCost: number;
  isTest: boolean;
}): Promise<void> {
  const { taskId, actualCost, isTest } = input;
  if (isTest) return;

  await supabaseAdmin.rpc("settle_task_balance", {
    _task_id: taskId,
    _actual_cost: actualCost,
  });
}

export async function releaseBalanceForCallTask(input: {
  taskId: string;
  isTest: boolean;
}): Promise<void> {
  const { taskId, isTest } = input;
  if (isTest) return;

  await supabaseAdmin.rpc("release_task_hold", {
    _task_id: taskId,
  });
}
