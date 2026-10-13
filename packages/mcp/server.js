#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const API_BASE = process.env.AGENTCALL_API_URL || process.env.RINGRINGA_API_URL || "https://agentcall.org/api/v1";
const API_KEY = process.env.AGENTCALL_API_KEY || process.env.RINGRINGA_API_KEY;

if (!API_KEY) {
  console.error("Error: AGENTCALL_API_KEY (or RINGRINGA_API_KEY) environment variable is required.");
  process.exit(1);
}

const server = new Server(
  {
    name: "agentcall-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "place_call",
        description:
          "Queue a phone call to a recipient. In assisted mode, a human agent in the browser dialer speaks. Note: Calls cost money, require explicit consent, and emergency numbers are blocked.",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              type: "string",
              description: "Destination phone number in E.164 format (e.g. +14155552671)",
            },
            goal: {
              type: "string",
              description: "Goal of the call (e.g. Schedule a demo)",
            },
            script: {
              type: "string",
              description: "The script or talking points for the human speaker",
            },
            notes: {
              type: "string",
              description: "Additional notes or context",
            },
            consent_attestation: {
              type: "boolean",
              description: "Certify that you have lawful consent to call this recipient",
            },
          },
          required: ["to", "consent_attestation"],
        },
      },
      {
        name: "get_call",
        description: "Get call details, status, duration, and cost by call ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The call task ID",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "get_balance",
        description: "Get the current prepaid credit balance in USD.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_rates",
        description: "Get the per-minute rate and cost estimate for a destination phone number.",
        inputSchema: {
          type: "object",
          properties: {
            to: {
              type: "string",
              description: "Destination phone number in E.164 format",
            },
          },
          required: ["to"],
        },
      },
      {
        name: "cancel_call",
        description: "Cancel a pending or scheduled call task and release the balance hold.",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "The call task ID to cancel",
            },
          },
          required: ["id"],
        },
      },
    ],
  };
});

// Handle Tool Execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  async function apiFetch(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || `Request failed with status ${res.status}`);
    }
    return json;
  }

  try {
    if (name === "place_call") {
      const data = await apiFetch("/calls", {
        method: "POST",
        body: JSON.stringify(args),
      });
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === "get_call") {
      const data = await apiFetch(`/calls/${args.id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === "get_balance") {
      const data = await apiFetch("/balance");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === "get_rates") {
      const data = await apiFetch(`/rates?to=${encodeURIComponent(args.to)}`);
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    if (name === "cancel_call") {
      let data;
      try {
        data = await apiFetch(`/calls/${args.id}`, {
          method: "POST",
          body: JSON.stringify({ action: "cancel" }),
        });
      } catch (err) {
        data = await apiFetch(`/calls/${args.id}/cancel`, {
          method: "POST",
        });
      }
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${err.message}` }],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
