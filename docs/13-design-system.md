# Initial Design System

## Product feel

An intelligent **operations workspace** — calm, minimal, modern. Not a chatbot. Not a dense analytics dashboard.

## Visual direction

- Generous whitespace
- Strong, expressive typography (avoid Inter / Roboto / Arial / system-only stacks)
- Neutral surfaces with subtle borders
- **One** restrained accent colour
- Small, purposeful animations (status transitions, 2–3 intentional motions)
- Accessible focus states
- Responsive layouts

## Avoid

- AI sparkle clichés, robot illustrations
- Excessive gradients, glassmorphism, glow
- Large numbers of cards
- Dense settings pages
- Decorative animation, unnecessary modals
- Chat-first interaction
- Purple-on-white / purple-indigo defaults
- Warm cream + terracotta “AI brochure” look
- Broadsheet newspaper density

## CSS variables (initial)

```css
:root {
  --bg: #f7f6f3;
  --bg-elevated: #ffffff;
  --fg: #141414;
  --fg-muted: #5c5c5c;
  --border: #e6e4df;
  --accent: #0f6b5c;      /* restrained teal-green */
  --accent-fg: #ffffff;
  --danger: #a33b2c;
  --warning: #8a6d1d;
  --success: #1f6b3a;
  --radius: 8px;
  --font-sans: "Geist", "Segoe UI", sans-serif;
  --font-display: "Geist", "Segoe UI", sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;
}
```

Typography may use Geist (Vercel) or another distinctive pair; display weight for brand/product name on marketing only. In-app: quiet hierarchy.

## Layout

- App shell: left nav (minimal) + main canvas
- Marketing: brand-first hero (brand as hero-level signal), one headline, one supporting sentence, one CTA group — no card grids in hero

## Dashboard composition

Answer immediately:

1. What is the agent doing?
2. Why?
3. What happened recently?
4. What needs attention?
5. What impact was created?

Prefer a single primary status region + short lists over many metric cards.

## Components (MVP primitives)

- Button, Input, Textarea, Select
- Badge / status pill (restrained, not rounded-full candy)
- Table (activity log)
- Skeleton (only where beneficial)
- Toast / inline alert
- Empty state (text-first, no robots)

## Motion

- Status cross-fade / soft highlight when agent state changes
- Progress on long jobs (indeterminate bar, not spinners everywhere)
- Page enter: subtle opacity/translate once

## Content tone in UI

- Direct, technical, calm
- Decision summaries from agents shown as plain language
- No hype copy (“unleash AI growth”)
