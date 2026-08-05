import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { sendWelcomeEmail } from "@/modules/notifications/service";
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
  baseURL: env.BETTER_AUTH_URL ?? env.NEXT_PUBLIC_APP_URL,
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
  },
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

          // Welcome mail must not block signup if Resend fails
          try {
            await sendWelcomeEmail({
              to: createdUser.email,
              name: createdUser.name,
              userId: createdUser.id,
            });
          } catch (error) {
            console.error("Welcome email failed", error);
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
