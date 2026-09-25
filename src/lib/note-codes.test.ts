import { describe, expect, it } from "vitest";
import { parseNoteLabels } from "./note-codes";

describe("parseNoteLabels", () => {
  it("recognizes each code on its own", () => {
    expect(parseNoteLabels("W tire install")).toEqual(["WAITING"]);
    expect(parseNoteLabels("DO dropped off early")).toEqual(["DROP_OFF"]);
    expect(parseNoteLabels("TO tire install")).toEqual(["TIRE_ONLY"]);
  });

  it("accepts a space, colon, dash, or end of note as the terminator", () => {
    expect(parseNoteLabels("W tire install")).toEqual(["WAITING"]);
    expect(parseNoteLabels("W: tire install")).toEqual(["WAITING"]);
    expect(parseNoteLabels("W- tire install")).toEqual(["WAITING"]);
    expect(parseNoteLabels("W")).toEqual(["WAITING"]);
  });

  it("supports both allowed two-label combinations", () => {
    expect(parseNoteLabels("W TO tire install")).toEqual(["WAITING", "TIRE_ONLY"]);
    expect(parseNoteLabels("DO TO tire install")).toEqual(["DROP_OFF", "TIRE_ONLY"]);
  });

  it("recognizes codes at the start of separate notes after ·", () => {
    expect(
      parseNoteLabels("ORDERED USAF < Date: 09/22/2026 03:17 PM User: CJ > · W tire install"),
    ).toEqual(["WAITING"]);
    expect(parseNoteLabels("W · TO tire install")).toEqual(["WAITING", "TIRE_ONLY"]);
    expect(parseNoteLabels("DO drop it off · TO no mount needed")).toEqual([
      "DROP_OFF",
      "TIRE_ONLY",
    ]);
  });

  it("shows no label for an unmarked note", () => {
    expect(parseNoteLabels("tire install")).toEqual([]);
    expect(
      parseNoteLabels("ORDERED USAF < Date: 09/22/2026 03:17 PM User: CJ > · tire install"),
    ).toEqual([]);
    expect(parseNoteLabels(null)).toEqual([]);
    expect(parseNoteLabels("")).toEqual([]);
  });

  it("does not match ordinary words that merely start with a code's letters", () => {
    expect(parseNoteLabels("Wheel bearing noise")).toEqual([]);
    expect(parseNoteLabels("DOOR seal replaced")).toEqual([]);
    expect(parseNoteLabels("to be scheduled")).toEqual([]);
    expect(parseNoteLabels("TOMORROW pickup")).toEqual([]);
    expect(parseNoteLabels("DOWNSHIFT issue")).toEqual([]);
  });

  it("shows neither WAITING nor DROP OFF when both codes conflict, but keeps TIRE ONLY", () => {
    expect(parseNoteLabels("W diagnostic · DO customer dropped off")).toEqual([]);
    expect(parseNoteLabels("W TO tire install · DO also")).toEqual(["TIRE_ONLY"]);
  });

  it("preserves the original note text (parsing is read-only)", () => {
    const note = "W tire install";
    parseNoteLabels(note);
    expect(note).toBe("W tire install");
  });
});
