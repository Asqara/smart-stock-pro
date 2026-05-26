import { describe, expect, it } from "vitest";

import { categorizeErrorSeverity } from "./severity";

describe("categorizeErrorSeverity", () => {
  it("maps infrastructure failures to critical", () => {
    expect(categorizeErrorSeverity(new Error("Database connection failed"))).toBe(
      "critical",
    );
  });

  it("maps email failures to warning", () => {
    expect(categorizeErrorSeverity(new Error("Email delivery failed"))).toBe(
      "warning",
    );
  });

  it("keeps recoverable errors as info", () => {
    expect(categorizeErrorSeverity(new Error("Validation notice"))).toBe("info");
  });
});
