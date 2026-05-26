import { describe, expect, it } from "vitest";

import { validatePasswordStrength } from "./passwordPolicy";

describe("validatePasswordStrength", () => {
  it("accepts a strong password", () => {
    expect(validatePasswordStrength("Demo#12345").isValid).toBe(true);
  });

  it("rejects a weak password with clear messages", () => {
    const result = validatePasswordStrength("password");

    expect(result.isValid).toBe(false);
    expect(result.messages).toContain("Password wajib memiliki minimal 1 huruf besar.");
    expect(result.messages).toContain("Password wajib memiliki minimal 1 angka.");
    expect(result.messages).toContain("Password wajib memiliki minimal 1 simbol.");
  });
});
