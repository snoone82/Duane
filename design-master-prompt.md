# Master prompt for Claude Design — Aligned, Phase One

Paste this whole thing in as one prompt. Don't summarize or paraphrase it first — the specificity is the point.

---

You are designing five mobile screens for **Aligned**, a coaching product. A person answers a ten-area life audit on their phone, gets an Alignment Score out of 100, and a **human coach** (not an algorithm) personally reviews every completed audit. This is not a wellness app, not a quiz app, not a SaaS onboarding flow — it's closer to a considered, personal intake form that happens to be beautifully made.

**The single most important instruction in this brief:** do not default to a generic "AI app" look. Specifically avoid: warm cream background with a serif display face and a terracotta/orange accent; near-black backgrounds with a single acid-green or neon pop color; Inter or Space Grotesk as the "safe" font choice; emoji as section markers; everything centered; rounded-lg on every single element with no variation; a left accent bar/rail on cards; numbered 01/02/03 markers where the content isn't actually a sequence. If what you're about to design would look at home as a generic AI-startup landing page, stop and reconsider.

## Design system — already fixed, do not deviate

These are real, already-implemented tokens from a working Next.js codebase. Use them exactly:

```
Colours
--color-paper:          #FBF9F5   app background
--color-paper-raised:   #FFFFFF   cards, inputs
--color-paper-muted:    #F1EDE4   subtle section backgrounds
--color-ink:            #1B1812   primary text
--color-ink-soft:       #55503F   secondary text
--color-ink-faint:      #8A8471   placeholder / disabled text
--color-border:         #E4DFD1
--color-border-strong:  #C9C2AC
--color-gold:           #B08D3F   accent — SPARINGLY, see rule below
--color-gold-strong:    #93732F
--color-gold-soft:      #E9DDBB
--color-gold-ink:       #241D0C   text placed on top of gold
--color-status-low:     #B0755F   muted terracotta — never a bright/alarming red
--color-status-mid:     #B0954F   muted amber
--color-status-high:    #6E8F6E   muted sage — never a bright/gamified green

Type
Headings, numbers, uppercase labels: Sora
Body copy and form inputs: DM Sans — never set body copy in Sora
--text-score: 4.5rem — used in exactly ONE place: the Alignment Score number

Layout
--tap-target-min: 44px — every single interactive element, no exceptions
--radius-md: ~10px for buttons/inputs, --radius-lg: ~16px for cards
```

**Hard rules, not preferences:**
- Gold is the accent and is used *sparingly* — primary buttons, active/selected states, the score, the logo. It is never a body text colour, never a large background fill.
- Status/feedback colours stay muted. Never brighten them — a bright red next to someone's own rating of their emotional wellbeing reads as a verdict on them, which this product must never do.
- Every tap target is 44px minimum, no exceptions, phone-first (this is filled in on a phone, one-handed, often about painful things).
- Respect `prefers-reduced-motion` in any animation you design.
- No decorative icon-per-item pattern anywhere areas are listed (see screen 3 below — this is a hard content-modeling constraint, not a style choice).

## The five screens, with real copy — use this copy verbatim, don't invent new copy

### 1. Landing
Eyebrow: "The Audit" (gold, uppercase, small)
Headline: "Where does your life actually stand right now?"
Body: "Ten honest questions, about twenty minutes. A human coach reads every response — not an algorithm."
One button: "Start the Audit"
No email capture, no nav, no clutter. The entire strategy is getting someone to invest twenty minutes before asking for anything.

### 2. Audit question (one of ten — design for this one, pattern repeats)
Progress: "4 of 10" plus a visual indicator of position.
Area name: "Relationships & Connection"
Area description: "The closeness and quality of your relationships — partner, family, friends."
**Two distinct rating questions, and they must look like two different kinds of questions, not two instances of the same control:**
- "How is this area right now?" — a rating from 1 to 10
- "How much does this area matter to you?" — a rating from 1 to 5
These are NOT interchangeable visually. Different shape, different density, different weight — something that makes a fast-scrolling thumb immediately register "these are two different question types," not just "these are the same slider twice." A previous design pass got critiqued for making both use an identical solid-gold selected state despite different shapes — differentiate on more than shape alone (e.g. one quieter/tinted on selection, one bolder/solid).
An optional single-line note field, clearly marked optional.
Back and Continue controls, thumb-reachable at the bottom.

