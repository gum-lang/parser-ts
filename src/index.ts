import initWasm, {
  parse_to_ast,
  format_document as wasm_format_document,
  validate_document as wasm_validate_document,
  is_valid as wasm_is_valid,
  initSync,
} from "../pkg/gum_core.js";

export interface Document {
  elements: DocumentElement[];
}

export type DocumentElement =
  | { Assignment: Assignment }
  | { NonAssignment: NonAssignment };

export interface Assignment {
  key: Key;
  value: Value;
}

export interface NonAssignment {
  content: string;
}

export type Key =
  | { Bare: string }
  | { Quoted: string }
  | { Dotted: Key[] };

export type Value =
  | { String: StringValue }
  | { Number: NumberValue }
  | { Boolean: boolean }
  | "Null"
  | { Table: Table }
  | { List: List };

export type StringValue =
  | { Basic: string }
  | { MultilineBasic: string }
  | { Literal: string }
  | { MultilineLiteral: string };

export type NumberValue =
  | { Integer: number }
  | { Float: number };

export interface Table {
  entries: Assignment[];
}

export interface List {
  elements: Value[];
}

export interface GumError {
  message: string;
  span?: { start: number; end: number };
}

let wasmInitialized = false;

async function loadWasmInNode(): Promise<void> {
  const { readFileSync } = await import("fs");
  const { join, dirname } = await import("path");
  const { fileURLToPath } = await import("url");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const wasmPath = join(__dirname, "..", "pkg", "gum_core_bg.wasm");
  const wasmBuffer = readFileSync(wasmPath);
  initSync({ module: wasmBuffer });
}

async function ensureInitialized(): Promise<void> {
  if (wasmInitialized) return;

  const isNode =
    typeof process !== "undefined" &&
    process.versions != null &&
    process.versions.node != null;

  if (isNode) {
    await loadWasmInNode();
  } else {
    await initWasm();
  }

  wasmInitialized = true;
}

export async function init(): Promise<void> {
  await ensureInitialized();
}

export async function parse(input: string): Promise<Document> {
  await ensureInitialized();
  const result = parse_to_ast(input);
  return result as Document;
}

export async function validate(doc: Document): Promise<GumError[]> {
  await ensureInitialized();
  const input = serializeDocument(doc);
  const errors = wasm_validate_document(input);
  return (errors as GumError[]) || [];
}

export async function format(doc: Document): Promise<string> {
  await ensureInitialized();
  const input = serializeDocument(doc);
  return wasm_format_document(input);
}

export async function isValid(input: string): Promise<boolean> {
  await ensureInitialized();
  return wasm_is_valid(input);
}

function serializeDocument(doc: Document): string {
  const parts: string[] = [];
  for (const element of doc.elements) {
    if ("Assignment" in element) {
      const assignment = element.Assignment;
      parts.push(serializeKey(assignment.key) + " = " + serializeValue(assignment.value));
    } else if ("NonAssignment" in element) {
      parts.push(element.NonAssignment.content);
    }
  }
  return parts.join("\n");
}

function serializeKey(key: Key): string {
  if ("Bare" in key) return key.Bare;
  if ("Quoted" in key) return `"${key.Quoted}"`;
  if ("Dotted" in key) return key.Dotted.map(serializeKey).join(".");
  throw new Error("Unknown key type");
}

function escapeString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function serializeValue(value: Value): string {
  if (value === "Null") return "null";
  if (typeof value === "string") return "null";
  if ("String" in value) {
    const sv = value.String;
    if ("Basic" in sv) return `"${escapeString(sv.Basic)}"`;
    if ("MultilineBasic" in sv) return `"""${sv.MultilineBasic}"""`;
    if ("Literal" in sv) return `'${sv.Literal}'`;
    if ("MultilineLiteral" in sv) return `'''${sv.MultilineLiteral}'''`;
    throw new Error("Unknown string value type");
  }
  if ("Number" in value) {
    const nv = value.Number;
    if ("Integer" in nv) return String(nv.Integer);
    if ("Float" in nv) return String(nv.Float);
    throw new Error("Unknown number value type");
  }
  if ("Boolean" in value) return value.Boolean ? "true" : "false";
  if ("Table" in value) {
    const entries = value.Table.entries
      .map((e) => "    " + serializeKey(e.key) + " = " + serializeValue(e.value))
      .join("\n");
    return "{\n" + entries + "\n}";
  }
  if ("List" in value) {
    const elements = value.List.elements.map(serializeValue).join(", ");
    return "[" + elements + "]";
  }
  throw new Error("Unknown value type: " + JSON.stringify(value));
}
