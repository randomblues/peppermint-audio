import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./route";

describe("pickup reminder cron authorization", () => {
  it("requires the configured bearer secret", () => {
    expect(isCronAuthorized(new Request("http://localhost"), "secret")).toBe(false);
    expect(isCronAuthorized(new Request("http://localhost", { headers: { authorization: "Bearer wrong" } }), "secret")).toBe(false);
    expect(isCronAuthorized(new Request("http://localhost", { headers: { authorization: "Bearer secret" } }), "secret")).toBe(true);
  });
});
