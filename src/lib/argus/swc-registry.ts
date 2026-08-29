import type { SwcEntry } from "./types.ts";

/**
 * Curated SWC registry subset used as the retrieval corpus.
 * Source of truth for titles: Smart Contract Weakness Classification (SWC).
 * This is a defensive knowledge base — not an offensive playbook.
 */
export const SWC_REGISTRY: SwcEntry[] = [
  {
    id: "SWC-100",
    title: "Function Default Visibility",
    cwe: "CWE-710",
    summary:
      "Functions without an explicit visibility specifier defaulted to public in older Solidity, unintentionally exposing internals.",
    remediation:
      "Declare visibility on every function. Prefer Solidity >= 0.5.0 which makes visibility mandatory.",
    references: ["https://swcregistry.io/docs/SWC-100"],
  },
  {
    id: "SWC-101",
    title: "Integer Overflow and Underflow",
    cwe: "CWE-190",
    summary:
      "Arithmetic on unsigned integers wrapped in compilers before 0.8.0, which can corrupt balances and allowances.",
    remediation:
      "Use Solidity >= 0.8.0 (built-in overflow checks) or a well-reviewed math library on older compilers.",
    references: ["https://swcregistry.io/docs/SWC-101"],
  },
  {
    id: "SWC-103",
    title: "Floating Pragma",
    cwe: "CWE-664",
    summary:
      "A floating pragma (^ or >=) lets the contract compile with a different compiler than the one it was reviewed against.",
    remediation:
      "Lock the pragma to a specific compiler version that matches the audit build (e.g. `pragma solidity 0.8.20;`).",
    references: ["https://swcregistry.io/docs/SWC-103"],
  },
  {
    id: "SWC-104",
    title: "Unchecked Call Return Value",
    cwe: "CWE-252",
    summary:
      "Low-level calls return a boolean instead of reverting. Ignoring it can continue execution after a failed send.",
    remediation:
      "Always check the returned boolean from `call` / `send`, or use `transfer` only when its gas stipend is acceptable.",
    references: ["https://swcregistry.io/docs/SWC-104"],
  },
  {
    id: "SWC-105",
    title: "Unprotected Ether Withdrawal",
    cwe: "CWE-284",
    summary:
      "A public function that transfers contract ether without authorization lets any caller empty the balance.",
    remediation:
      "Restrict withdrawals with access control and pull-payment patterns. Never expose raw balance drains.",
    references: ["https://swcregistry.io/docs/SWC-105"],
  },
  {
    id: "SWC-106",
    title: "Unprotected SELFDESTRUCT Instruction",
    cwe: "CWE-284",
    summary:
      "SELFDESTRUCT wipes code and sends remaining ether. If reachable without authorization, the contract can be destroyed.",
    remediation:
      "Avoid SELFDESTRUCT. If required, guard it with multi-step authorization and document the upgrade path.",
    references: ["https://swcregistry.io/docs/SWC-106"],
  },
  {
    id: "SWC-107",
    title: "Reentrancy",
    cwe: "CWE-841",
    summary:
      "An external call that happens before state updates lets the callee re-enter and observe stale storage.",
    remediation:
      "Follow checks-effects-interactions. Update storage first. Add a reentrancy guard on value-moving functions.",
    references: ["https://swcregistry.io/docs/SWC-107"],
  },
  {
    id: "SWC-112",
    title: "Delegatecall to Untrusted Callee",
    cwe: "CWE-829",
    summary:
      "DELEGATECALL runs callee code in the caller’s storage context. A user-supplied target can overwrite arbitrary slots.",
    remediation:
      "Delegate only to immutable, audited implementation addresses. Never forward user-controlled targets.",
    references: ["https://swcregistry.io/docs/SWC-112"],
  },
  {
    id: "SWC-115",
    title: "Authorization through tx.origin",
    cwe: "CWE-477",
    summary:
      "`tx.origin` is the original EOA. Using it for authorization lets an intermediate contract impersonate that EOA.",
    remediation:
      "Authorize with `msg.sender`. Never compare `tx.origin` to an owner or privileged role.",
    references: ["https://swcregistry.io/docs/SWC-115"],
  },
  {
    id: "SWC-116",
    title: "Block values as a proxy for time",
    cwe: "CWE-829",
    summary:
      "`block.timestamp` and `block.number` are miner-influenceable within protocol bounds and are a weak clock.",
    remediation:
      "Do not use block values as randomness. For time windows, document the allowed drift and avoid sub-minute precision.",
    references: ["https://swcregistry.io/docs/SWC-116"],
  },
  {
    id: "SWC-120",
    title: "Weak Sources of Randomness from Chain Attributes",
    cwe: "CWE-330",
    summary:
      "Hashing `block.timestamp`, `blockhash`, or `block.difficulty` is predictable to the producer of the block.",
    remediation:
      "Use a commit-reveal scheme or a verifiable randomness source. Never derive payouts from block attributes.",
    references: ["https://swcregistry.io/docs/SWC-120"],
  },
  {
    id: "SWC-128",
    title: "DoS With Block Gas Limit",
    cwe: "CWE-400",
    summary:
      "Unbounded loops over storage arrays can exceed the block gas limit and brick payouts or accounting.",
    remediation:
      "Bound loops, paginate processing, and prefer pull payments over iterating every account.",
    references: ["https://swcregistry.io/docs/SWC-128"],
  },
];

export const SWC_BY_ID: Record<string, SwcEntry> = Object.fromEntries(
  SWC_REGISTRY.map((entry) => [entry.id, entry]),
);

export function getSwc(id: string): SwcEntry | undefined {
  return SWC_BY_ID[id];
}
