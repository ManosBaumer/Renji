# Renji.pro — Development Plan

This is the execution plan derived from [plan.md](plan.md). The brief is a feature spec; this file is the build order. Eight phases, each unblocking the next.

For Claude model recommendations per phase, see [model.md](model.md).

---

## Phase 0 — Project Setup & Foundation

**Goal:** Working Next.js app + Supabase project + environment wired up.

**Deliverables**
- `npx create-next-app@latest` with TypeScript + App Router + Tailwind
- Supabase project created; `pgvector` extension enabled
- `.env.local` with:
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
  - `GROQ_API_KEY` (and/or `GEMINI_API_KEY`)
  - `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
- `lib/supabase.ts` — typed Supabase client
- `lib/llm.ts` — single `complete(prompt)` and `embed(text)` interface so providers are swappable later
- `git init` + `.gitignore`

**Exit criteria:** `npm run dev` renders a placeholder homepage; a smoke-test API route can read/write Supabase.

---

## Phase 1 — Keyword Database Pipeline

**Goal:** A clean, embedded, canonicalised keyword taxonomy in Postgres.

**Deliverables**
- SQL migrations:
  - `keywords (id, name, type, embedding vector(768), canonical_id)`
  - `aliases (id, keyword_id, alias)`
  - `keyword_suggestions (id, suggested_keyword, closest_match, similarity, status)`
- `scripts/generate_keywords.ts` — batched LLM prompts, target 5–10k raw keywords across audiences / problems / solutions / industries
- `scripts/embed_keywords.ts` — embed each keyword and upsert
- `scripts/cluster_keywords.ts` — pairwise cosine similarity > 0.85 → cluster
- `scripts/canonicalize.ts` — pick canonical per cluster, demote others to aliases

**Exit criteria:** A nearest-neighbour query like
`SELECT name FROM keywords WHERE type='problem' ORDER BY embedding <=> $1 LIMIT 20`
returns sensible results.

---

## Phase 2 — AI Classification System

**Goal:** `/api/classify` extracts structured fields from a free-text idea, constrained to known keywords.

**Deliverables**
- `app/api/classify/route.ts`
- Flow: embed input → top-20 nearest keywords → structured-extraction prompt → JSON `{ audience, problem, solution, industry, keywords[] }`
- Zod schema validation on the LLM response, with one retry on parse failure

**Exit criteria:** Curling the endpoint with 5 sample ideas returns valid JSON for all 5.

---

## Phase 3 — Confidence + Flagging

**Goal:** Surface low-confidence classifications and capture novel keywords.

**Deliverables**
- Confidence score = blend of embedding similarity + LLM self-rating
- Threshold logic:
  - `> 0.8` → auto-assign
  - `0.5–0.8` → assign + flag
  - `< 0.5` → write to `keyword_suggestions`
- Minimal admin route `/admin/suggestions` (auth-gated) with merge / new / alias actions

**Exit criteria:** A deliberately weird input (e.g. "AI for medieval falconers") creates a `keyword_suggestions` row pointing at the closest existing match.

---

## Phase 4 — Data Aggregation Engine

**Goal:** `/api/analyze` returns demand / competition / opportunity scores plus an LLM insight summary.

**Deliverables**
- `lib/reddit.ts` — search posts per keyword, return frequency + engagement
- Trend detection — bucket post timestamps into weekly windows, compute growth rate
- Competition heuristic — extract tool/app/platform mentions in post text
- Scoring (normalised 0–100):
  - `demand` = post frequency + engagement
  - `competition` = mention count of existing tools
  - `opportunity` = demand − competition
- Summarisation prompt → actionable insights string
- `app/api/analyze/route.ts` orchestrates classify → fetch → score → summarise

**Exit criteria:** Submitting "AI tool for students to focus" returns scores plus an insight paragraph in under 30 seconds.

---

## Phase 5 — Frontend

**Goal:** Usable UI covering homepage, results, and advanced search.

**Deliverables**
- **Homepage** — single textarea + Analyze CTA
- **Results page** — viability score, demand / competition / trend metrics, insights, suggestions
- **Editable classification** — show detected fields, inline edit, re-run analysis
- **Advanced Search** — structured fields (audience / problem / solution / industry / keywords) with hybrid mode (AI auto-fills, user tweaks)
- **Per-field confidence indicators** — highlight low-confidence fields for user correction
- Loading and empty states for both flows

**Exit criteria:** Manual click-through covers homepage → results → edit → re-run, plus the advanced-search direct-aggregation path.

---

## Phase 6 — Performance & Cost Optimization

**Goal:** Stay inside free tiers; fast repeated queries.

**Deliverables**
- `analysis_cache` table keyed by `sha256(normalized_input)`
- Reuse stored embeddings; never re-embed identical strings
- Cache Reddit fetches per keyword for 24h
- Per-IP rate limit on `/api/analyze`

**Exit criteria:** Same input twice → second response served from cache in under 500ms.

---

## Phase 7 — Polish & Deploy

**Goal:** Public MVP on Vercel.

**Deliverables**
- Error boundaries + user-friendly failure messages
- Analytics (Vercel Analytics or Plausible free tier)
- SEO metadata, OG image using `typeface-logo.png`
- Vercel deploy with env vars; Supabase prod project
- README with setup/run instructions

**Exit criteria:** Production URL works end-to-end for a non-author tester.

---

## Future Upgrades (post-MVP, from `plan.md`)

- Better AI models
- More data sources (Product Hunt, Hacker News, Twitter)
- Alerts system
- User accounts
- Saved dashboards
