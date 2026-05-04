# Renji.pro — Claude Model Selection per Phase

This file recommends which **Claude model to use during development** of each phase in [development-plan.md](development-plan.md).

> **Note:** This is about the model that helps you *write the code*. The runtime LLM that Renji itself calls (for classification, summarisation, keyword generation) is **Groq or Gemini**, per [plan.md](plan.md). That choice is independent of what's recommended here.

---

## Tier logic

| Tier | When to use it |
|---|---|
| **Haiku 4.5** (`claude-haiku-4-5-20251001`) | Mechanical, well-specified work where speed and cost dominate: scaffolding, glue code, deploy config, copy edits. |
| **Sonnet 4.6** (`claude-sonnet-4-6`) | The workhorse. Most feature work — API routes, schema design, UI components, integration code. |
| **Opus 4.7** (`claude-opus-4-7`) | Reserved for parts where reasoning quality changes the product outcome: prompt design, scoring formulas, classification taxonomy, ambiguous architectural tradeoffs. |

---

## Per-phase recommendations

| Phase | Recommended model | Why |
|---|---|---|
| **0 — Setup & Foundation** | Haiku 4.5 | Boilerplate scaffolding, env wiring, no judgement calls. |
| **1 — Keyword Pipeline** | Sonnet 4.6 *(but Opus 4.7 for the keyword-generation prompts)* | Schema + scripts are routine; the generation prompts bottleneck the entire taxonomy quality, so spend Opus on those specifically. |
| **2 — AI Classification** | **Opus 4.7** | Prompt design + JSON-schema constraints + retrieval blending — this is the core intelligence of the product. Worth the extra reasoning. |
| **3 — Confidence & Flagging** | Sonnet 4.6 | Threshold/scoring logic with some heuristic design — Sonnet handles this well. |
| **4 — Data Aggregation Engine** | **Opus 4.7** for the scoring formula and insight prompt; Sonnet 4.6 for the Reddit plumbing | Score weights and the insight prompt drive perceived product quality; the fetcher is mechanical. |
| **5 — Frontend** | Sonnet 4.6 | UI work, accessibility, state management — Sonnet's sweet spot. |
| **6 — Performance & Caching** | Haiku 4.5 | Mostly mechanical: hash → cache → lookup → expire. |
| **7 — Polish & Deploy** | Haiku 4.5 | Config, copy edits, deploy commands. |

---

## How to switch models in Claude Code

- Run `/model` and pick the tier you want.
- Or set `"model"` in `~/.claude/settings.json` (global) or `.claude/settings.json` (per-project).

You can switch mid-phase — e.g. start a frontend task on Sonnet, drop to Haiku once the component pattern is locked in and you're just duplicating it across pages.

---

## Rule of thumb: when to upgrade

If Haiku or Sonnet produces output you have to re-prompt **twice** to get right, the cost saving is gone — switch up a tier. Conversely, if Opus is doing work that feels like fill-in-the-blanks (renaming, repeating an established pattern), drop down.

Concretely for Renji:

- **Don't cheap out on prompts.** The keyword generator (Phase 1), the classifier (Phase 2), and the insight summary (Phase 4) define how the whole product feels. Use Opus to design and iterate those, even if the surrounding code is Sonnet/Haiku.
- **Don't over-spend on plumbing.** Reddit fetching, Supabase queries, cache lookups, Tailwind layouts — Sonnet or Haiku gets there fine.
