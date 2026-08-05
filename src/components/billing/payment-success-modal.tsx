"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/primitives";

type PaymentSuccessModalProps = {
  open: boolean;
  onClose: () => void;
};

const ACTIONS = [
  {
    href: "/dashboard",
    title: "Go to Overview",
    description: "Check agent status and kick off your next SEO Action.",
  },
  {
    href: "/projects/new",
    title: "Add a project",
    description: "Connect a GitHub repo so Seoneer can open pull requests.",
  },
] as const;

const CONFETTI_COLORS = ["#0f6b5c", "#1f6b3a", "#2a9d8f", "#c4a35a", "#e8e4d9", "#141414"];

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  spin: number;
  opacity: number;
  life: number;
};

function createParticles(width: number, height: number, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const fromLeft = Math.random() > 0.5;
    particles.push({
      x: fromLeft ? width * (0.15 + Math.random() * 0.2) : width * (0.65 + Math.random() * 0.2),
      y: height * (0.25 + Math.random() * 0.15),
      vx: (fromLeft ? 1 : -1) * (2 + Math.random() * 5),
      vy: -(6 + Math.random() * 8),
      w: 5 + Math.random() * 5,
      h: 8 + Math.random() * 8,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.25,
      opacity: 1,
      life: 0,
    });
  }
  return particles;
}

function ConfettiBurst({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (!active || reducedMotion.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    let particles: Particle[] = [];
    let running = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    particles = createParticles(window.innerWidth, window.innerHeight, 90);
    window.addEventListener("resize", resize);

    const tick = () => {
      if (!running) return;
      frame += 1;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (frame === 14) {
        particles = particles.concat(
          createParticles(window.innerWidth, window.innerHeight, 50),
        );
      }

      let alive = 0;
      for (const p of particles) {
        p.life += 1;
        p.vy += 0.18;
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        p.opacity = Math.max(0, 1 - p.life / 140);

        if (p.opacity <= 0) continue;
        alive += 1;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (alive > 0 || frame < 20) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden
    />
  );
}

export function PaymentSuccessModal({ open, onClose }: PaymentSuccessModalProps) {
  const titleId = useId();
  const descId = useId();
  const [mounted, setMounted] = useState(false);
  const [present, setPresent] = useState(false);
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      const hideTimer = window.setTimeout(() => setPresent(false), 320);
      return () => window.clearTimeout(hideTimer);
    }

    setPresent(true);
    const frame = requestAnimationFrame(() => setVisible(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 50);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!mounted || !present) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="presentation">
      <button
        type="button"
        aria-label="Dismiss celebration"
        className={`absolute inset-0 bg-[color-mix(in_srgb,var(--fg)_42%,transparent)] transition-opacity duration-500 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <ConfettiBurst active={visible} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={`relative z-20 w-full max-w-md overflow-hidden rounded-[calc(var(--radius)+4px)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_80px_rgba(20,20,20,0.18)] outline-none transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-[0.97] opacity-0"
        }`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(120%_80%_at_50%_-10%,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_70%)]"
          aria-hidden
        />

        <div className="relative px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10">
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              visible ? "scale-100" : "scale-75"
            }`}
          >
            <svg
              className="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <path
                className="payment-success-check"
                d="M5.5 12.5l4.2 4.2L18.5 7.5"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <h2
            id={titleId}
            className={`mt-5 text-center text-2xl font-semibold tracking-tight text-[var(--fg)] transition-all duration-500 delay-75 ease-out ${
              visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            You&apos;re all set
          </h2>
          <p
            id={descId}
            className={`mt-2 text-center text-sm leading-relaxed text-[var(--fg-muted)] transition-all duration-500 delay-100 ease-out ${
              visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            Payment received. Your plan and SEO Action credits will appear shortly after Dodo
            confirms the subscription.
          </p>

          <div className="mt-7">
            <p
              className={`text-xs font-medium uppercase tracking-[0.08em] text-[var(--fg-muted)] transition-opacity duration-500 delay-150 ${
                visible ? "opacity-100" : "opacity-0"
              }`}
            >
              What you can do now
            </p>
            <ul className="mt-3 space-y-2">
              {ACTIONS.map((action, index) => (
                <li
                  key={action.href}
                  className={`transition-all duration-500 ease-out ${
                    visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
                  }`}
                  style={{ transitionDelay: `${180 + index * 70}ms` }}
                >
                  <Link
                    href={action.href}
                    className="group block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg)] px-4 py-3 transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px hover:border-[var(--accent)]/40 hover:bg-[var(--bg-elevated)]"
                    onClick={onClose}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-[var(--fg)]">{action.title}</span>
                      <span
                        className="text-[var(--accent)] transition-transform duration-200 group-hover:translate-x-0.5"
                        aria-hidden
                      >
                        →
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-[var(--fg-muted)]">
                      {action.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`mt-6 flex justify-center transition-opacity duration-500 delay-300 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
          >
            <Button type="button" variant="ghost" onClick={onClose}>
              Stay on billing
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
