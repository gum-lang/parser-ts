import { describe, it, expect, beforeAll } from "vitest";
import { parse, validate, format, isValid, init } from "./index.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

beforeAll(async () => {
  await init();
});

const validFiles = fs
  .readdirSync(path.join(__dirname, "../integration_tests/valid"))
  .filter((f) => f.endsWith(".gum"));

const invalidFiles = fs
  .readdirSync(path.join(__dirname, "../integration_tests/invalid"))
  .filter((f) => f.endsWith(".gum"));

describe("valid documents", () => {
  for (const file of validFiles) {
    it(`parses ${file} successfully`, async () => {
      const input = fs.readFileSync(
        path.join(__dirname, "../integration_tests/valid", file),
        "utf-8"
      );
      const doc = await parse(input);
      expect(doc).toBeDefined();
      expect(doc.elements).toBeDefined();
      expect(Array.isArray(doc.elements)).toBe(true);
    });

    it(`validates ${file} with no errors`, async () => {
      const input = fs.readFileSync(
        path.join(__dirname, "../integration_tests/valid", file),
        "utf-8"
      );
      const doc = await parse(input);
      const errors = await validate(doc);
      expect(errors).toEqual([]);
    });

    it(`isValid returns true for ${file}`, async () => {
      const input = fs.readFileSync(
        path.join(__dirname, "../integration_tests/valid", file),
        "utf-8"
      );
      expect(await isValid(input)).toBe(true);
    });

    it(`roundtrip formats ${file}`, async () => {
      const input = fs.readFileSync(
        path.join(__dirname, "../integration_tests/valid", file),
        "utf-8"
      );
      const doc = await parse(input);
      const formatted = await format(doc);
      expect(typeof formatted).toBe("string");
      expect(formatted.length).toBeGreaterThan(0);
      const reparsed = await parse(formatted);
      expect(reparsed.elements.length).toBe(doc.elements.length);
    });
  }
});

describe("invalid documents", () => {
  for (const file of invalidFiles) {
    it(`fails to parse ${file}`, async () => {
      const input = fs.readFileSync(
        path.join(__dirname, "../integration_tests/invalid", file),
        "utf-8"
      );
      await expect(parse(input)).rejects.toThrow();
    });

    it(`isValid returns false for ${file}`, async () => {
      const input = fs.readFileSync(
        path.join(__dirname, "../integration_tests/invalid", file),
        "utf-8"
      );
      expect(await isValid(input)).toBe(false);
    });
  }
});

describe("AST structure", () => {
  it("parses basic assignments", async () => {
    const doc = await parse('name = "Gum"\nversion = 1');
    const assignments = doc.elements.filter(
      (e) => "Assignment" in e
    );
    expect(assignments.length).toBe(2);
  });

  it("parses string values", async () => {
    const doc = await parse('name = "hello"');
    const assignment = (doc.elements[0] as any).Assignment;
    expect(assignment.value).toHaveProperty("String");
  });

  it("parses number values", async () => {
    const doc = await parse("count = 42");
    const assignment = (doc.elements[0] as any).Assignment;
    expect(assignment.value).toHaveProperty("Number");
  });

  it("parses boolean values", async () => {
    const docTrue = await parse("enabled = true");
    const docFalse = await parse("disabled = false");
    expect(
      ((docTrue.elements[0] as any).Assignment.value as any).Boolean
    ).toBe(true);
    expect(
      ((docFalse.elements[0] as any).Assignment.value as any).Boolean
    ).toBe(false);
  });

  it("parses null values", async () => {
    const doc = await parse("nothing = null");
    const assignment = (doc.elements[0] as any).Assignment;
    expect(assignment.value).toBe("Null");
  });

  it("parses tables", async () => {
    const doc = await parse('config = {\n    host = "localhost"\n}');
    const assignment = (doc.elements[0] as any).Assignment;
    expect(assignment.value).toHaveProperty("Table");
    expect(assignment.value.Table.entries.length).toBe(1);
  });

  it("parses lists", async () => {
    const doc = await parse("items = [1, 2, 3]");
    const assignment = (doc.elements[0] as any).Assignment;
    expect(assignment.value).toHaveProperty("List");
    expect(assignment.value.List.elements.length).toBe(3);
  });

  it("parses dotted keys", async () => {
    const doc = await parse('server.host = "localhost"');
    const assignment = (doc.elements[0] as any).Assignment;
    expect(assignment.key).toHaveProperty("Dotted");
  });

  it("parses quoted keys", async () => {
    const doc = await parse('"my key" = "value"');
    const assignment = (doc.elements[0] as any).Assignment;
    expect(assignment.key).toHaveProperty("Quoted");
  });

  it("parses comments as non-assignment", async () => {
    const doc = await parse("# comment\nname = \"test\"");
    const nonAssignments = doc.elements.filter(
      (e) => "NonAssignment" in e
    );
    expect(nonAssignments.length).toBeGreaterThanOrEqual(1);
  });
});
