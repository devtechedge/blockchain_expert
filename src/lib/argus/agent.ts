import { defaultVerdict, runDetectors } from "./detectors.ts";
import { parseSolidity } from "./parse.ts";
import { draftPatch } from "./patches.ts";
import { retrieveSwc } from "./retrieve.ts";
import { summarizeRun } from "./report.ts";
import type { AuditRun, Finding, PipelinePhase, TraceEvent } from "./types.ts";
import { PIPELINE_PHASES, SEVERITIES } from "./types.ts";

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function mark(
  trace: TraceEvent[],
  phase: PipelinePhase,
  detail: string,
  durationMs: number,
  status: TraceEvent["status"] = "ok",
): void {
  trace.push({
    phase,
    status,
    startedAt: Date.now() - durationMs,
    durationMs,
    detail,
  });
}

const SEV_RANK: Record<string, number> = Object.fromEntries(SEVERITIES.map((s, i) => [s, i]));

export function runDeterministicPipeline(source: string, filename: string): AuditRun {
  const trace: TraceEvent[] = [];
  const createdAt = Date.now();

  mark(trace, "ingest", `Loaded ${filename} (${source.length} bytes)`, 4);

  const parsed = parseSolidity(source);
  mark(
    trace,
    "parse",
    `${parsed.name} · pragma ${parsed.pragma} · ${parsed.functions.length} functions · ${parsed.stateVars.length} state vars`,
    8,
  );

  const drafts = runDetectors(parsed);
  mark(trace, "static_scan", `${drafts.length} detector hits before ranking`, 12);

  const findings: Finding[] = drafts.map((draft, i) => {
    const swc = retrieveSwc(draft.swcId, 1)[0];
    const related = retrieveSwc(`${draft.title} ${draft.rationale}`, 2)
      .map((e) => e.id)
      .filter((id) => id !== draft.swcId);
    const { verdict, note } = defaultVerdict(draft);
    const finding: Finding = {
      ...draft,
      id: `F-${String(i + 1).padStart(3, "0")}`,
      verdict,
      verdictNote: note,
      hitl: "pending",
      patch: null,
      ragHits: [swc?.id ?? draft.swcId, ...related].slice(0, 3),
    };
    finding.patch = draftPatch(finding, source, filename);
    return finding;
  });

  mark(
    trace,
    "rag_enrich",
    `Mapped ${findings.length} findings onto the SWC registry (TF-IDF, offline)`,
    6,
  );

  const confirmed = findings.filter((f) => f.verdict === "confirmed").length;
  const fp = findings.filter((f) => f.verdict === "likely_false_positive").length;
  mark(
    trace,
    "fp_filter",
    `Heuristic filter: ${confirmed} confirmed · ${fp} likely false-positive · ${findings.length - confirmed - fp} need review`,
    7,
  );

  findings.sort((a, b) => (SEV_RANK[a.severity] ?? 9) - (SEV_RANK[b.severity] ?? 9));
  mark(trace, "severity_rank", "Ordered critical → info; guarded CEI smells demoted", 3);

  const patched = findings.filter((f) => f.patch).length;
  mark(trace, "patch_draft", `${patched} remediation diffs drafted`, 5);

  mark(trace, "hitl_gate", "Every finding waits for accept / dismiss / patch", 2);

  const run: AuditRun = {
    id: uid("run"),
    filename,
    source,
    contractName: parsed.name,
    pragma: parsed.pragma,
    findings,
    trace,
    summary: "",
    createdAt,
    llmApplied: false,
  };
  run.summary = summarizeRun(run);
  mark(trace, "report", run.summary, 3);
  return run;
}

export function emptyTrace(): TraceEvent[] {
  return PIPELINE_PHASES.map((phase) => ({
    phase,
    status: "running",
    startedAt: 0,
    durationMs: 0,
    detail: "Waiting",
  }));
}
