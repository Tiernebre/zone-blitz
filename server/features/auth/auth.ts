import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../../db/connection.ts";
import * as authSchema from "./auth.schema.ts";

export function createAuth(
  deps: { db: Database; googleClientId: string; googleClientSecret: string },
) {
  return betterAuth({
    database: drizzleAdapter(deps.db, {
      provider: "pg",
      schema: {
        user: authSchema.users,
        session: authSchema.sessions,
        account: authSchema.accounts,
        verification: authSchema.verifications,
      },
    }),
    basePath: "/api/auth",
    trustedOrigins: Deno.env.get("BETTER_AUTH_TRUSTED_ORIGINS")?.split(",") ??
      [],
    socialProviders: {
      google: {
        clientId: deps.googleClientId,
        clientSecret: deps.googleClientSecret,
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
