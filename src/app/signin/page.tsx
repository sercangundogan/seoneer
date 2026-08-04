"use client";

import { createAuthClient } from "better-auth/react";
import { Button } from "@/components/ui/primitives";

const authClient = createAuthClient();

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Seoneer</h1>
      <p className="mt-2 text-sm text-[var(--fg-muted)]">
        Use GitHub to access your workspace. Repository access is granted separately via the GitHub App.
      </p>
      <Button
        className="mt-6"
        onClick={() => void authClient.signIn.social({ provider: "github", callbackURL: "/dashboard" })}
      >
        Continue with GitHub
      </Button>
    </main>
  );
}
