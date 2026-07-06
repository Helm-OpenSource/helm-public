> **Language**: **English** · [中文](DESIGN.md)

# Helm Design

## 1. Purpose

This `DESIGN.md` defines the fixed visual and interface constraints for Helm's current mainline.

It does not answer "how should this particular page look this time". It answers what direction all future work on the home page, dashboard, operating, approvals, memory, detail, settings, setup, and demo shell should converge toward by default.

This document exists to:

- Unify Helm's long-term visual direction
- Reduce style drift between pages
- Keep product expression aligned with the `judgement-first / decision-first / formal review` product positioning
- Give subsequent Codex / design / engineering work a single fixed set of requirements

This document is currently not:

- A full design-system site
- A full component documentation platform
- A one-off marketing-page creative brief
- An inspiration list any page is free to break away from

## 2. Visual Direction in One Sentence

Helm should look like:

**an enterprise-grade business operating system**

and not like:

- a developer-tool control plane
- a premium fintech marketing site
- a consumer AI chat app
- a demo shell that leans on saturated gradients and exaggerated motion for atmosphere

Read all future work against this blended baseline:

- Enterprise trust and structure: `70%`
- AI product feel and modernity: `20%`
- Documentation-grade readability and explanatory clarity: `10%`

Reference directions can be understood as:

- `IBM`-style enterprise authority as the main foundation
- `Cohere`-style enterprise AI product feel as a light accent
- `Mintlify`-style explanatory readability as a supplement for docs and onboarding

Borrow only the "temperament and structure" here — do not copy specific pages.

## 3. How Helm Should Feel

What users should sense at first glance:

- Trustworthy
- Stable
- Restrained
- Has judgement
- Has governance boundaries
- Fit for high-frequency use, not demo-only

More concretely:

- The home page should feel like the entry to a formal commercial product, not an experimental AI landing page
- The dashboard should feel like an operating command surface, not a neutral BI panel
- Approvals should feel like a formal review layer, not an ordinary to-do list
- Memory/detail should feel like evidence and operating trace, not a stack of chat logs
- Settings/billing should feel like a product-grade governance interface, not a finance console or a grey back office

## 4. Product Expression Must Come Before Visual Decoration

Helm's visual work must by default serve these 5 product semantics:

1. `judgement-first`
2. `decision-first`
3. `review-before-commitment`
4. `recommendation != commitment`
5. **Serve first, do not educate users**

This means pages should by default answer, in priority order:

1. What Helm currently judges
2. Why it judges that way
3. What Helm has already advanced
4. Who needs to make which decision now
5. What action the user can take immediately

### 4.1 The "Do Not Try to Teach Users" Principle

**Core principle**: Helm is a service system, not an education system.

**Prohibited behavior**:
- ❌ Showing system explanations, architecture descriptions, or technical principles on the first screen
- ❌ Using instructional copy to explain "what ranking logic is" or "what the first loop is"
- ❌ Inserting system-introduction paragraphs into user operating flows
- ❌ Using instructional language such as "help you understand" or "let you know"

**Correct approach**:
- ✅ Directly show the actions and results the user needs
- ✅ Tuck system rationale into a secondary "why this judgement" layer
- ✅ Show detailed explanations only when the user actively clicks for them
- ✅ Replace system explanations with action outcomes

If a page leads with decoration, atmosphere, or fancy cards without making the 5 items above clear, it does not match Helm's design direction.

## 5. Visual System Baseline

### 5.1 Color and Contrast

Default principles:

- `light-first`
- `white / off-white + near-black + single accent` as the core
- Emphasize information hierarchy, not large fields of stylistic color
- Status colors are for status only, never decoration

Current recommended baseline:

- Primary background: light grey-white, on the calm side — no pure blue-black and no lifeless pure white
- Primary text: near-black, so long text and tables stay readable
- Primary accent: one line of deep blue-green / deep blue-grey is enough
- success / warning / danger: keep restrained; use only in approvals, risk, governance, and state changes

**Mandatory contrast requirements** (v2 update):
- All text must meet the WCAG AA standard (contrast ratio ≥ 4.5:1)
- Selected states in dark mode must guarantee high contrast between text and background
- Low-contrast combinations of "dark background + black text" are prohibited
- Status indicators must remain clearly legible in both light and dark modes

