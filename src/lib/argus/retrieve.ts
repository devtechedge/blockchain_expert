import { SWC_REGISTRY } from "./swc-registry.ts";
import type { SwcEntry } from "./types.ts";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "for",
  "with",
  "on",
  "is",
  "be",
  "by",
  "as",
  "that",
  "this",
  "from",
  "it",
  "are",
  "not",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function tf(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  const n = tokens.length || 1;
  for (const [k, v] of counts) counts.set(k, v / n);
  return counts;
}

const DOCS = SWC_REGISTRY.map((entry) => {
  const tokens = tokenize(`${entry.id} ${entry.title} ${entry.summary} ${entry.remediation} ${entry.cwe}`);
  return { entry, tokens, tf: tf(tokens) };
});

const DF = (() => {
  const df = new Map<string, number>();
  for (const doc of DOCS) {
    for (const term of new Set(doc.tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }
  return df;
})();

function idf(term: string): number {
  const df = DF.get(term) ?? 0;
  return Math.log((DOCS.length + 1) / (df + 1)) + 1;
}

function score(queryTf: Map<string, number>, docTf: Map<string, number>): number {
  let sum = 0;
  for (const [term, q] of queryTf) {
    const d = docTf.get(term);
    if (!d) continue;
    const w = idf(term);
    sum += q * w * d * w;
  }
  return sum;
}

export function retrieveSwc(query: string, k = 3): SwcEntry[] {
  const exact = SWC_REGISTRY.find((e) => e.id.toLowerCase() === query.trim().toLowerCase());
  if (exact) return [exact, ...SWC_REGISTRY.filter((e) => e.id !== exact.id).slice(0, k - 1)];
  const q = tf(tokenize(query));
  return DOCS.map((doc) => ({ entry: doc.entry, s: score(q, doc.tf) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .filter((row) => row.s > 0)
    .map((row) => row.entry);
}
