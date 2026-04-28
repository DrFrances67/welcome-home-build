import { describe, it, expect } from "vitest";
import {
  repairAndParse,
  stripFences,
  stripControlChars,
  sliceContainer,
  removeTrailingCommas,
  repairTruncatedArray,
  bruteClose,
} from "../lib/repairJson";

describe("stripFences", () => {
  it("removes ```json … ``` wrappers", () => {
    expect(stripFences("```json\n[1,2]\n```")).toBe("[1,2]");
  });
  it("is case-insensitive and tolerant of plain ```", () => {
    expect(stripFences("```JSON [1] ```")).toBe("[1]");
  });
  it("returns empty string for nullish input", () => {
    expect(stripFences(undefined as unknown as string)).toBe("");
  });
});

describe("stripControlChars", () => {
  it("removes NUL and other C0 control chars but keeps \\n and \\t", () => {
    const out = stripControlChars("a\u0000b\tc\nd\u0007e");
    expect(out).toBe("ab\tc\nde");
  });
});

describe("sliceContainer", () => {
  it("extracts the array even when surrounded by prose", () => {
    expect(sliceContainer("Sure! Here you go: [1,2,3]. Done.", "array")).toBe("[1,2,3]");
  });
  it("extracts the object", () => {
    expect(sliceContainer('blah {"a":1} tail', "object")).toBe('{"a":1}');
  });
  it("auto-detects whichever opener comes first", () => {
    expect(sliceContainer('Pre {"x":1} ', "auto")).toBe('{"x":1}');
    expect(sliceContainer("Pre [1,2] ", "auto")).toBe("[1,2]");
  });
});

describe("removeTrailingCommas", () => {
  it("strips trailing commas before ] and }", () => {
    expect(removeTrailingCommas('[1,2,3,]')).toBe('[1,2,3]');
    expect(removeTrailingCommas('{"a":1,"b":2,}')).toBe('{"a":1,"b":2}');
    expect(removeTrailingCommas('[{"a":1,},{"b":2,},]'))
      .toBe('[{"a":1},{"b":2}]');
  });
});

describe("repairTruncatedArray", () => {
  it("closes an array truncated mid-object", () => {
    const truncated = '[{"level":1,"items":["a"]},{"level":2,"items":["b"';
    const repaired = repairTruncatedArray(truncated);
    expect(repaired.endsWith("]")).toBe(true);
    expect(() => JSON.parse(repaired)).not.toThrow();
  });
});

describe("bruteClose", () => {
  it("closes nested unbalanced brackets in correct order", () => {
    expect(bruteClose("[1,[2,{\"a\":3")).toBe("[1,[2,{\"a\":3}]]");
  });
  it("terminates an unterminated string before closing", () => {
    const closed = bruteClose('[{"a":"hello');
    expect(() => JSON.parse(closed)).not.toThrow();
  });
  it("ignores brackets inside strings", () => {
    const closed = bruteClose('[{"a":"]}["');
    expect(() => JSON.parse(closed)).not.toThrow();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// repairAndParse — end-to-end with realistic broken DOK payloads
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("repairAndParse", () => {
  it("parses well-formed JSON unchanged", () => {
    const out = repairAndParse<number[]>("[1,2,3]");
    expect(out).toEqual([1, 2, 3]);
  });

  it("handles markdown-fenced JSON", () => {
    const wrapped = '```json\n[{"level":1,"items":["a","b"]}]\n```';
    const out = repairAndParse<Array<{ level: number; items: string[] }>>(wrapped);
    expect(out[0].items).toEqual(["a", "b"]);
  });

  it("handles AI prose preamble + trailing commentary", () => {
    const noisy = 'Here are 4 levels:\n[{"level":1,"items":["x"]}]\nLet me know if you need more!';
    const out = repairAndParse<unknown[]>(noisy);
    expect(Array.isArray(out)).toBe(true);
    expect(out).toHaveLength(1);
  });

  it("repairs trailing commas", () => {
    const out = repairAndParse<number[]>("[1,2,3,]");
    expect(out).toEqual([1, 2, 3]);
  });

  it("repairs the exact truncation shape from the original error report", () => {
    // Position 840-ish truncation — array cut mid-string
    const truncated =
      '[' +
      '{"level":1,"label":"Recall & Reproduction","items":["Who is the main character?","What happened first?","What is the title of the story?"]},' +
      '{"level":2,"label":"Skills & Concepts","items":["Describe how the character felt.","Sort the events from beginning to end.","Show the part where the problem starts."]},' +
      '{"level":3,"label":"Strategic Thinking","items":["Why do you think the character made that choice?","Predict what would happen if the setting were different.","Use evidence from the text to expla';
    const out = repairAndParse<Array<{ level: number; items: string[] }>>(truncated);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out[0].items[0]).toMatch(/main character/);
    expect(out[1].label).toBe("Skills & Concepts");
  });

  it("repairs control characters embedded mid-string", () => {
    const dirty = '[{"level":1,"items":["hello\u0001world"]}]';
    const out = repairAndParse<Array<{ items: string[] }>>(dirty);
    expect(out[0].items[0]).toBe("helloworld");
  });

  it("repairs both trailing commas AND truncation in one payload", () => {
    const ugly = '[{"level":1,"items":["a","b",]},{"level":2,"items":["c","d"';
    const out = repairAndParse<Array<{ level: number; items: string[] }>>(ugly);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].items).toContain("a");
  });

  it("repairs an object payload truncated mid-value", () => {
    const truncated = '{"title":"DOK","levels":[{"level":1,"items":["x"]},{"level":2,"items":["y"';
    const out = repairAndParse<{ title: string; levels: unknown[] }>(truncated, { container: "object" });
    expect(out.title).toBe("DOK");
    expect(Array.isArray(out.levels)).toBe(true);
  });

  it("throws SyntaxError when input is unrecoverably malformed", () => {
    expect(() => repairAndParse("not json at all !!!")).toThrow(SyntaxError);
  });

  it("never throws on the simulated 'position 840' DOK error", () => {
    // Build a string that actually has a syntax error around column 840.
    const items = Array.from({ length: 12 }, (_, i) => `"question number ${i} is here"`);
    const truncated = `[{"level":1,"label":"Recall","items":[${items.join(",")}]},{"level":2,"label":"Skills","items":["foo","bar"`;
    expect(truncated.length).toBeGreaterThan(400);
    expect(() => repairAndParse(truncated)).not.toThrow();
    const out = repairAndParse<Array<{ level: number; items: string[] }>>(truncated);
    expect(out[0].level).toBe(1);
  });

  it("handles multiple control characters and Unicode safely", () => {
    const dirty = '[{"level":1,"items":["caf\u00e9\u0000","na\u00efve\u0007"]}]';
    const out = repairAndParse<Array<{ items: string[] }>>(dirty);
    expect(out[0].items[0]).toBe("café");
    expect(out[0].items[1]).toBe("naïve");
  });
});