Implementation requirements going forward:

- By default, reuse the existing token families in `app/globals.css`: `--background`, `--surface`, `--accent`, `--border`, `--shadow-card`
- Pages are not allowed to hardcode their own new primary color
- Do not introduce multiple competing accent lines
- Demo themes may keep light differentiation, but must reduce saturation and the share of large color blocks

#### 5.1.1 Color Token Mapping Spec (v3)

It is **prohibited** to use raw Tailwind color tokens (`text-slate-600`, `bg-amber-50`, `ring-rose-200`, etc.) directly in business code. All colors must go through CSS vars so that light/dark modes can switch in one place.

**Standard mapping table** (used by batch codemods):

| Usage type | Old hardcoded form | CSS var to converge to |
| --- | --- | --- |
| Primary text / headings | `text-slate-{700,800,900,950}` | `text-[color:var(--foreground)]` |
| Secondary text / body | `text-slate-600` | `text-[color:var(--muted)]` |
| Weak auxiliary text / placeholders | `text-slate-{300,400,500}` | `text-[color:var(--muted-foreground)]` |
| Light background | `bg-slate-{50,100}` | `bg-[color:var(--surface-subtle)]` |
| Mid background / placeholder bars | `bg-slate-200` | `bg-[color:var(--border)]` |
| Strong placeholder bars / disabled track | `bg-slate-300` | `bg-[color:var(--border-strong)]` |
| Normal border / ring | `border-slate-200` / `ring-slate-200` | `border-[color:var(--border)]` / `ring-[color:var(--border)]` |
| Strong border / ring | `border-slate-300` / `ring-slate-300` | `border-[color:var(--border-strong)]` / `ring-[color:var(--border-strong)]` |
| Status text (success) | `text-emerald-{700,800}` | `text-[color:var(--status-success-text)]` |
| Status text (warning) | `text-amber-{700,800}` | `text-[color:var(--status-warning-text)]` |
| Status text (danger) | `text-{rose,red}-{700,800}` | `text-[color:var(--status-danger-text)]` |
| Status text (info) | `text-{sky,blue}-{700,800}` | `text-[color:var(--status-info-text)]` |
| Status light background | `bg-{emerald,amber,rose,red,sky,blue}-50` | `bg-[color:var(--status-{success,warning,danger,info}-bg)]` |
| Status border / ring | `border-{emerald,amber,rose,sky,blue}-{100,200}` | `border-[color:var(--status-{success,warning,danger,info}-border)]` |
| Strong status badge fill | `bg-emerald-700` / `border-emerald-700` | `bg-[color:var(--accent-success)]` |
| Strong status badge fill | `bg-rose-700` / `border-rose-700` | `bg-[color:var(--accent-danger)]` |
| Strong status badge fill | `bg-amber-700` / `border-amber-700` | `bg-[color:var(--accent-warm)]` |
| Strong status badge fill | `bg-sky-700` / `border-sky-700` | `bg-[color:var(--accent)]` |
| Warning text (inline) | `text-amber-600` | `text-[color:var(--accent-warm)]` |
| Danger text (inline) | `text-rose-600` | `text-[color:var(--accent-danger)]` |
| Dark inset surfaces | `bg-slate-{800,900,950}` | `bg-[color:var(--dark-inset-{overlay,surface,bg})]` |
| Dark inset borders | `border-slate-800` | `border-[color:var(--dark-inset-border)]` |
| Dark inset text | `text-slate-{100,200}` | `text-[color:var(--dark-inset-{foreground,muted})]` |
| Indigo accent | `bg-indigo-{400,500}` / `border-indigo-{200,400}` | Reuse `var(--accent)` / `var(--status-info-border)` — Helm does not maintain a separate indigo line |
| Gradient stops | `from-slate-50` / `to-blue-700` etc. | Wrap the corresponding CSS var in arbitrary-value syntax: `from-[color:var(--surface-subtle)]`, `to-[color:var(--accent-hover)]`, etc. |

**Manual-evaluation reserved zone** (must not be batch-replaced):

