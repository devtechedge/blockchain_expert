import { functionHasModifier, looksLikeOwnerGuard, snippetFor } from "./parse.ts";
import type { Finding, ParsedContract, ParsedFunction, ReviewVerdict, Severity } from "./types.ts";

type Draft = Omit<Finding, "id" | "verdict" | "verdictNote" | "hitl" | "patch" | "ragHits">;

const DELEGATE_RE = /\.delegatecall\s*(?:\{[^}]*\})?\s*\(/g;
const VALUE_CALL_RE = /\.call\s*\{[^}]*value\s*:|\.transfer\s*\(|\.send\s*\(/g;
const SELFDESTRUCT_RE = /\b(?:selfdestruct|suicide)\s*\(/g;
const TX_ORIGIN_RE = /\btx\.origin\b/g;
const TIMESTAMP_RAND_RE =
  /(?:keccak256|sha256|abi\.encodePacked)\s*\([^;]*block\.(?:timestamp|number|difficulty|prevrandao|hash)/g;
const TIMESTAMP_RE = /\bblock\.(?:timestamp|number)\b/g;
const UNBOUNDED_FOR_RE = /for\s*\([^;]*;\s*[^;]*\.(?:length)\s*;/;

function relativeLine(fn: ParsedFunction, indexInBody: number): number {
  const prefix = fn.body.slice(0, indexInBody);
  const extra = prefix.split("\n").length - 1;
  return fn.startLine + extra;
}

function storageWriteIndexes(fn: ParsedFunction, stateNames: string[]): number[] {
  const indexes: number[] = [];
  const names = stateNames.length ? stateNames : ["balances", "balance", "owner", "total", "shares"];
  for (const name of names) {
    const re = new RegExp(
      `\\b${name}\\b(?:\\s*\\[[^\\]]*\\])*\\s*(?:\\+\\+|--|=|\\+=|-=|\\*=|/=)`,
      "g",
    );
    let match: RegExpExecArray | null;
    while ((match = re.exec(fn.body))) {
      indexes.push(match.index);
    }
  }
  return indexes;
}

function allMatches(re: RegExp, text: string): RegExpExecArray[] {
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  const out: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = copy.exec(text))) out.push(match);
  return out;
}

function makeDraft(
  contract: ParsedContract,
  fn: ParsedFunction | null,
  partial: {
    detector: string;
    swcId: string;
    title: string;
    severity: Severity;
    confidence: number;
    lineStart: number;
    lineEnd?: number;
    rationale: string;
    recommendation: string;
    guarded?: boolean;
  },
): Draft {
  const lineEnd = partial.lineEnd ?? partial.lineStart;
  return {
    detector: partial.detector,
    swcId: partial.swcId,
    title: partial.title,
    severity: partial.severity,
    confidence: partial.confidence,
    lineStart: partial.lineStart,
    lineEnd,
    functionName: fn?.name ?? "—",
    snippet: snippetFor(contract, partial.lineStart, lineEnd),
    rationale: partial.rationale,
    recommendation: partial.recommendation,
    guarded: partial.guarded ?? false,
  };
}

function detectReentrancy(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  const stateNames = contract.stateVars.map((v) => v.name);
  for (const fn of contract.functions) {
    if (fn.mutability === "view" || fn.mutability === "pure") continue;
    const calls = allMatches(VALUE_CALL_RE, fn.body);
    if (calls.length === 0) continue;
    const writes = storageWriteIndexes(fn, stateNames);
    const guarded = functionHasModifier(fn, ["nonReentrant", "nonreentrant", "lock", "noReentrancy"]);
    for (const call of calls) {
      const writesAfter = writes.filter((w) => w > call.index);
      if (writesAfter.length === 0 && !guarded) continue;
      if (writesAfter.length === 0 && guarded) continue;
      const line = relativeLine(fn, call.index);
      drafts.push(
        makeDraft(contract, fn, {
          detector: "reentrancy-cei",
          swcId: "SWC-107",
          title: "External call before storage update (CEI)",
          severity: guarded ? "low" : "critical",
          confidence: guarded ? 0.55 : 0.9,
          lineStart: line,
          lineEnd: Math.min(fn.endLine, line + 3),
          guarded,
          rationale: guarded
            ? `${fn.name} performs an external call before a storage write, but a reentrancy modifier is present. Still a CEI smell; treat as a residual finding.`
            : `${fn.name} sends value, then updates storage. A re-entering callee can observe stale balances.`,
          recommendation:
            "Apply checks-effects-interactions: update balances first, then perform the external call. Keep a reentrancy guard on value-moving functions.",
        }),
      );
    }
  }
  return drafts;
}

function detectTxOrigin(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    const hits = allMatches(TX_ORIGIN_RE, fn.body);
    for (const hit of hits) {
      const line = relativeLine(fn, hit.index);
      drafts.push(
        makeDraft(contract, fn, {
          detector: "tx-origin-auth",
          swcId: "SWC-115",
          title: "Authorization uses tx.origin",
          severity: "high",
          confidence: 0.95,
          lineStart: line,
          rationale: `${fn.name} reads tx.origin. An intermediate contract can inherit the original EOA’s identity.`,
          recommendation: "Replace tx.origin with msg.sender for all authorization checks.",
        }),
      );
    }
  }
  return drafts;
}

function detectUncheckedCall(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    const hits = allMatches(/\.(?:call|send)\s*(?:\{[^}]*\})?\s*\(/g, fn.body);
    for (const hit of hits) {
      const window = fn.body.slice(Math.max(0, hit.index - 80), hit.index + 160);
      const assigned = /\((?:\s*bool|\s*\w+\s*,)/.test(window) && /require\s*\(/.test(fn.body);
      const requires = /require\s*\(\s*(ok|success|sent|result)\b/.test(fn.body);
      if (assigned && requires) continue;
      const line = relativeLine(fn, hit.index);
      drafts.push(
        makeDraft(contract, fn, {
          detector: "unchecked-call",
          swcId: "SWC-104",
          title: "Low-level call return value not required",
          severity: "medium",
          confidence: 0.72,
          lineStart: line,
          rationale: `${fn.name} performs a low-level call. The return boolean does not appear to gate execution with require.`,
          recommendation: "Capture the boolean and `require(success, reason)` before continuing.",
        }),
      );
    }
  }
  return drafts;
}

function detectDelegatecall(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    const hits = allMatches(DELEGATE_RE, fn.body);
    for (const hit of hits) {
      const line = relativeLine(fn, hit.index);
      const userTarget = fn.params.includes("address") || /delegatecall/.test(fn.body);
      drafts.push(
        makeDraft(contract, fn, {
          detector: "delegatecall-target",
          swcId: "SWC-112",
          title: "DELEGATECALL to a runtime target",
          severity: userTarget ? "critical" : "high",
          confidence: 0.84,
          lineStart: line,
          rationale: `${fn.name} uses delegatecall. If the target is caller-controlled, callee code writes this contract’s storage.`,
          recommendation:
            "Delegate only to an immutable implementation set at construction. Do not accept a target address from the caller.",
        }),
      );
    }
  }
  return drafts;
}

function detectSelfdestruct(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    const hits = allMatches(SELFDESTRUCT_RE, fn.body);
    for (const hit of hits) {
      const guarded = looksLikeOwnerGuard(fn);
      const line = relativeLine(fn, hit.index);
      drafts.push(
        makeDraft(contract, fn, {
          detector: "unprotected-selfdestruct",
          swcId: "SWC-106",
          title: guarded ? "Authorized SELFDESTRUCT present" : "Unprotected SELFDESTRUCT",
          severity: guarded ? "medium" : "critical",
          confidence: guarded ? 0.7 : 0.93,
          lineStart: line,
          guarded,
          rationale: guarded
            ? `${fn.name} can destroy the contract. Access control is present, but SELFDESTRUCT remains a one-way risk.`
            : `${fn.name} can destroy the contract without a clear owner check.`,
          recommendation:
            "Prefer upgradeable-proxy patterns without SELFDESTRUCT. If it must exist, require multi-step governance.",
        }),
      );
    }
  }
  return drafts;
}

function detectUnprotectedWithdraw(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    if (!["public", "external", "default"].includes(fn.visibility)) continue;
    if (looksLikeOwnerGuard(fn)) continue;
    if (functionHasModifier(fn, ["nonReentrant"])) {
      /* still relevant if it drains contract balance rather than msg.sender accounting */
    }
    const sendsValue = VALUE_CALL_RE.test(fn.body);
    VALUE_CALL_RE.lastIndex = 0;
    if (!sendsValue) continue;
    const usesAccounting = /balances\s*\[/.test(fn.body);
    const drainsContract =
      /address\s*\(\s*this\s*\)\s*\.balance/.test(fn.body) ||
      (!usesAccounting && /(withdraw|drain|collect|claim)/i.test(fn.name));
    if (!drainsContract && usesAccounting) continue;
    if (!drainsContract && !usesAccounting && !/(withdraw|drain|collect)/i.test(fn.name)) continue;
    drafts.push(
      makeDraft(contract, fn, {
        detector: "unprotected-withdraw",
        swcId: "SWC-105",
        title: "Unprotected ether withdrawal",
        severity: "critical",
        confidence: 0.8,
        lineStart: fn.signatureLine,
        lineEnd: fn.startLine,
        rationale: `${fn.name} can move ether and has no owner/role guard. Any caller may trigger the transfer.`,
        recommendation: "Add access control, or restrict withdrawals to a per-account pull balance that is updated first.",
      }),
    );
  }
  return drafts;
}

function detectTimestampRandomness(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    const randHits = allMatches(TIMESTAMP_RAND_RE, fn.body);
    for (const hit of randHits) {
      drafts.push(
        makeDraft(contract, fn, {
          detector: "weak-randomness",
          swcId: "SWC-120",
          title: "Block attribute used as randomness",
          severity: "high",
          confidence: 0.86,
          lineStart: relativeLine(fn, hit.index),
          rationale: `${fn.name} hashes a block attribute. Block producers can bias this value.`,
          recommendation: "Use commit-reveal or a verifiable randomness source. Do not pay out from block attributes.",
        }),
      );
    }
    if (randHits.length) continue;
    const timeHits = allMatches(TIMESTAMP_RE, fn.body);
    if (timeHits.length && /random|lottery|winner|seed/i.test(fn.name + fn.body)) {
      drafts.push(
        makeDraft(contract, fn, {
          detector: "timestamp-proxy",
          swcId: "SWC-116",
          title: "Block timestamp used as a time/random proxy",
          severity: "medium",
          confidence: 0.68,
          lineStart: relativeLine(fn, timeHits[0].index),
          rationale: `${fn.name} depends on block.timestamp in a context that looks like selection or seeding.`,
          recommendation: "Document acceptable drift, and never treat timestamp as a random seed.",
        }),
      );
    }
  }
  return drafts;
}

function detectFloatingPragma(contract: ParsedContract): Draft[] {
  if (!contract.floatingPragma) return [];
  return [
    makeDraft(contract, null, {
      detector: "floating-pragma",
      swcId: "SWC-103",
      title: "Floating Solidity pragma",
      severity: "low",
      confidence: 0.99,
      lineStart: contract.pragmaLine,
      rationale: `Pragma '${contract.pragma}' allows compilation with a different compiler than the one this review assumed.`,
      recommendation: "Pin the pragma to the exact compiler version used in CI and in the audit build.",
    }),
  ];
}

function detectIntegerOverflow(contract: ParsedContract): Draft[] {
  if (contract.compilerMajor > 0 && (contract.compilerMajor > 0 && contract.compilerMajor * 10 + contract.compilerMinor >= 8)) {
    if (!(contract.compilerMajor === 0 || contract.compilerMajor < 8)) return [];
  }
  if (contract.compilerMajor >= 8) return [];
  if (contract.compilerMajor === 0) return [];
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    if (!/[\+\-\*\/]=|\+\+|--/.test(fn.body)) continue;
    drafts.push(
      makeDraft(contract, fn, {
        detector: "integer-overflow",
        swcId: "SWC-101",
        title: "Arithmetic on a pre-0.8 compiler",
        severity: "high",
        confidence: 0.7,
        lineStart: fn.signatureLine,
        rationale: `${fn.name} mutates numeric storage under pragma ${contract.pragma}, which does not insert overflow checks.`,
        recommendation: "Compile with Solidity >= 0.8.0 or wrap arithmetic in a reviewed math library.",
      }),
    );
  }
  return drafts;
}

function detectDefaultVisibility(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    if (fn.visibility !== "default") continue;
    if (["constructor", "fallback", "receive"].includes(fn.name)) continue;
    drafts.push(
      makeDraft(contract, fn, {
        detector: "default-visibility",
        swcId: "SWC-100",
        title: "Function visibility not declared",
        severity: "medium",
        confidence: 0.9,
        lineStart: fn.signatureLine,
        rationale: `${fn.name} has no visibility specifier. On older compilers this defaulted to public.`,
        recommendation: "Add an explicit public/external/internal/private specifier to every function.",
      }),
    );
  }
  return drafts;
}

