# User Flows

## 1. Onboarding (minimal decisions)

```mermaid
flowchart TD
  SignIn[Sign in with GitHub] --> Install[Install GitHub App]
  Install --> SelectRepo[Select repository]
  SelectRepo --> Analyse[Safe repository analysis]
  Analyse --> Confirm[Confirm or edit product summary]
  Confirm --> Goal[Select primary SEO goal]
  Goal --> Control[Select control level]
  Control --> Start[Start initial analysis]
```

### Steps

1. **Connect GitHub** — OAuth sign-in; then GitHub App installation for repo access.
2. **Select repository** — List repos the installation can access; create a Project.
3. **Confirm product summary** — Show generated Project Intelligence Profile; allow edits to name, summary, audiences, conversion goals.
4. **Select primary SEO goal** — e.g. grow organic signups, support product education, technical SEO hygiene.
5. **Select control level** — review every change / one-click approve / auto-merge safe.
6. **Start initial analysis** — Enqueue audit + roadmap jobs; redirect to dashboard.

## 2. Initial analysis

```mermaid
sequenceDiagram
  participant User
  participant App
  participant Jobs as Trigger.dev
  participant GH as GitHub
  participant GSC as SearchConsole
  User->>App: Start analysis
  App->>Jobs: enqueue initialAnalysis
  Jobs->>GH: Map and read relevant files
  Jobs->>Jobs: Project Intelligence Agent
  Jobs->>GSC: Fetch performance snapshots if connected
  Jobs->>Jobs: Technical and content audit
  Jobs->>Jobs: Build prioritised roadmap
  Jobs-->>App: Persist results
  App-->>User: Dashboard shows status and findings
```

Optional: GSC can be connected during or after onboarding. Without GSC, analysis proceeds with lower confidence and may select `WAIT_FOR_MORE_DATA` more often.

## 3. SEO action cycle

```mermaid
sequenceDiagram
  participant Orch as Orchestrator
  participant SS as ActionSelector
  participant RS as Researcher
  participant CA as ContentArchitect
  participant WR as Writer
  participant RV as SEOReviewer
  participant CD as CodeAgent
  participant GH as GitHub
  participant User
  Orch->>SS: Select highest-value action
  alt NO_ACTION or WAIT or REQUEST_INFO
    SS-->>User: Explainable idle or ask state
  else Action selected
    Orch->>RS: Research
    Orch->>CA: Brief
    Orch->>WR: Draft content or patch plan
    Orch->>RV: Quality gates
    alt Gates fail
      RV-->>Orch: Stop and log
    else Gates pass
      Orch->>CD: Branch and commits
      CD->>GH: Open PR
      GH-->>User: Review or approve
    end
  end
```

## 4. Email approval

1. PR ready → Resend email: what changed, why, expected benefit, file count/types, check status, Approve and Publish, Review Changes.
2. Approve link is signed, single-purpose, short-lived, auditable, replay-protected.
3. Before merge, revalidate: user auth, PR state, commit SHA, required checks, mergeability, subscription, publication policy.
4. On success: merge (if allowed), record audit log, consume reserved credits, notify user.

## 5. Auto-merge safe path

Eligible only when:

- Publication mode = auto-merge safe
- Action type is on the safe allowlist
- All quality gates and required checks pass
- Change does not touch protected / review-required paths
- Subscription active and credits available

Otherwise fall back to human review.

## 6. Billing upgrade

1. User hits credit or free-entitlement limit.
2. Dashboard shows upgrade CTA (no token meters).
3. Dodo checkout → webhook → activate plan + monthly SEO Action credits.
4. Portal for manage / cancel / payment method.

## 7. No-action / wait / request info

- **NO_ACTION** — Insufficient value or risk; show rationale; do not burn full research credits.
- **WAIT_FOR_MORE_DATA** — Need GSC maturity, more site authority signals, or prior action results.
- **REQUEST_PRODUCT_INFORMATION** — Blocked on unverified product claims; ask concise questions; resume when answered.

## Primary dashboard questions

At a glance the UI must answer:

1. What is the agent doing?
2. Why is it doing it?
3. What happened recently?
4. What requires my attention?
5. What measurable impact has been created?
