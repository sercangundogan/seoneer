import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles =
    variant === "primary"
      ? "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
      : variant === "secondary"
        ? "bg-[var(--bg-elevated)] text-[var(--fg)] border border-[var(--border)] hover:bg-[#f0eee8]"
        : variant === "danger"
          ? "bg-[var(--danger)] text-white"
          : "bg-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]";
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[var(--radius)] px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm ${className}`}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm ${className}`}
      {...props}
    />
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "warning" | "success" | "danger";
}) {
  const colors =
    tone === "accent"
      ? "text-[var(--accent)] border-[var(--accent)]/30"
      : tone === "warning"
        ? "text-[var(--warning)] border-[var(--warning)]/30"
        : tone === "success"
          ? "text-[var(--success)] border-[var(--success)]/30"
          : tone === "danger"
            ? "text-[var(--danger)] border-[var(--danger)]/30"
            : "text-[var(--fg-muted)] border-[var(--border)]";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${colors}`}
    >
      {children}
    </span>
  );
}
