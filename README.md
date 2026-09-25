# @gum-lang/parser

TypeScript parser for the **Gum** markup language, powered by WebAssembly.

## Installation

```bash
npm install @gum-lang/parser
```

## Usage

```typescript
import { parse, validate, format, isValid } from "@gum-lang/parser";

// Parse a Gum document
const doc = await parse(`name = "Gum"\nversion = 1`);

// Check validity
const valid = await isValid(`name = "Gum"`);

// Validate a parsed document
const errors = await validate(doc);

// Format a document back to string
const formatted = await format(doc);
```

## API

### `parse(input: string): Promise<Document>`

Parses a Gum string into an AST. Throws on syntax errors.

### `validate(doc: Document): Promise<GumError[]>`

Returns validation errors for a parsed document (empty array if valid).

### `format(doc: Document): Promise<string>`

Serializes an AST back to a normalized Gum string.

### `isValid(input: string): Promise<boolean>`

Quick check if a string is valid Gum syntax.

### `init(): Promise<void>`

Explicitly initializes the WASM module. Called automatically on first use.

## AST Types

```typescript
interface Document {
  elements: DocumentElement[];
}

type DocumentElement =
  | { Assignment: Assignment }
  | { NonAssignment: NonAssignment };

interface Assignment {
  key: Key;
  value: Value;
}

type Key =
  | { Bare: string }
  | { Quoted: string }
  | { Dotted: Key[] };

type Value =
  | { String: StringValue }
  | { Number: NumberValue }
  | { Boolean: boolean }
  | { Null: null }
  | { Table: Table }
  | { List: List };
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
