import { readFileSync } from "node:fs";
import { runDeterministicPipeline } from "./lib/argus/agent.ts";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run scan -- <file.sol>");
  process.exit(1);
}

const source = readFileSync(file, "utf8");
const run = runDeterministicPipeline(source, file);
const out = {
  contract: run.contractName,
  pragma: run.pragma,
  summary: run.summary,
  findings: run.findings.map((f) => ({
    id: f.id,
    swcId: f.swcId,
    severity: f.severity,
    verdict: f.verdict,
    title: f.title,
    functionName: f.functionName,
    lineStart: f.lineStart,
  })),
};
console.log(JSON.stringify(out, null, 2));
