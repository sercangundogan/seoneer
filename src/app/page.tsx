import Link from "next/link";
import { Button } from "@/components/ui/primitives";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(15,107,92,0.12), transparent), linear-gradient(180deg, #f7f6f3 0%, #efece6 100%)",
        }}
      />
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">Seoneer</span>
        <Link href="/signin" className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
          Sign in
        </Link>
      </header>
      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-24 pt-16">
        <p className="text-sm font-medium text-[var(--accent)]">Seoneer</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-[var(--fg)] md:text-5xl">
          An autonomous SEO engineer for your GitHub repository
        </h1>
        <p className="mt-5 max-w-xl text-lg text-[var(--fg-muted)]">
          Understands your product and codebase, picks the highest-value safe action, and ships it as a pull request — not a content farm.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signin">
            <Button>Connect GitHub</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="secondary">Open workspace</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
