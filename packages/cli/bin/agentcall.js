#!/usr/bin/env node

const API_BASE = process.env.AGENTCALL_API_URL || process.env.RINGRINGA_API_URL || "https://agentcall.org/api/v1";
const API_KEY = process.env.AGENTCALL_API_KEY || process.env.RINGRINGA_API_KEY;

const args = process.argv.slice(2);
const command = args[0];
const isJson = args.includes("--json");

function getFlag(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return null;
}

async function api(path, method = "GET", body = null) {
  if (!API_KEY) {
    console.error("Error: AGENTCALL_API_KEY environment variable is not set.");
    process.exit(1);
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(`Error: ${data.error || res.statusText}`);
    process.exit(1);
  }
  return data;
}

async function main() {
  if (!command || command === "--help" || command === "help") {
    console.log(`
AgentCall CLI - Give your AI agent a phone

Usage:
  agentcall balance [--json]
  agentcall rates <number> [--json]
  agentcall call <number> --goal "..." --script "..." [--json]
  agentcall calls:list [--limit 10] [--json]
  agentcall calls:get <id> [--json]
  agentcall calls:cancel <id> [--json]
`);
    return;
  }

  if (command === "balance") {
    const data = await api("/balance");
    if (isJson) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Balance: $${data.available_balance.toFixed(2)} USD (Holds: $${data.active_holds.toFixed(2)})`);
    }
    return;
  }

  if (command === "rates") {
    const num = args[1];
    if (!num) {
      console.error("Please provide a phone number, e.g. agentcall rates +14155552671");
      process.exit(1);
    }
    const data = await api(`/rates?to=${encodeURIComponent(num)}`);
    if (isJson) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`Destination: ${data.destination} (${data.country_code})`);
      console.log(`Rate: $${data.rate_per_minute}/min`);
      console.log(`Estimated 15-min call: $${data.estimated_15min_cost}`);
    }
    return;
  }

  if (command === "call") {
    const num = args[1];
    const goal = getFlag("goal");
    const script = getFlag("script");
    const notes = getFlag("notes");

    if (!num) {
      console.error("Please provide a number: agentcall call +14155552671 --script '...'");
      process.exit(1);
    }

    const data = await api("/calls", "POST", {
      to: num,
      goal,
      script,
      notes,
      consent_attestation: true,
    });

    if (isJson) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`✓ Call queued for ${data.to}`);
      console.log(`  Task ID: ${data.id}`);
      console.log(`  Status:  ${data.status}`);
      console.log(`  Rate:    $${data.rate_per_minute}/min`);
    }
    return;
  }

  if (command === "calls:list") {
    const data = await api("/calls");
    if (isJson) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.table(data.data.map((c) => ({
        id: c.id,
        to: c.to_number,
        status: c.status,
        duration: `${c.duration_seconds}s`,
        cost: `$${c.cost}`,
      })));
    }
    return;
  }

  if (command === "calls:get") {
    const id = args[1];
    if (!id) {
      console.error("Provide call ID: agentcall calls:get <id>");
      process.exit(1);
    }
    const data = await api(`/calls/${id}`);
    console.log(JSON.stringify(data.data, null, 2));
    return;
  }

  if (command === "calls:cancel") {
    const id = args[1];
    if (!id) {
      console.error("Provide call ID: agentcall calls:cancel <id>");
      process.exit(1);
    }
    const data = await api(`/calls/${id}/cancel`, "POST");
    console.log(`✓ Call ${id} canceled`);
    return;
  }

  console.error(`Unknown command: ${command}. Run 'agentcall --help' for options.`);
}

main().catch(console.error);