- Colors with opacity modifiers (`amber-400/20`, `emerald-400/15`, etc.) — convergence is not forced when the visual effect needs to be preserved
- The custom ESLint rule `helm-design-tokens/no-raw-tailwind-color` is registered at warn level in `eslint.config.mjs`; it becomes a gate when CI runs `lint:strict`. Pre-commit blocks new violations via husky + lint-staged.

**Dark inset semantics**: the `--dark-inset-*` family is a **fixed dark-card palette** that does not follow the light/dark theme switch. It is only for "locally dark card" semantics (demo emphasis cards, judgement glass cards). If a given inset should flip with the theme, use the ordinary tokens such as `--background` / `--surface` instead.

### 5.2 Typography

Default direction:

- Body: a modern sans-serif that prioritizes Chinese — steady, clear, comfortable for long reading sessions
- Headings: may carry more weight, but never theatrical
- Monospace: only for trace, IDs, timestamps, status, audit, and technical fields

Current requirements:

- If no dedicated font assets are introduced, keep using the current global sans stack
- If a font is formally introduced later, wire it in globally and uniformly — do not quietly swap fonts on individual pages
- Do not use monospace for long marketing copy or large primary UI headings

### 5.3 Layout and Density

Helm's layout should be:

- Structurally clear
- Steady in rhythm
- Medium-to-high in information density
- Restrained in whitespace without feeling cramped

Default constraints:

- Organize spacing with `8px`-grid thinking
- Separate cards through hierarchy and spacing, not excessive shadows
- The home page and marketing pages may breathe more, but product pages must not become a "full screen of floating cards"
- dashboard / approvals / operating / detail should all support fairly high information density by default

### 5.4 Radius, Borders, Shadows

Default style:

- Restrained corner radius
- Borders first
- Shadows second
- Create a sense of quality through hierarchy, not glassmorphism

Requirements going forward:

- Product surfaces should primarily use `12-16px` corner radius
- Hero or framing containers may be slightly larger, but do not create a split where "marketing pages have one radius system and product pages another"
- Prefer thin borders and light background differences to establish layering
- Shadows assist hierarchy only; they are never the visual protagonist

### 5.5 Motion

Motion carries only 3 responsibilities:

1. Guiding hierarchy on entry
2. Providing feedback on state changes
3. Helping users understand context switches

By default, do not do:

- Large floating drift
- Exaggerated parallax
- High-frequency pulsing
- Decorative motion unrelated to business judgement

### 5.6 Graphics and Illustration

Priority from high to low:

1. Data, timelines, status, chains, evidence
2. Structured icons
3. Simple diagrams
4. Decorative illustration

Helm is not a product that tells its story through illustration.
If visual atmosphere must be added, prefer typography, layering, controlled gradients, and structured explanation over stock illustration.

## 6. Page-Type Rules

### 6.1 Public Home Page

The home page should read like a "formal commercial entry point + operating thesis", not an "AI startup promo page".

Default home-page structure priority:

1. What Helm is
2. Why it is needed now
3. How it turns signal into a follow-through chain
4. How it preserves approvals, audit, and formal review
5. Which roles or scenarios it already serves
6. Only then consider demo / signup / program CTAs

Home-page visual requirements:

- High-contrast headlines, minimal filler
- Predominantly white or light backgrounds
- One primary accent, with a few dark sections carrying key moments
- Build credibility with real product interface structure or an operating narrative

Explicitly avoid:

- Purple or neon gradients as the base tone
- Piling too many floating badges into one screen
- Turning the home page into a chat-first hero
- Replacing product explanation with abstract spheres or meaningless light effects

### 6.2 Dashboard / Operating Home

This is Helm's primary judgement surface.

The first screen must by default answer first:

1. The 3 most important things right now
2. The 3 most important blockers right now
3. The 3 decisions most worth making right now
4. Why the system judges it this way
5. Who takes over next

**v2 simplification principles**:
- **Remove all instructional content**: do not explain "what ranking logic is" or "how the system works"
- **Remove redundant system narration**: do not display process descriptions like "Helm has prepared for you" or "the follow-through process"
- **Trim to the core**: reduced from 950+ lines of code to ~230 lines, removing 75% of the educational content
- **Action-oriented**: every section points directly to an action the user can take

