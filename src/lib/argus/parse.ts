import type { ParsedContract, ParsedFunction } from "./types.ts";

const KEYWORD_VIS = ["public", "external", "internal", "private"] as const;
const KEYWORD_MUT = ["pure", "view", "payable"] as const;

export function maskComments(source: string): string {
  const chars = source.split("");
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === "/" && chars[i + 1] === "/") {
      while (i < chars.length && chars[i] !== "\n") {
        chars[i] = " ";
        i += 1;
      }
      continue;
    }
    if (chars[i] === "/" && chars[i + 1] === "*") {
      chars[i] = " ";
      chars[i + 1] = " ";
      i += 2;
      while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) {
        if (chars[i] !== "\n") chars[i] = " ";
        i += 1;
      }
      if (i < chars.length) chars[i] = " ";
      if (i + 1 < chars.length) chars[i + 1] = " ";
      i += 2;
      continue;
    }
    i += 1;
  }
  return chars.join("");
}

function lineOfIndex(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source[i] === "\n") line += 1;
  }
  return line;
}

function sliceBody(source: string, openBrace: number): { body: string; end: number } {
  let depth = 0;
  for (let i = openBrace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return { body: source.slice(openBrace + 1, i), end: i };
      }
    }
  }
  return { body: source.slice(openBrace + 1), end: source.length };
}

function parsePragma(masked: string): {
  pragma: string;
  pragmaLine: number;
  compilerMajor: number;
  compilerMinor: number;
  floatingPragma: boolean;
} {
  const match = masked.match(/pragma\s+solidity\s+([^;]+);/);
  if (!match) {
    return {
      pragma: "unknown",
      pragmaLine: 1,
      compilerMajor: 0,
      compilerMinor: 0,
      floatingPragma: false,
    };
  }
  const spec = match[1].trim();
  const floating = /[\^~><]/.test(spec);
  const version = spec.match(/(\d+)\.(\d+)/);
  return {
    pragma: spec,
    pragmaLine: lineOfIndex(masked, match.index ?? 0),
    compilerMajor: version ? Number(version[1]) : 0,
    compilerMinor: version ? Number(version[2]) : 0,
    floatingPragma: floating,
  };
}

function parseVisibility(header: string): ParsedFunction["visibility"] {
  for (const vis of KEYWORD_VIS) {
    if (new RegExp(`\\b${vis}\\b`).test(header)) return vis;
  }
  return "default";
}

function parseMutability(header: string): ParsedFunction["mutability"] {
  for (const mut of KEYWORD_MUT) {
    if (new RegExp(`\\b${mut}\\b`).test(header)) return mut;
  }
  return "nonpayable";
}

function parseModifiers(header: string): string[] {
  const afterReturns = header.replace(/returns\s*\([^)]*\)/g, " ");
  const tokens = afterReturns
    .replace(/function\s+[A-Za-z_]\w*/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .split(/[\s{]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const skip = new Set([
    ...KEYWORD_VIS,
    ...KEYWORD_MUT,
    "virtual",
    "override",
    "returns",
    "function",
  ]);
  return tokens.filter((t) => !skip.has(t) && /^[A-Za-z_]/.test(t));
}

export function parseSolidity(source: string): ParsedContract {
  const masked = maskComments(source);
  const lines = source.split(/\n/);
  const pragma = parsePragma(masked);

  const contractMatch = masked.match(/\b(?:contract|library|interface)\s+([A-Za-z_]\w*)/);
  const name = contractMatch?.[1] ?? "Unknown";

  const functions: ParsedFunction[] = [];
  const fnRe =
    /\b(function|constructor|fallback|receive)\s*([A-Za-z_]\w*)?\s*\(([^)]*)\)([\s\S]*?)\{/g;
  let match: RegExpExecArray | null;
  while ((match = fnRe.exec(masked))) {
    const kind = match[1];
    const rawName = match[2];
    const fnName =
      kind === "constructor" ? "constructor" : kind === "fallback" ? "fallback" : kind === "receive" ? "receive" : rawName ?? "anonymous";
    const header = match[0];
    const openBrace = (match.index ?? 0) + match[0].length - 1;
    const { body, end } = sliceBody(masked, openBrace);
    functions.push({
      name: fnName,
      visibility: kind === "constructor" ? "public" : parseVisibility(header),
      mutability: kind === "receive" ? "payable" : parseMutability(header),
      modifiers: parseModifiers(header),
      params: match[3] ?? "",
      body,
      startLine: lineOfIndex(masked, match.index ?? 0),
      endLine: lineOfIndex(masked, end),
      signatureLine: lineOfIndex(masked, match.index ?? 0),
    });
    fnRe.lastIndex = end + 1;
  }

  const stateVars: ParsedContract["stateVars"] = [];
  const varRe =
    /^\s*(?:mapping\b|[\w\[\]\.]+\s+)([A-Za-z_]\w*)\s*(?:=|;)(?!.*\bfunction\b)/gm;
  const fnSpans = functions.map((fn) => [fn.startLine, fn.endLine] as const);
  let varMatch: RegExpExecArray | null;
  while ((varMatch = varRe.exec(masked))) {
    const line = lineOfIndex(masked, varMatch.index);
    const insideFn = fnSpans.some(([a, b]) => line >= a && line <= b);
    if (insideFn) continue;
    const ident = varMatch[1];
    if (
      ["pragma", "contract", "library", "interface", "using", "import", "event", "error", "modifier"].includes(
        ident,
      )
    ) {
      continue;
    }
    stateVars.push({
      name: ident,
      line,
      raw: (masked.split("\n")[line - 1] ?? "").trim(),
    });
  }

  return {
    name,
    ...pragma,
    functions,
    stateVars,
    source,
    lines,
    masked,
  };
}

export function snippetFor(contract: ParsedContract, start: number, end: number): string {
  const from = Math.max(1, start);
  const to = Math.min(contract.lines.length, Math.max(from, end));
  return contract.lines
    .slice(from - 1, to)
    .map((line, i) => `${String(from + i).padStart(3, " ")} | ${line}`)
    .join("\n");
}

export function functionHasModifier(fn: ParsedFunction, names: string[]): boolean {
  const lower = fn.modifiers.map((m) => m.toLowerCase());
  return names.some((n) => lower.includes(n.toLowerCase()));
}

export function looksLikeOwnerGuard(fn: ParsedFunction): boolean {
  if (
    functionHasModifier(fn, [
      "onlyOwner",
      "onlyowner",
      "onlyRole",
      "onlyAdmin",
      "onlyGovernance",
    ])
  ) {
    return true;
  }
  return /\b(?:require|if)\s*\(\s*(?:msg\.sender\s*==\s*(?:owner|_owner|admin)|(?:owner|_owner|admin)\s*==\s*msg\.sender)/.test(
    fn.body,
  );
}
