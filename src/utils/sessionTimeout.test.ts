import { describe, expect, it } from "vitest";

import {
  createSessionExpiry,
  isSessionExpired,
  renewIdleExpiry,
} from "./sessionTimeout";

describe("session timeout helpers", () => {
  it("creates idle and absolute expiry dates", () => {
    const now = new Date("2026-05-26T00:00:00.000Z");
    const expiry = createSessionExpiry(now);

    expect(expiry.idleExpiresAt.getTime() - now.getTime()).toBe(30 * 60 * 1_000);
    expect(expiry.expiresAt.getTime() - now.getTime()).toBe(24 * 60 * 60 * 1_000);
  });

  it("detects expired and revoked sessions", () => {
    const now = new Date("2026-05-26T01:00:00.000Z");

    expect(
      isSessionExpired(
        {
          expiresAt: new Date("2026-05-26T02:00:00.000Z"),
          idleExpiresAt: new Date("2026-05-26T00:59:00.000Z"),
          revokedAt: null,
        },
        now,
      ),
    ).toBe(true);

    expect(
      isSessionExpired(
        {
          expiresAt: new Date("2026-05-26T02:00:00.000Z"),
          idleExpiresAt: new Date("2026-05-26T01:30:00.000Z"),
          revokedAt: now,
        },
        now,
      ),
    ).toBe(true);
  });

  it("does not renew idle expiry past absolute expiry", () => {
    const now = new Date("2026-05-26T23:50:00.000Z");
    const expiresAt = new Date("2026-05-27T00:00:00.000Z");

    expect(renewIdleExpiry(expiresAt, now)).toBe(expiresAt);
  });
});