function detectUnboundedLoop(contract: ParsedContract): Draft[] {
  const drafts: Draft[] = [];
  for (const fn of contract.functions) {
    if (!UNBOUNDED_FOR_RE.test(fn.body)) continue;
    drafts.push(
      makeDraft(contract, fn, {
        detector: "unbounded-loop",
        swcId: "SWC-128",
        title: "Unbounded loop over storage length",
        severity: "medium",
        confidence: 0.74,
        lineStart: fn.signatureLine,
        rationale: `${fn.name} iterates a storage .length bound that can grow without a cap, risking block-gas DoS.`,
        recommendation: "Cap iterations, paginate, or switch to pull payments.",
      }),
    );
  }
  return drafts;
}

const DETECTORS: Array<(c: ParsedContract) => Draft[]> = [
  detectReentrancy,
  detectTxOrigin,
  detectUncheckedCall,
  detectDelegatecall,
  detectSelfdestruct,
  detectUnprotectedWithdraw,
  detectTimestampRandomness,
  detectFloatingPragma,
  detectIntegerOverflow,
  detectDefaultVisibility,
  detectUnboundedLoop,
];

export function runDetectors(contract: ParsedContract): Draft[] {
  return DETECTORS.flatMap((detect) => detect(contract));
}

export function defaultVerdict(draft: Draft): { verdict: ReviewVerdict; note: string } {
  if (draft.guarded && draft.severity !== "critical") {
    return {
      verdict: "likely_false_positive",
      note: "A guard modifier is present. Residual smell, not an immediate path.",
    };
  }
  if (draft.confidence >= 0.85 && (draft.severity === "critical" || draft.severity === "high")) {
    return { verdict: "confirmed", note: "High-confidence deterministic match against a classic SWC pattern." };
  }
  if (draft.confidence < 0.7) {
    return { verdict: "needs_human_review", note: "Heuristic match — confirm against surrounding control flow." };
  }
  return { verdict: "needs_human_review", note: "Pattern matched; reviewer should confirm context." };
}
