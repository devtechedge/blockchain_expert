# Argus architecture

Argus is a local-first audit copilot. The interesting part is the engine, not a wrapper around a node.

```
INGEST → PARSE → STATIC_SCAN → RAG_ENRICH → FP_FILTER
       → SEVERITY_RANK → PATCH_DRAFT → HITL_GATE → REPORT
```

Optional LLM review is a refinement of **existing** findings. It cannot invent new ones, and it is skipped on the public demo.

## Layers

| Path | Role |
|------|------|
| `src/lib/argus/parse.ts` | Comment-masking, pragma, function and state-var extraction |
| `src/lib/argus/detectors.ts` | Deterministic SWC detectors (CEI, tx.origin, delegatecall, …) |
| `src/lib/argus/retrieve.ts` | Offline TF-IDF over a curated SWC registry |
| `src/lib/argus/agent.ts` | Explicit nine-phase state machine + trace events |
| `src/lib/argus/mcp-tools.ts` | JSON-RPC 2.0 subset (`tools/list`, `tools/call`) |
| `src/lib/argus/patches.ts` | Remediation diff drafts |
| `src/cli.ts` | `npm run scan -- path.sol` |
| `src/app` | Next.js HITL workbench (demo-mode on Vercel) |

## MCP tools

- `static_scan` — run the analyzer
- `lookup_swc` — fetch an SWC entry by id
- `retrieve_swc` — TF-IDF retrieve against the registry

No tool opens an RPC connection or signs a transaction.

## Educational fixtures

`benchmarks/educational_samples/` holds labeled `vulnerability_sample` contracts plus a hardened control. Each file starts with:

```
FOR EDUCATIONAL AND STATIC AUDIT TESTING PURPOSES ONLY.
DO NOT DEPLOY TO ANY NETWORK.
```

## What is out of scope

Slither/Aderyn orchestration, live-chain monitoring, and wallet flows. Those belong behind a real audit desk, not in this demo.
