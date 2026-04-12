import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../../db/connection.ts";
import * as authSchema from "./auth.schema.ts";

export function createAuth(deps: { db: Database }) {
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
    emailAndPassword: {
      enabled: true,
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
