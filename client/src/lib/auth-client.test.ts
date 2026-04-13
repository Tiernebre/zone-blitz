import { describe, expect, it } from "vitest";
import { authClient } from "./auth-client.ts";

describe("authClient", () => {
  it("is defined with expected auth methods", () => {
    expect(authClient).toBeDefined();
    expect(authClient.signIn).toBeDefined();
    expect(authClient.signIn.social).toBeDefined();
    expect(authClient.signOut).toBeDefined();
    expect(authClient.useSession).toBeDefined();
  });
});
