import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDeterministicPipeline } from "./agent.ts";
import { handleMcp } from "./mcp-tools.ts";
import { retrieveSwc } from "./retrieve.ts";
import { SAMPLES } from "./samples.ts";

function idsFor(sampleId: string): string[] {
  const sample = SAMPLES.find((s) => s.id === sampleId);
  assert.ok(sample);
  const run = runDeterministicPipeline(sample.source, sample.filename);
  return [...new Set(run.findings.map((f) => f.swcId))];
}

describe("Argus deterministic pipeline", () => {
  it("flags CEI reentrancy and floating pragma on the naive vault", () => {
    const ids = idsFor("reentrancy-vault");
    assert.ok(ids.includes("SWC-107"));
    assert.ok(ids.includes("SWC-103"));
  });

  it("flags tx.origin authorization", () => {
    assert.ok(idsFor("tx-origin-auth").includes("SWC-115"));
  });

  it("flags unchecked low-level call", () => {
    assert.ok(idsFor("unchecked-call").includes("SWC-104"));
  });

  it("flags delegatecall to a caller-supplied target", () => {
    assert.ok(idsFor("delegate-proxy").includes("SWC-112"));
  });

  it("flags unprotected withdraw and selfdestruct", () => {
    const ids = idsFor("unprotected-withdraw");
    assert.ok(ids.includes("SWC-105"));
    assert.ok(ids.includes("SWC-106"));
  });

  it("flags weak block-attribute seeding", () => {
    const ids = idsFor("weak-seed");
    assert.ok(ids.includes("SWC-120") || ids.includes("SWC-116"));
  });

  it("does not emit critical findings on the hardened vault", () => {
    const sample = SAMPLES.find((s) => s.id === "hardened-vault");
    assert.ok(sample);
    const run = runDeterministicPipeline(sample.source, sample.filename);
    const critical = run.findings.filter((f) => f.severity === "critical");
    assert.equal(critical.length, 0);
    assert.ok(!run.findings.some((f) => f.swcId === "SWC-107"));
  });

  it("records every pipeline phase", () => {
    const sample = SAMPLES[0];
    const run = runDeterministicPipeline(sample.source, sample.filename);
    const phases = run.trace.map((t) => t.phase);
    assert.deepEqual(phases, [
      "ingest",
      "parse",
      "static_scan",
      "rag_enrich",
      "fp_filter",
      "severity_rank",
      "patch_draft",
      "hitl_gate",
      "report",
    ]);
  });
});

describe("SWC retrieval", () => {
  it("returns exact SWC ids", () => {
    const hits = retrieveSwc("SWC-107", 1);
    assert.equal(hits[0]?.id, "SWC-107");
  });

  it("ranks reentrancy language toward SWC-107", () => {
    const hits = retrieveSwc("external call before storage update reentrancy", 3);
    assert.ok(hits.some((h) => h.id === "SWC-107"));
  });
});

describe("MCP tool host", () => {
  it("lists tools", () => {
    const res = handleMcp({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const tools = (res.result as { tools: { name: string }[] }).tools;
    assert.ok(tools.some((t) => t.name === "static_scan"));
  });

  it("scans via tools/call", () => {
    const sample = SAMPLES[0];
    const res = handleMcp({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "static_scan",
        arguments: { source: sample.source, filename: sample.filename },
      },
    });
    assert.ok(res.result);
    const findings = (res.result as { findings: unknown[] }).findings;
    assert.ok(findings.length > 0);
  });
});
