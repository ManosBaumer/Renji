# 🧠 Renji.pro – Startup Idea Validator (Full Project Plan)

## 🎯 Goal

**Product Name:** Renji.pro

Build a **fully free (MVP) AI-powered SaaS** that validates startup ideas using:

- structured keyword taxonomy
- real-world data aggregation
- lightweight AI (Groq or Gemini)

---

# 🏗️ TECH STACK (FREE)

## Frontend

- Next.js (deployed on Vercel)

## Backend

- Next.js API routes

## Database

- Supabase (Postgres + pgvector)

## AI

- Primary: Groq (LLaMA models)
- Alternative: Gemini (free tier)

## Data Sources

- Reddit API
- Optional scraping (later)

---

# 🧱 SYSTEM ARCHITECTURE

## Core Flow

1. User inputs idea
2. AI classifies idea → structured format
3. System retrieves relevant keywords via embeddings
4. Data aggregation runs (Reddit, etc.)
5. Scores are calculated
6. AI summarizes insights
7. Results displayed

---

# 1️⃣ KEYWORD DATABASE PIPELINE

## Objective

Create a **scalable, semi-automated keyword system**

---

## Step 1: Bulk Keyword Generation (Automated)

Script: `generate_keywords.ts`

Use AI (Groq/Gemini) to generate:

- audiences
- problems
- solutions
- industries

Run multiple prompts like:

- "Generate SaaS problems people pay to solve"
- "List startup ideas in fintech"

Target: 5000–10000 raw keywords

---

## Step 2: Store with Embeddings

Table: `keywords`

Fields:

- id
- name
- type (audience/problem/etc)
- embedding
- canonical\_id (nullable)

---

## Step 3: Clustering

Script: `cluster_keywords.ts`

- compare embeddings
- group similar keywords (>0.85 similarity)

---

## Step 4: Canonicalization

Each cluster:

- 1 canonical keyword
- others → aliases

Table: `aliases`

---

## Outcome

- clean taxonomy
- scalable structure
- minimal manual work

---

# 2️⃣ AI CLASSIFICATION SYSTEM

## Endpoint: `/api/classify`

### Input

```
{ "idea": "AI tool for students to focus" }
```

---

## Retrieval Step (IMPORTANT)

- embed user input
- fetch top 20 closest keywords from DB

---

## AI Prompt

```
Extract:
- audience
- problem
- solution
- industry
- keywords

Only choose from provided keyword list where possible.
Return JSON.
```

---

## Output

```
{
  "audience": "students",
  "problem": "focus/productivity",
  "keywords": ["study productivity", "focus tools"]
}
```

---

# 3️⃣ CONFIDENCE + FLAGGING SYSTEM

## Logic

Combine:

- embedding similarity
- AI certainty

---

## Thresholds

- High (>0.8) → auto assign
- Medium (0.5–0.8) → assign + flag
- Low (<0.5) → suggest new keyword

---

## Table: `keyword_suggestions`

Fields:

- id
- suggested\_keyword
- closest\_match
- similarity
- status (pending/approved/rejected)

---

## Admin Actions

- merge into existing keyword
- create new keyword
- add as alias

---

# 4️⃣ DATA AGGREGATION ENGINE (CORE FEATURE)

## Endpoint: `/api/analyze`

---

## Step 1: Reddit Data

Fetch:

- posts per keyword
- upvotes
- comments

Metrics:

- frequency
- engagement

---

## Step 2: Trend Detection

- track post counts over time
- detect growth rate

---

## Step 3: Competition Detection

Basic MVP:

- detect mentions of tools/apps/platforms

Later:

- scrape Product Hunt

---

## Step 4: Scoring System

### Demand Score

\= post frequency + engagement

### Competition Score

\= number of existing tools

### Opportunity Score

\= demand - competition

---

## Step 5: AI Insight Summary

Prompt:

```
Analyze:
- demand
- competition
- opportunity

Provide actionable insights and suggestions.
```

---

# 5️⃣ FRONTEND INTERFACE

## Pages

---

## 1. Homepage

- Input field: "Describe your startup idea"
- CTA: Analyze

---

## 2. Results Page

### Sections

#### 🧠 AI Analysis

- viability score
- opportunity rating

#### 📊 Metrics

- demand
- competition
- trend

#### 💬 Insights

- extracted pain points

#### 🎯 Suggestions

- niche ideas
- improvements

---

## Editable Classification UI

Show detected:

- audience
- problem
- keywords

User can edit → re-run analysis

---

## 3. Advanced Search (IMPORTANT FEATURE)

### Purpose

Give power users full control over classification input

---

### UI Structure

Instead of a single input, provide structured fields:

- Audience (dropdown + free input)
- Problem (dropdown + free input)
- Solution Type
- Industry
- Keywords (multi-select + suggestions)

---

### Smart Behavior

- When user fills fields → skip AI classification step
- directly run aggregation

---

### Hybrid Mode (Best UX)

Flow:

1. User enters idea
2. AI auto-fills advanced fields
3. User can tweak values

---

### Benefits

- improves accuracy
- builds trust
- reduces AI dependency
- enables power users

---

### Extra Feature (Optional)

Show confidence per field:

- Audience: 92%
- Problem: 75%

Highlight low-confidence fields for user correction

---

# 6️⃣ PERFORMANCE + COST OPTIMIZATION

## Keep costs near zero

- Use Groq or Gemini free tier
- Cache results (critical)
- reuse embeddings

---

## Caching Strategy

- hash user input
- store results
- reuse if repeated

---

# 7️⃣ MVP TIMELINE

## Week 1

- keyword generation
- embeddings
- DB setup

## Week 2

- classification API
- Reddit aggregation

## Week 3

- frontend UI
- scoring system

---

# 🚀 FUTURE UPGRADES

- better AI models
- more data sources
- alerts system
- user accounts
- saved dashboards

---

# ⚠️ FINAL NOTE

Success depends on:

- quality of insights
- clarity of output

NOT:

- size of keyword DB
- complexity of AI

---

# ✅ END GOAL

A system that:

- understands startup ideas
- validates them with real data
- improves over time

---

