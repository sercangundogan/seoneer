import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { ensureWorkspaceForUser } from "@/modules/workspaces/service";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID ?? env.GITHUB_APP_CLIENT_ID ?? "missing",
      clientSecret: env.GITHUB_CLIENT_SECRET ?? env.GITHUB_APP_CLIENT_SECRET ?? "missing",
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await ensureWorkspaceForUser({
            userId: createdUser.id,
            name: createdUser.name || createdUser.email.split("@")[0] || "Workspace",
          });
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
