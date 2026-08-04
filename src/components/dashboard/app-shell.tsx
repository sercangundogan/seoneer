import Link from "next/link";

const links = [
  { href: "/dashboard", label: "Overview" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/billing", label: "Billing" },
];

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-6 md:border-b-0 md:border-r">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Seoneer
        </Link>
        <p className="mt-1 text-xs text-[var(--fg-muted)]">SEO operations</p>
        <nav className="mt-8 flex flex-col gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[var(--radius)] px-3 py-2 text-sm text-[var(--fg-muted)] transition hover:bg-[var(--bg)] hover:text-[var(--fg)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="px-6 py-8 md:px-10">
        {title ? (
          <h1 className="mb-6 text-2xl font-semibold tracking-tight animate-fade-up">{title}</h1>
        ) : null}
        <div className="animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