### 3. Leverage question
Eyebrow: "One more question"
Headline: "If one of these improved, which would help the others most?"
The ten areas as single-select rows (real area names below). One tap selects.

**Critical constraint on this screen:** do NOT give each area row an icon or a letter/initial badge derived from its name. The ten area names are entirely content-managed in a database — a real person can reword, reorder, or replace them at any time without a code change. Any icon or initial tied to a specific area name will eventually collide (two areas starting with the same letter) or go stale the moment content changes. If you want visual reinforcement per row, use something that carries zero information about the area's content — e.g. a plain selection indicator (radio dot, checkmark on select) — never anything derived from the text.

The ten real area names (use exactly these, in this order):
1. Health & Energy
2. Mindset & Thinking
3. Confidence & Self-Belief
4. Relationships & Connection
5. Career, Work & Business
6. Money & Stability
7. Purpose & Direction
8. Daily Structure & Discipline
9. Emotional Wellbeing
10. Self-Respect & Identity

### 4. Score reveal + account creation
This is the single highest-stakes screen in the product — the entire conversion moment. Someone just spent twenty minutes being honest about their life; this is where they're asked to trust you with an account.

Score reveal: the number, large (this is the one place a huge, confident numeral belongs), out of 100. Sample value: **57**.

**Design decision already made, respect it:** the score is shown inside a static, neutral ring/frame — NOT a ring that fills proportionally like a fitness or progress app. A "57% filled" ring implies "you're most of the way to a good outcome," which is an achievement metaphor this product explicitly must avoid — a life-audit score is diagnostic, never a grade. If you use a ring at all, its weight and colour must stay identical regardless of the score value.

Below the score: "You've just done the hard part." / "Create your account to keep these results — and so Duane can start looking at what you shared."
Fields: Name, Email, Password (password needs a show/hide toggle — near-baseline expectation now).
Button: "Create my account"

### 5. Dashboard
Exactly four things, in this order, nothing else:
1. The score again (same neutral-ring treatment), labelled "Your Alignment Score"
2. A radar/spider chart across all ten areas — muted gold fill, not a saturated/bright chart palette
3. The area breakdown list, **in the fixed order above, never sorted by score** — ranking someone's life worst-first on their own results page is the wrong tone entirely
4. A short "what happens next" note: "Duane personally reads every completed audit and will be in touch."

Do not show any computed "priority" score, gap analysis, or recommended focus area anywhere. That judgement belongs to the human coach after he's read the full audit — showing an algorithmic priority before he has undermines the entire premise of the product.

## Sample data to use throughout (don't invent different numbers)
Health & Energy 6, Mindset & Thinking 5, Confidence & Self-Belief 4, Relationships & Connection 8, Career/Work/Business 6, Money & Stability 5, Purpose & Direction 7, Daily Structure & Discipline 4, Emotional Wellbeing 5, Self-Respect & Identity 7 — total **57/100**. Keep it visibly uneven (a couple of low scores, a couple of high, mostly mid-range) — uniform numbers read as fake demo data.

## Logo
A small mark already exists conceptually: a circle with a horizontal line through its centre and a single filled dot sitting exactly on that centreline — a spirit-level "bubble," literal to the word "Aligned" (a level shows balance when its bubble sits dead-centre). Render this in gold, small (roughly 20px), paired with the wordmark "Aligned" in Sora. Present on every screen, quiet, top-left — it's chrome, not a hero element.

## What NOT to design
No coach dashboard, no goals feature, no progress-over-time comparison view, no settings screen. This is Phase One only: landing through to the dashboard above. Don't invent additional screens to round out a "complete-feeling" app — five screens is the whole scope.
