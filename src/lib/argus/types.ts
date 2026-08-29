export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const REVIEW_VERDICTS = [
  "confirmed",
  "likely_false_positive",
  "needs_human_review",
] as const;
export type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

export const HITL_STATES = ["pending", "accepted", "dismissed", "patched"] as const;
export type HitlState = (typeof HITL_STATES)[number];

export const PIPELINE_PHASES = [
  "ingest",
  "parse",
  "static_scan",
  "rag_enrich",
  "fp_filter",
  "severity_rank",
  "patch_draft",
  "hitl_gate",
  "report",
] as const;
export type PipelinePhase = (typeof PIPELINE_PHASES)[number];

export type SwcEntry = {
  id: string;
  title: string;
  cwe: string;
  summary: string;
  remediation: string;
  references: string[];
};

export type ParsedFunction = {
  name: string;
  visibility: "public" | "external" | "internal" | "private" | "default";
  mutability: "pure" | "view" | "payable" | "nonpayable";
  modifiers: string[];
  params: string;
  body: string;
  startLine: number;
  endLine: number;
  signatureLine: number;
};

export type ParsedContract = {
  name: string;
  pragma: string;
  pragmaLine: number;
  compilerMajor: number;
  compilerMinor: number;
  floatingPragma: boolean;
  functions: ParsedFunction[];
  stateVars: Array<{ name: string; line: number; raw: string }>;
  source: string;
  lines: string[];
  masked: string;
};

export type Finding = {
  id: string;
  detector: string;
  swcId: string;
  title: string;
  severity: Severity;
  confidence: number;
  lineStart: number;
  lineEnd: number;
  functionName: string;
  snippet: string;
  rationale: string;
  recommendation: string;
  guarded: boolean;
  verdict: ReviewVerdict;
  verdictNote: string;
  hitl: HitlState;
  patch: string | null;
  ragHits: string[];
};

export type TraceEvent = {
  phase: PipelinePhase;
  status: "running" | "ok" | "skipped";
  startedAt: number;
  durationMs: number;
  detail: string;
};

export type AuditRun = {
  id: string;
  filename: string;
  source: string;
  contractName: string;
  pragma: string;
  findings: Finding[];
  trace: TraceEvent[];
  summary: string;
  createdAt: number;
  llmApplied: boolean;
};

export type LlmReviewItem = {
  findingId: string;
  verdict: ReviewVerdict;
  note: string;
  severity?: Severity;
  patch?: string;
};

export type LlmReviewResult = {
  ok: true;
  items: LlmReviewItem[];
  executiveSummary: string;
} | {
  ok: false;
  error: string;
};
