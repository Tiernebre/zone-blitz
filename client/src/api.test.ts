import { describe, expect, it } from "vitest";
import { api } from "./api.ts";

describe("api", () => {
  it("exports a configured hono client", () => {
    expect(api).toBeDefined();
    expect(api.api).toBeDefined();
  });
});
