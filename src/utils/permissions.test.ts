import { describe, expect, it } from "vitest";

import { hasPermission } from "./permissions";

describe("hasPermission", () => {
  it("allows admin to manage users", () => {
    expect(hasPermission("ADMIN", "user.create")).toBe(true);
    expect(hasPermission("ADMIN", "audit_log.read")).toBe(true);
  });

  it("blocks non-admin user management", () => {
    expect(hasPermission("WAREHOUSE_MANAGER", "user.create")).toBe(false);
    expect(hasPermission("WAREHOUSE_STAFF", "user.change_role")).toBe(false);
    expect(hasPermission("VIEWER", "user.reset_password")).toBe(false);
  });
});
