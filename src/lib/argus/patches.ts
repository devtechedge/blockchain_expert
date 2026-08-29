import type { Finding } from "./types.ts";

function unified(filename: string, before: string, after: string, startLine: number): string {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  return [
    `--- a/${filename}`,
    `+++ b/${filename}`,
    `@@ -${startLine},${oldLines.length} +${startLine},${newLines.length} @@`,
    ...oldLines.map((l) => `-${l}`),
    ...newLines.map((l) => `+${l}`),
  ].join("\n");
}

export function draftPatch(finding: Finding, source: string, filename: string): string | null {
  const lines = source.split("\n");
  const idx = Math.max(0, finding.lineStart - 1);
  const current = lines[idx] ?? "";

  if (finding.swcId === "SWC-115" && current.includes("tx.origin")) {
    return unified(filename, current, current.replace(/tx\.origin/g, "msg.sender"), finding.lineStart);
  }

  if (finding.swcId === "SWC-103") {
    const pinned = current.replace(/pragma\s+solidity\s+[^;]+;/, "pragma solidity 0.8.20;");
    if (pinned !== current) return unified(filename, current, pinned, finding.lineStart);
  }

  if (finding.swcId === "SWC-107") {
    return [
      `--- a/${filename}`,
      `+++ b/${filename}`,
      `@@ CEI reorder around ${finding.functionName} @@`,
      `+// Apply checks-effects-interactions:`,
      `+// 1. require(balances[msg.sender] >= amount);`,
      `+// 2. balances[msg.sender] -= amount;`,
      `+// 3. (bool ok,) = msg.sender.call{value: amount}("");`,
      `+// 4. require(ok);`,
      `+// Keep a nonReentrant modifier on value-moving functions.`,
    ].join("\n");
  }

  if (finding.swcId === "SWC-104") {
    return [
      `--- a/${filename}`,
      `+++ b/${filename}`,
      `@@ ${finding.functionName} @@`,
      `- (bool ok, ) = target.call(data);`,
      `+ (bool ok, ) = target.call(data);`,
      `+ require(ok, "call failed");`,
    ].join("\n");
  }

  if (finding.swcId === "SWC-112") {
    return [
      `--- a/${filename}`,
      `+++ b/${filename}`,
      `@@ ${finding.functionName} @@`,
      `- (bool ok, ) = target.delegatecall(data);`,
      `+ address immutable implementation; // set in constructor, never caller-supplied`,
      `+ (bool ok, ) = implementation.delegatecall(data);`,
      `+ require(ok, "delegate failed");`,
    ].join("\n");
  }

  if (finding.swcId === "SWC-105") {
    return [
      `--- a/${filename}`,
      `+++ b/${filename}`,
      `@@ ${finding.functionName} @@`,
      `+ modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }`,
      `+ function withdraw() external onlyOwner { ... }`,
    ].join("\n");
  }

  return null;
}
