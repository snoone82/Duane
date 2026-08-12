# Aligned — Design Brief (Phase One: The Audit)

For a designer (human or AI) picking up visual design on top of an already-built, functioning front end. The tokens below are **already implemented in code** — this is a starting point to refine, not a blank page. Nothing here has had real design attention yet; it was built by an engineer (me) directly from a product brief, functionally correct but not visually considered.

---

## 1. Product context

Aligned is a coaching product. A person answers a ten-area life audit, gets an Alignment Score out of 100, and a **human coach** (Duane) personally reviews every completed audit — there is no self-serve AI coaching. This phase covers cold visitor → account created → results shown. Nothing else exists yet (no coach dashboard, no goals, no tracker) — don't design for those.

Two things should shape every visual decision:

1. **This is filled in on a phone, honestly, about painful things.** The tone should be calm and non-clinical — never a "test" or "assessment" that judges. A muted red next to "Emotional Wellbeing: 3" reads as a verdict on the person, so status/score colour must stay soft, never alarm-toned.
2. **History matters.** Every completed audit is a permanent, uneditable snapshot — comparing audit 1 to audit 5 is the whole point eventually. Nothing in the design needs to visualise that yet (out of scope this phase) but it's worth knowing why completed states feel final rather than editable.

## 2. Existing tokens (already coded — treat as the base palette)

```css
/* Colour: neutrals */
--color-paper:          #FBF9F5;  /* app background */
--color-paper-raised:   #FFFFFF;  /* cards, inputs */
--color-paper-muted:    #F1EDE4;  /* subtle section backgrounds */
--color-ink:            #1B1812;  /* primary text */
--color-ink-soft:       #55503F;  /* secondary text */
--color-ink-faint:      #8A8471;  /* placeholder / disabled text */
--color-border:         #E4DFD1;
--color-border-strong:  #C9C2AC;

/* Colour: gold accent — sparingly: primary buttons, active states, the score, the logo. Never body text. */
--color-gold:           #B08D3F;
--color-gold-strong:    #93732F;
--color-gold-soft:      #E9DDBB;
--color-gold-ink:       #241D0C;  /* text on top of gold */

/* Colour: status — deliberately muted, not verdicts */
--color-status-low:     #B0755F;  /* muted terracotta, not red */
--color-status-mid:     #B0954F;  /* muted amber */
--color-status-high:    #6E8F6E;  /* muted sage, not bright green */

/* Colour: feedback */
--color-info:    #5B7A8C;  --color-info-bg:    #E9F0F3;
--color-error:   #B0574F;  --color-error-bg:   #F5E7E4;
--color-success: #6E8F6E;  --color-success-bg: #E9F0E7;
--color-focus-ring: #2E5EAA;

/* Type */
--font-heading: 'Sora';   /* headings, numbers, uppercase labels — never body copy */
--font-body:    'DM Sans'; /* body copy and inputs */

--text-xs: 0.75rem;  --text-sm: 0.875rem;  --text-base: 1rem;  --text-lg: 1.125rem;
--text-xl: 1.375rem; --text-2xl: 1.75rem;  --text-3xl: 2.25rem;
--text-score: 4.5rem;  /* the ONE place this is used: the Alignment Score number */

--leading-tight: 1.15; --leading-snug: 1.35; --leading-normal: 1.6;
--tracking-wide: 0.04em;  /* uppercase labels */

/* Spacing (4px base) */
--space-1: 0.25rem  … --space-24: 6rem  (1,2,3,4,5,6,8,10,12,16,20,24 — all ×0.25rem)

/* Radius */
--radius-sm: 0.375rem; --radius-md: 0.625rem; --radius-lg: 1rem; --radius-xl: 1.5rem; --radius-full: 999px;

/* Shadow — very light, calm not flashy */
--shadow-sm: 0 1px 2px rgba(27,24,18,.06);
--shadow-md: 0 4px 16px rgba(27,24,18,.08);
--shadow-lg: 0 12px 32px rgba(27,24,18,.10);

/* Layout */
--tap-target-min: 2.75rem;  /* 44px — every interactive element must meet this */
--content-max-width: 40rem;
```

