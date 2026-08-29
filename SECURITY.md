# Security

Argus is a **defensive, offline static-analysis assistant**. It is designed for educational review and for auditors who want a deterministic first pass over Solidity source. It is not a professional audit, not an authorization to deploy, and not an offering of any token or service.

## What this repository is

- A TypeScript analyzer plus a Next.js workbench.
- A curated SWC knowledge base and an MCP-shaped local tool host.
- Educational Solidity fixtures under `benchmarks/educational_samples/`.

## What this repository is not

- Not a chain client. There is no RPC URL, no wallet connect, no signing, no airdrop, no claim flow.
- Not an exploit kit. Fixtures are labeled `vulnerability_sample` / `security_evaluator` and must not be deployed.
- Not a place to store secrets. Copy `.env.example` locally. Never commit API keys.

## Threat model (honest)

| Area | Stance |
|------|--------|
| Secrets | No keys in git. Optional `XAI_API_KEY` is local-only and unused on the public Vercel demo. |
| XSS | Source is rendered as text in a textarea / `<pre>`. Do not `dangerouslySetInnerHTML` on contract text. |
| Injection | The analyzer is a local string/AST-lite pass. It does not `eval` user source. |
| Network | CI and the public demo do not open blockchain RPC connections and do not auto-sign anything. |
| Supply chain | `npm ci` in CI. Dependabot majors are ignored if Dependabot is enabled. |

## Reporting

If you find a vulnerability in Argus itself (the analyzer, the workbench, or CI), open a private GitHub security advisory on this repository. Do not file a public issue with a working proof against a live protocol.

Please do **not** send reports that amount to “this educational fixture is unsafe if deployed.” That is the point of the fixture, and every sample file says so in its header.
