import { describe, expect, it } from "vitest";

import { getResponseTimeSeverity, getResponseTimeStatus } from "./rules";

describe("monitoring response-time rules", () => {
  it("marks normal response time as healthy", () => {
    expect(getResponseTimeStatus(250)).toBe("healthy");
    expect(getResponseTimeSeverity(250)).toBeNull();
  });

  it("marks slow response time as warning", () => {
    expect(getResponseTimeStatus(1500)).toBe("degraded");
    expect(getResponseTimeSeverity(1500)).toBe("warning");
  });

  it("marks very slow response time as critical", () => {
    expect(getResponseTimeStatus(3500)).toBe("down");
    expect(getResponseTimeSeverity(3500)).toBe("critical");
  });
});