However, on high-frequency, repeatedly used pages:

- "Why this judgement"
- "What Helm has already done"
- Longer guidance / assist / rationale

should by default be folded into disclosure / drawer / secondary layers and expanded on demand, rather than permanently occupying the prime position of the first screen.

If part of a page still needs to keep this kind of information:

- Prefer writing it as a neutral `review snapshot`, `in motion`, or `current state`
- Do not lay out `What Helm already prepared / moved` flat in the prime first-screen position
- System preparation, explanation, and completed actions should still land in disclosure / backstage layers by default

By default, do not let the page start from:

- A long list
- A search box
- Neutral stat cards
- Vague welcome copy

### 6.3 Approvals / Governance

These pages must be more formal and more structured, emphasizing:

- Risk level
- Evidence
- Approver
- Current posture
- The distinction between official / draft / blocked / manual path

Visual requirements:

- Status and hierarchy must be distinguishable at a glance
- CTAs must be unambiguous — never conflate "recommendation", "approval passed", and "official write-back"
- Audit and boundary cues must be visible without stealing focus from the primary action

### 6.4 Memory / Detail / Timeline

These pages by default emphasize:

- Layered separation of facts and inference
- promoted / draft / corrected / blocked posture
- Chain, timeline, lineage, handoff
- Why the current object matters

Visual requirements:

- Structure matters more than decoration
- Timelines, evidence blocks, source, and correction must be stable
- Never turn these into a chat message stream

### 6.5 Settings / Billing / Setup

These pages should by default be:

- Clean
- Scannable
- Clear about permissions and state boundaries
- Product-grade, not back-office-grade

Note:

- Billing is a product-grade summary, not a finance console
- Setup is onboarding, not an extended marketing page
- Settings must not degrade into a grey form back office just because it is "a configuration page"

### 6.6 Demo Surface

Demos may keep role differences, but must obey the same product skeleton:

- The same shell
- The same typography logic
- The same judgement-first hierarchy
- Lighter mode colors, not heavier theme cosplay

## 7. Fixed Component-Level Requirements

### 7.1 Page Header

A qualified page header must simultaneously answer at least:

- Which business judgement this page currently serves
- Why it should be looked at now
- What the most critical action is right now

A page header must not be reduced to just a title and subtitle.

### 7.2 Summary / Judgement Cards

Helm's core cards should by default contain these 4 layers:

1. judgement
2. why
3. action
4. boundary

A card without a boundary can easily turn a recommendation into a commitment.

### 7.3 Status Pill / Badge

Badges are only for:

- posture
- status
- risk
- source trust
- review state

Do not abuse badges as decorative motifs.

### 7.4 Tables and Lists

Tables should serve:

- Scanning
- Comparison
- Status recognition
- Batch handling

Requirements going forward:

- Clear table headers
- Clear row-level status
- Important columns toward the left
- Do not convert everything table-shaped into card streams just to look "more modern"

### 7.5 Forms and Action Bars

Default principles:

- One single, unambiguous primary action
- Secondary actions step back
- Dangerous actions require confirmation or explicit isolation
- Copy for approvals, official write-back, limited auto, and manual path must never be conflated

### 7.6 Charts and Visualization

Helm does not pursue flashy BI.

Charts are by default only for:

- Trends
- Risk
- Workload
- Pipeline posture
- Follow-through/readiness/readout

By default, do not:

- Use rainbow-colored charts
- Use decorative 3D charts
- Make charts the protagonist of the home page

## 8. Copy and Label Rules

Default requirements:

- Chinese interfaces prioritize natural, short, precise Chinese labels
- English interfaces prioritize concision without piling on AI buzzwords
- Page copy leads with judgement, action, and boundary — not vague brand voice
- The same class of action must use the same set of words over the long term

Especially avoid:

- Mixing up `suggested`, `approved`, `sent`, and `officially written`
- Writing recommendation copy that reads like an external commitment
- Using inflated wording to mask the fact that the system is still in a review posture

## 9. Explicit Prohibitions

Future UI work must by default not do these things:

