import { runDeterministicPipeline } from "./agent.ts";
import { retrieveSwc } from "./retrieve.ts";
import { getSwc } from "./swc-registry.ts";

/**
 * MCP-shaped tool host (JSON-RPC 2.0 subset).
 * Argus never opens a chain RPC. Tools are local, read-only, and schema-validated.
 */
export const MCP_TOOLS = [
  {
    name: "static_scan",
    description: "Run the deterministic Solidity static analyzer and return SWC-mapped findings.",
    inputSchema: {
      type: "object",
      required: ["source", "filename"],
      properties: {
        source: { type: "string", description: "Solidity source text" },
        filename: { type: "string", description: "Display filename" },
      },
    },
  },
  {
    name: "lookup_swc",
    description: "Fetch a Smart Contract Weakness Classification entry by id (e.g. SWC-107).",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    },
  },
  {
    name: "retrieve_swc",
    description: "TF-IDF retrieve SWC entries for a free-text query. Offline corpus, no embeddings API.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        k: { type: "number" },
      },
    },
  },
] as const;

export type McpRequest = {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
};

export type McpResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

export function handleMcp(request: McpRequest): McpResponse {
  const { id, method, params = {} } = request;
  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
  }
  if (method !== "tools/call") {
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method ${method}` } };
  }
  const name = String(params.name ?? "");
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  try {
    if (name === "static_scan") {
      const source = String(args.source ?? "");
      const filename = String(args.filename ?? "input.sol");
      if (!source.trim()) throw new Error("source is required");
      return { jsonrpc: "2.0", id, result: runDeterministicPipeline(source, filename) };
    }
    if (name === "lookup_swc") {
      const entry = getSwc(String(args.id ?? ""));
      if (!entry) throw new Error("unknown SWC id");
      return { jsonrpc: "2.0", id, result: entry };
    }
    if (name === "retrieve_swc") {
      const hits = retrieveSwc(String(args.query ?? ""), Number(args.k ?? 3));
      return { jsonrpc: "2.0", id, result: hits };
    }
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool ${name}` } };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: err instanceof Error ? err.message : "tool error" },
    };
  }
}
