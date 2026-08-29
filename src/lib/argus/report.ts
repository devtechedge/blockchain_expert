import type { AuditRun, Finding, Severity } from "./types.ts";

const ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of findings) counts[f.severity] += 1;
  return counts;
}

export function summarizeRun(run: Pick<AuditRun, "filename" | "contractName" | "pragma" | "findings">): string {
  const counts = countBySeverity(run.findings);
  const open = run.findings.filter((f) => f.hitl !== "dismissed");
  const confirmed = open.filter((f) => f.verdict === "confirmed").length;
  const fp = open.filter((f) => f.verdict === "likely_false_positive").length;
  return [
    `${run.contractName} (${run.filename}, pragma ${run.pragma})`,
    `${open.length} open findings · ${confirmed} confirmed · ${fp} likely false-positive`,
    `Severity: C${counts.critical} H${counts.high} M${counts.medium} L${counts.low}`,
  ].join(" · ");
}

export function toMarkdown(run: AuditRun): string {
  const counts = countBySeverity(run.findings);
  const lines: string[] = [
    `# Argus audit memo`,
    ``,
    `- Contract: \`${run.contractName}\``,
    `- File: \`${run.filename}\``,
    `- Pragma: \`${run.pragma}\``,
    `- Generated: ${new Date(run.createdAt).toISOString()}`,
    `- LLM review: ${run.llmApplied ? "applied" : "deterministic only"}`,
    ``,
    `## Severity rollup`,
    ``,
    `| Severity | Count |`,
    `|---|---|`,
    ...ORDER.map((s) => `| ${s} | ${counts[s]} |`),
    ``,
    `## Findings`,
    ``,
  ];
  const sorted = [...run.findings].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  for (const f of sorted) {
    lines.push(
      `### ${f.id} · ${f.swcId} · ${f.title}`,
      ``,
      `- Severity: **${f.severity}** (${Math.round(f.confidence * 100)}% confidence)`,
      `- Function: \`${f.functionName}\` · lines ${f.lineStart}–${f.lineEnd}`,
      `- Verdict: ${f.verdict.replaceAll("_", " ")}`,
      `- HITL: ${f.hitl}`,
      `- Detector: \`${f.detector}\``,
      ``,
      f.rationale,
      ``,
      "```solidity",
      f.snippet,
      "```",
      ``,
      `**Recommendation.** ${f.recommendation}`,
      ``,
    );
    if (f.patch) {
      lines.push("```diff", f.patch, "```", ``);
    }
  }
  lines.push(
    `## Disclaimer`,
    ``,
    `This memo is a static-analysis aid for educational and defensive review. It is not a professional audit, not investment advice, and not an authorization to deploy.`,
    ``,
  );
  return lines.join("\n");
}
