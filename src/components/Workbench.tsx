"use client";

import { useMemo, useState } from "react";
import { runDeterministicPipeline } from "@/lib/argus/agent.ts";
import { MCP_TOOLS } from "@/lib/argus/mcp-tools.ts";
import { countBySeverity, toMarkdown } from "@/lib/argus/report.ts";
import { SAMPLES } from "@/lib/argus/samples.ts";
import { getSwc } from "@/lib/argus/swc-registry.ts";
import { PIPELINE_PHASES } from "@/lib/argus/types.ts";
import type { AuditRun, Finding, HitlState } from "@/lib/argus/types.ts";

type Tab = "workbench" | "report" | "protocol";

export function Workbench() {
  const first = SAMPLES[0];
  const [tab, setTab] = useState<Tab>("workbench");
  const [sampleId, setSampleId] = useState(first.id);
  const [source, setSource] = useState(first.source);
  const [filename, setFilename] = useState(first.filename);
  const [run, setRun] = useState<AuditRun | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sample = SAMPLES.find((s) => s.id === sampleId) ?? first;
  const finding = run?.findings.find((f) => f.id === selectedId) ?? run?.findings[0];
  const counts = run ? countBySeverity(run.findings) : null;
  const markdown = useMemo(() => (run ? toMarkdown(run) : ""), [run]);

  function load(id: string) {
    const next = SAMPLES.find((s) => s.id === id) ?? first;
    setSampleId(next.id);
    setSource(next.source);
    setFilename(next.filename);
    setRun(null);
    setSelectedId(null);
  }

  function scan() {
    const next = runDeterministicPipeline(source, filename);
    setRun(next);
    setSelectedId(next.findings[0]?.id ?? null);
    setTab("workbench");
  }

  function setHitl(id: string, hitl: HitlState) {
    if (!run) return;
    setRun({
      ...run,
      findings: run.findings.map((f) => (f.id === id ? { ...f, hitl } : f)),
    });
  }

  return (
    <div className="shell">
      <header className="header">
        <div className="brand">
          <span className="mark" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
              <path d="M16 6 L26 11.5 V20.5 C26 25.2 21.7 28.2 16 29.6 C10.3 28.2 6 25.2 6 20.5 V11.5 Z" stroke="currentColor" strokeWidth="1.75" />
              <circle cx="16" cy="16.5" r="2.2" fill="currentColor" />
            </svg>
          </span>
          <div>
            <h1>ARGUS</h1>
            <p>Agentic smart-contract security copilot</p>
          </div>
        </div>
        <nav className="nav">
          {(["workbench", "report", "protocol"] as const).map((id) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              {id === "report" ? "Memo" : id === "protocol" ? "Protocol" : "Workbench"}
            </button>
          ))}
        </nav>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={scan}>
            Static scan
          </button>
        </div>
      </header>

      <main className="main">
        {tab === "workbench" ? (
          <>
            <div className="chips">
              {SAMPLES.map((s) => (
                <button key={s.id} type="button" className={`chip ${s.id === sampleId ? "active" : ""}`} onClick={() => load(s.id)}>
                  {s.title}
                </button>
              ))}
            </div>
            <p className="hint">{sample.blurb} Educational fixtures only — do not deploy.</p>
            <div className="grid">
              <aside className="panel">
                <h2>Pipeline</h2>
                {PIPELINE_PHASES.map((phase, i) => {
                  const event = run?.trace.find((t) => t.phase === phase);
                  return (
                    <div key={phase} className={`phase ${event?.status === "ok" ? "done" : ""}`}>
                      <span className="n">{String(i + 1).padStart(2, "0")}</span>
                      <span>
                        <div className="label">{phase.replaceAll("_", " ")}</div>
                        <div className="detail">{event?.detail ?? "Idle"}</div>
                      </span>
                    </div>
                  );
                })}
              </aside>
              <Editor source={source} findings={run?.findings ?? []} onChange={(v) => { setSource(v); setFilename("pasted.sol"); }} />
              <FindingsPane run={run} finding={finding} counts={counts} onSelect={setSelectedId} onHitl={setHitl} />
            </div>
          </>
        ) : null}

        {tab === "report" ? (
          <div className="memo">
            {run ? <pre>{markdown}</pre> : <p className="hint">Scan a contract first. The memo follows the current HITL board.</p>}
          </div>
        ) : null}

        {tab === "protocol" ? (
          <div className="protocol">
            <section>
              <h2>Agent protocol</h2>
              <p>
                Argus is an explicit state machine. Every scan walks the same nine phases. The
                optional LLM review can only reclassify existing findings. Nothing here talks to a chain.
              </p>
              <ol className="phases">
                {PIPELINE_PHASES.map((phase, i) => (
                  <li key={phase}>
                    <div className="hint">{String(i + 1).padStart(2, "0")}</div>
                    <strong>{phase.replaceAll("_", " ")}</strong>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <h2>MCP tool host</h2>
              <p>Local JSON-RPC 2.0 subset: tools/list and tools/call. Read-only.</p>
              <ul className="phases">
                {MCP_TOOLS.map((tool) => (
                  <li key={tool.name}>
                    <strong>{tool.name}</strong>
                    <p>{tool.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Editor({
  source,
  findings,
  onChange,
}: {
  source: string;
  findings: Finding[];
  onChange: (value: string) => void;
}) {
  const lines = source.split("\n").length;
  const hits = new Set(findings.map((f) => f.lineStart));
  return (
    <div className="editor">
      <div className="gutter" aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i} className={hits.has(i + 1) ? "hit" : ""}>
            {i + 1}
          </span>
        ))}
      </div>
      <textarea value={source} spellCheck={false} aria-label="Solidity source" onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function FindingsPane({
  run,
  finding,
  counts,
  onSelect,
  onHitl,
}: {
  run: AuditRun | null;
  finding?: Finding;
  counts: ReturnType<typeof countBySeverity> | null;
  onSelect: (id: string) => void;
  onHitl: (id: string, hitl: HitlState) => void;
}) {
  if (!run) {
    return (
      <div className="panel">
        <p className="hint">Run a static scan to populate findings. The analyzer is local — no node, no keys.</p>
      </div>
    );
  }
  return (
    <div className="findings">
      <div className="counts">
        <span>C {counts?.critical}</span>
        <span>H {counts?.high}</span>
        <span>M {counts?.medium}</span>
        <span>L {counts?.low}</span>
      </div>
      <div className="list">
        {run.findings.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`row ${finding?.id === f.id ? "active" : ""}`}
            onClick={() => onSelect(f.id)}
          >
            <div className="meta">
              <span>{f.id}</span>
              <span className={`badge sev-${f.severity}`}>{f.severity}</span>
            </div>
            <div className="title">{f.title}</div>
            <div className="sub">
              {f.swcId} · {f.functionName} · L{f.lineStart}
            </div>
          </button>
        ))}
      </div>
      {finding ? <Detail finding={finding} onHitl={onHitl} /> : null}
    </div>
  );
}

function Detail({ finding, onHitl }: { finding: Finding; onHitl: (id: string, hitl: HitlState) => void }) {
  const swc = getSwc(finding.swcId);
  return (
    <article className="panel detail">
      <h3>{finding.title}</h3>
      <div className="counts" style={{ marginTop: 8 }}>
        <span className="badge sev-info">{finding.swcId}</span>
        <span className={`badge sev-${finding.severity}`}>{finding.verdict.replaceAll("_", " ")}</span>
      </div>
      <p>{finding.rationale}</p>
      {swc ? (
        <p>
          {swc.title} · {swc.cwe}. {swc.remediation}
        </p>
      ) : null}
      <pre>{finding.snippet}</pre>
      <p>{finding.recommendation}</p>
      {finding.patch ? <pre className="patch">{finding.patch}</pre> : null}
      <div className="hitl">
        <button type="button" className="btn primary" onClick={() => onHitl(finding.id, "accepted")}>
          Accept
        </button>
        <button type="button" className="btn secondary" onClick={() => onHitl(finding.id, "dismissed")}>
          Dismiss
        </button>
        <button type="button" className="btn" disabled={!finding.patch} onClick={() => onHitl(finding.id, "patched")}>
          Mark patched
        </button>
        <span className="state">{finding.hitl}</span>
      </div>
    </article>
  );
}
