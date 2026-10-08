import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

describe("permissions policy", () => {
  it("allows microphone and camera only for this origin", async () => {
    const rules = await nextConfig.headers?.();
    const policy =
      rules
        ?.flatMap((rule) => rule.headers)
        .find((header) => header.key === "Permissions-Policy")?.value ?? "";

    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=(self)");
    expect(policy).toContain("geolocation=()");
    expect(policy).not.toMatch(/microphone=\(\)/);
    expect(policy).not.toMatch(/camera=\(\)/);
  });
});