1. Turn Helm into a dark-mode-first developer-tool style
2. Make purple, fluorescent colors, or saturated gradients the primary visual
3. Turn the home page into a chat app or a prompt-box-centered surface
4. Rely on glassmorphism, glowing outlines, or ultra-heavy shadows to manufacture a "premium feel"
5. Let each page invent its own local colors, radii, and card grammar
6. Sacrifice Chinese readability, table scannability, or status clarity for the sake of looking "premium"
7. Cover the decision-first hierarchy with decorative graphics
8. Make settings / approvals / billing a gloomy back office while the home page becomes an entirely different product
9. Make demo mode colors stronger than the product's primary information
10. Use visual novelty to mask current capability boundaries

## 10. Implementation Constraints

When actually implementing, obey by default:

1. Align with `DESIGN.md` first, then touch pages
2. Prefer reusing and converging the existing tokens in `app/globals.css` rather than building a parallel set
3. New color, spacing, shadow, radius, and typography tokens must be promoted to the shared layer first, then used in pages
4. The light theme is the current canonical truth; the dark theme is a compatibility layer, not the aesthetic center
5. Every page must first maintain the judgement / evidence / action / boundary hierarchy
6. If a reusable visual pattern is added, write it back into this document — do not leave it only in the page implementation

## 11. Default Rework Priority

If work proceeds in phases, the default order is:

1. Public home page, login, setup framing
2. dashboard / operating home
3. approvals / governance / official follow-through
4. detail / memory / timeline / handoff
5. settings / billing / participant / programs
6. demo polish and mode-specific refinement

The reasoning is simple:

- Unifying the entry point and the primary judgement surface first yields the most visible value
- Unifying the formal review layer next yields the most visible credibility
- Doing the secondary shells and mode polish last gives a better return

## 12. Definition of Design Done

A page rework counts as complete only when it at least satisfies:

1. The visual direction matches this `DESIGN.md`
2. The judgement-first / decision-first hierarchy became clearer, not blurrier
3. Boundaries such as recommendation, approval, official write-back, and manual path are expressed more clearly
4. Shared tokens and shared components are reused more, not less
5. Chinese readability, button contrast, and table scanning efficiency did not regress
6. Differences between demo and non-demo became more controlled, not more fragmented

If a page merely became locally prettier without making the judgement hierarchy, governance boundaries, or cross-page consistency clearer, it does not count as done in Helm's sense.

---

## 13. v2 Design Improvements Summary (2026-04)

### 13.1 Core Design Principle Update

**"Do not try to teach users"** became the top-priority design principle.

**Background**:
- User feedback: the system was too verbose; heavy educational content interfered with operation
- Core pages such as the Dashboard contained "instructional" copy, contradicting the service-system positioning

**Improvements**:
- ✅ Removed all system-architecture explanations and instructional copy
- ✅ Tucked technical rationale into secondary layers, shown on demand
- ✅ Shifted the user interface from "explaining the system" to "serving directly"
- ✅ Trimmed the Dashboard from 950+ lines to ~230 lines (75% code reduction)

### 13.2 Visual Accessibility Improvements

**Problems**:
- Insufficient contrast for selected states in dark mode (dark background + black text)
- User feedback: "my eyes get very tired"
- Contrast issues also existed in light mode

**Improvements**:
- ✅ All states forced to meet the WCAG AA standard (contrast ratio ≥ 4.5:1)
- ✅ Fixed the contrast of the sidebar selected state in dark mode
- ✅ Unified color legibility across light and dark modes
- ✅ Status indicators clearly legible in all modes

### 13.3 User Flow Simplification

**Login flow**:
- ✅ Simplified from a complex multi-step flow to: enter phone number → get verification code → sign in / register
- ✅ Removed all educational panels and explanatory text
- ✅ Direct action orientation, reducing the user's judgement cost

**New-user onboarding**:
- ✅ After scanning the QR code on the home page, users go straight to registration/login — no system introduction
- ✅ Signed-in users go directly into the work flow — no redundant welcome messages
- ✅ Error messages changed from technical explanations to user-friendly solutions

### 13.4 Copywriting Optimization Principles