**Hard rules from the product brief — please keep these, or flag explicitly if you think they should change:**
- Never hardcode a colour/radius/size — everything routes through tokens.
- Gold is not a text colour.
- Status colours stay muted — don't brighten them.
- Visible `:focus-visible` outline on every interactive element (keyboard-only users go through the whole audit).
- Respect `prefers-reduced-motion` — no animation that bypasses it.
- Mobile-first. No tap target under 44px, no horizontal scroll, ever.

This is a **starting palette I invented from the brief's rules**, not something Duane approved. Treat colours/type scale/spacing as adjustable — the *rules* above (sparing gold, muted status, Sora/DM Sans split, tap targets, focus visibility) are the actual constraints from the product owner.

## 3. Screens (all built, all functional, none visually refined)

### 3.1 `/` — Landing
One short pitch, one primary button. No email capture, no nav, no clutter — the entire strategy is getting them to invest 20 minutes before asking for anything.
- Eyebrow: "Aligned" (gold, uppercase label style)
- H1: "The Audit"
- One paragraph explaining what it is + how long it takes
- One line: no account needed to start
- Primary button: **Start the Audit** (or **Continue the Audit** if resuming)

### 3.2 `/audit` — One life area per screen (×10)
The core of the product. Needs the most design attention.
- Progress: "N of 10" + a bar
- Area name (H1) + one-sentence description
- **Question 1**, plain phrasing: "How is this area right now?" → a 1–10 rating
- **Question 2**, plain phrasing: "How much does this area matter to you?" → a 1–5 rating
- These two questions must read as **visibly different question types** — currently built as a dense 1–10 number grid vs. a wider 1–5 pill row, separated by a rule. This distinction is a hard product requirement (two identical-looking 10-point rows get mis-answered) — the *shapes* can change but the visual differentiation must stay.
- Optional single-line note (clearly marked optional)
- Back / Continue at the bottom, thumb-reachable on mobile
- Autosave happens silently — there's a subtle error state if a save fails, but no "saving..." spinner needed for every keystroke

### 3.3 `/audit/leverage` — One question
"If one of these improved, which would help the others most?" — the ten areas as single-select tappable rows/cards. One tap, then Continue.

### 3.4 `/audit/complete` — Score reveal → account creation
Two things stacked on one screen:
1. **Score reveal**: big number (this is the one screen that uses `--text-score`), "out of 100", something that feels like a small payoff/moment — currently a simple fade-in, respecting reduced motion.
2. Below it: "Your Aligned profile is ready. Create your account to save your results and see what happens next." → Name / Email / Password fields → Create account button.

This is the highest-value moment to get right visually — it's the entire conversion point of the product.

### 3.5 `/dashboard` — Results
Exactly four things, in this order, nothing else:
1. Life Alignment Score, large, `--text-score`, Sora
2. Radar/spider chart across all ten areas (currently a hand-built SVG — open to a nicer visual treatment)
3. Area breakdown list, each area + its satisfaction score, in a fixed order (**not** ranked by score — ranking someone's life worst-first is explicitly the wrong tone)
4. "What happens next" — plain copy explaining Duane personally reviews every audit

**Explicitly not shown**: any computed "priority" or "focus area" — that judgement belongs to the coach, not the algorithm, and showing it undermines the product's premise.

### 3.6 `/login` (minor, not in original scope but required)
Plain email/password sign-in — small utility screen, low design priority.

## 4. Component inventory (already built, functionally)

| Component | Notes |
|---|---|
| Button (primary / secondary / ghost) | primary = gold fill |
| Two rating-scale variants | 1–10 grid, 1–5 pill row — need to look *obviously* different from each other |
| Progress bar | thin, gold fill |
| Text field / textarea | single border style, gold focus |
| Notice (info / error / success) | muted background + text, not loud |
| Radar chart | custom SVG, 10 axes |
| Score display | the one `--text-score` moment, used twice (complete + dashboard) |

## 5. What NOT to design

Per explicit product scope: no coach dashboard, no CLEAR, no goals, no tracker, no comparison/history views. Nothing for those should be designed or even stubbed this phase.

---

**Suggested prompt to hand to Claude for design:** *"Here's an existing token set and full screen spec for a coaching app's onboarding flow (landing → 10-question audit → leverage question → score reveal/signup → results dashboard). The tokens and rules are fixed constraints from the product owner; give this a considered visual design — refine type scale, spacing, the score-reveal moment, and the radar chart in particular."*
