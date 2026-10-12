import { describe, expect, it } from "vitest";
import { compareToSourceRange } from "./ranges";

describe("compareToSourceRange", () => {
  it("detects values inside a numeric range", () => {
    expect(compareToSourceRange("13.2", "12-16")).toBe("in_range");
    expect(compareToSourceRange("12", "12-16")).toBe("in_range");
  });

  it("detects values outside a numeric range", () => {
    expect(compareToSourceRange("11.1", "12-16")).toBe("out_of_range");
  });

  it("does not invent a range when none is supplied", () => {
    expect(compareToSourceRange("13.2", "")).toBe("unavailable");
    expect(compareToSourceRange("13.2", undefined)).toBe("unavailable");
  });

  it("handles inequality ranges from the source", () => {
    expect(compareToSourceRange("4", "<5")).toBe("in_range");
    expect(compareToSourceRange("6", "<5")).toBe("out_of_range");
    expect(compareToSourceRange("10", ">=9")).toBe("in_range");
  });

  it("marks unparseable ranges as unavailable rather than guessing", () => {
    expect(compareToSourceRange("13", "see comments")).toBe("unavailable");
  });
});