**New principles in v2**:
1. **Precise expression**: every piece of copy must pass an accuracy check
2. **Appeal**: wording should spark the user's willingness to act
3. **Lower judgement cost**: users should know immediately what to do after reading the copy
4. **Remove redundancy**: decisively delete all superfluous expression and educational content

**Concrete improvements**:
- i18n copy changed from descriptive to action-oriented
- Error messages changed from technical language to user language
- All pages laid out neatly with concise expression

### 13.5 ROI Boundary

**Optimization stopping point**:
- Stop reworking when the cost of optimization begins to exceed the benefit
- Preserve core functional integrity; do not over-simplify
- Once the cost-benefit balance point is reached, shift to other priorities

**Achieved metrics**:
- Core user flows have been simplified
- Visual accessibility meets the standard
- Educational content has been largely removed
- User action paths are clear and unobstructed

### 13.6 Boundaries That Remain

**Still upheld**:
- judgement-first / decision-first information architecture
- The explicit recommendation != commitment boundary
- Enterprise-grade visual positioning (not a developer tool, not a chat app)
- Structure-over-decoration design principle
- High-information-density operating interfaces

## 14. Design-Language Unification Baseline: Boundary as Component (2026-07, adopted from the NPA Pack)

In practice, the industry Pack (the NPA collections workbench) upgraded this document's "boundaries must be visible" into a **machine-verifiable component system**. That practice has been ported back as Core's unified design-language baseline, to be applied progressively to all business surfaces.

### 14.1 Components Ported Back

- **`components/shared/boundary-bar.tsx` (page-level boundary declaration bar)**: a fixed three-segment structure — ① what you are seeing ② what the system will not do ③ who decides next — plus explicit negative-list pills (e.g. "no automatic outbound / no automatic write-back"). **Fail-closed**: if a segment is missing or a negative-list item is an empty string, it renders a red error state with an errorCode, and never silently degrades to default boilerplate.
- **`components/shared/effect-mode-badge.tsx` (effect-mode badge)**: every presented item can declare `suggestion_only / shadow_suggestion / human_action / receipt`, making "recommendation ≠ commitment ≠ receipt" visually unmistakable. Unknown modes render as an explicit danger state.

First applied surface: `/operating/tenant-health` (the self tenant-health page).

### 14.2 Unification Principles (from NPA Practice)

1. **Boundaries are components, not paragraphs**: boundary declarations are carried by shared components; copy structure is constrained by contract and can be asserted by tests and gates (`data-boundary-bar` / `data-boundary-negative-item` / `data-effect-mode`).
2. **Fail-closed honest presentation**: insufficient data is explicitly presented as "insufficient"; parse failures are "broken visibly for humans to see"; fabricated filler and silent defaults are prohibited.
3. **Status vocabulary convergence**: status literals take a word list as the source of truth; surfaces must not invent their own status words.
4. **No dead links**: when a jump target is not yet live, render a "target not live + reason code" placeholder — do not produce the link.
5. **No color-discipline regression**: raw Tailwind status colors at the Pack layer (e.g. `bg-red-50`) are always converted to `--status-*` tokens when ported back; tenant-custom hex values never enter Core.

### 14.3 Progressive Unification Roadmap

| Stage | Content |
|---|---|
| Landed | BoundaryBar + EffectModeBadge components and the first applied surface, tenant-health |
| Landed (second batch, 2026-07-06) | `/approvals` and `/operating` wired to BoundaryBar; draft-candidate cards on `/operating` wired to the `draft_only` badge (EFFECT_MODES extended) |
| Deferred | BoundaryBar wiring for `/capture`: that page's `SupportSurfaceNote` already carries the three-segment boundary "what it does / what it will never do / after the meeting" — two side-by-side copies would duplicate; wire it only after the relationship with the shared `SupportSurfaceNote` component is resolved (replace or differentiate, never juxtapose) |
| Later | Progressively add EffectModeBadge to recommendation-type lists; evaluate a Core version of the five-state readiness badge (live / refit / planned / contract_only / no_go) at the navigation layer; the status word-list mechanism |

New business surfaces should carry a BoundaryBar by default; lists that mix recommendations/actions/receipts should carry EffectModeBadge by default.
