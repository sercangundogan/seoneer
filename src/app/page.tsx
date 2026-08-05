import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/primitives";
import { auth } from "@/modules/auth";
import { SITE_EMAIL } from "@/lib/site";

const STEPS = [
  {
    title: "Connect your repository",
    description:
      "Install the GitHub App and link Google Search Console. Seoneer only works on repos you grant access to.",
  },
  {
    title: "It learns your product",
    description:
      "Reads your codebase and site structure to understand what you build, who it is for, and where SEO gaps exist.",
  },
  {
    title: "One action per cycle",
    description:
      "Picks the single highest-value safe improvement — a title fix, internal link, technical patch, or article update.",
  },
  {
    title: "Review the pull request",
    description:
      "Every change ships as a PR on a branch. You approve, edit, or merge. Nothing writes to your default branch.",
  },
] as const;

const CAPABILITIES = [
  "Titles, meta descriptions, and heading structure",
  "Internal linking and site architecture",
  "Technical SEO — sitemaps, indexability, structured data",
  "Articles created or refreshed when they genuinely help users",
  "Search Console signals folded into prioritization",
] as const;

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const ctaHref = session?.user ? "/home" : "/signin";
  const ctaLabel = session?.user ? "Open workspace" : "Connect GitHub";

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
        <Link href={ctaHref} className="text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
          {session?.user ? "Open workspace" : "Sign in"}
        </Link>
      </header>

      <main className="relative">
        <section className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10 md:pt-16">
          <p className="animate-fade-up text-sm font-medium text-[var(--accent)]">Seoneer</p>
          <h1 className="animate-fade-up mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-[var(--fg)] md:text-5xl">
            An autonomous SEO engineer for your GitHub repository
          </h1>
          <p className="animate-fade-up mt-5 max-w-xl text-lg text-[var(--fg-muted)]">
            Understands your product and codebase, picks the highest-value safe action, and ships
            it as a pull request — not a content farm.
          </p>
          <div className="animate-fade-up mt-8 flex flex-wrap gap-3">
            <Link href={ctaHref}>
              <Button>{ctaLabel}</Button>
            </Link>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/40">
          <div className="mx-auto w-full max-w-5xl px-6 py-20">
            <p className="text-sm font-medium text-[var(--accent)]">How it works</p>
            <h2 className="mt-2 max-w-lg text-2xl font-semibold tracking-tight text-[var(--fg)]">
              From repository to reviewed PR
            </h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-2">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-5">
                  <span className="mt-0.5 shrink-0 font-mono text-sm text-[var(--accent)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-medium text-[var(--fg)]">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto w-full max-w-5xl px-6 py-20">
            <div className="grid gap-12 md:grid-cols-2 md:gap-16">
              <div>
                <p className="text-sm font-medium text-[var(--accent)]">What it handles</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--fg)]">
                  Real SEO work, not dashboard noise
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-[var(--fg-muted)]">
                  Seoneer focuses on changes that move organic traffic — implemented in your
                  codebase, not suggested in a spreadsheet.
                </p>
              </div>
              <ul className="space-y-4">
                {CAPABILITIES.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-[var(--fg-muted)]">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/40">
          <div className="mx-auto w-full max-w-5xl px-6 py-20">
            <p className="text-sm font-medium text-[var(--accent)]">Built for</p>
            <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight text-[var(--fg)]">
              Teams who ship code, not SEO campaigns
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--fg-muted)]">
              Technical founders, indie hackers, and small dev teams running Next.js on GitHub.
              You want organic growth without hiring an agency or babysitting another dashboard.
              Seoneer works like a careful engineer on your repo — one focused PR at a time.
            </p>
          </div>
        </section>

        <section className="border-t border-[var(--border)]">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 py-20 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[var(--fg)]">
                Ready to connect your repo?
              </h2>
              <p className="mt-2 max-w-md text-sm text-[var(--fg-muted)]">
                Setup takes a few minutes. Your first action arrives as a pull request you can
                review before anything merges.
              </p>
            </div>
            <Link href={ctaHref} className="shrink-0">
              <Button>{ctaLabel}</Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-[var(--border)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-semibold tracking-tight">Seoneer</span>
          <div className="flex flex-col gap-1 text-sm text-[var(--fg-muted)] sm:items-end">
            <p>
              Questions or support?{" "}
              <a href={`mailto:${SITE_EMAIL}`} className="text-[var(--fg)] hover:text-[var(--accent)]">
                {SITE_EMAIL}
              </a>
            </p>
            <p className="text-xs">We read every email.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
