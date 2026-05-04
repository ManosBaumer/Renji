import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

type KeywordType = 'audience' | 'problem' | 'solution' | 'industry' | 'keyword';

const PROMPTS: Array<{ type: KeywordType; prompt: string }> = [
  // Audiences
  { type: 'audience', prompt: 'List 50 specific target audiences for SaaS and digital products. Include job titles, user types, and professional roles. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'audience', prompt: 'List 50 B2B buyer personas and business roles that purchase software tools. Focus on decision makers, end users, and niche professionals. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'audience', prompt: 'List 50 consumer and personal user segments for apps and digital tools. Include hobbies, life stages, and lifestyle identities. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'audience', prompt: 'List 50 technical audiences: developer types, DevOps/SRE roles, data scientists, ML engineers. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'audience', prompt: 'List 50 niche professional audiences: healthcare workers, legal professionals, educators, architects, creatives. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'audience', prompt: 'List 50 small business owner types and solopreneur categories that use digital tools. Return JSON: {"keywords": ["string", ...]}' },

  // Problems
  { type: 'problem', prompt: 'List 50 pain points that startup founders and entrepreneurs face. Focus on business-critical problems people pay to solve. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 developer and software engineering problems: debugging, deployment, scaling, testing, documentation issues. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 marketing and growth challenges for small businesses: lead gen, SEO, content, conversion, retention. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 sales and CRM pain points for teams and solopreneurs: prospecting, pipeline, follow-up, forecasting. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 remote work and team collaboration problems: communication gaps, project coordination, async workflows. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 finance, invoicing, and accounting pain points for freelancers and small businesses. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 HR, recruiting, and people management pain points for growing companies. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 data management, analytics, and reporting problems businesses face daily. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 customer support and service delivery pain points for online businesses. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 security, compliance, and privacy challenges faced by online businesses and developers. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 e-commerce and online retail pain points: inventory, fulfillment, abandoned carts, returns. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'problem', prompt: 'List 50 content creation and publishing problems for creators, bloggers, and social media managers. Return JSON: {"keywords": ["string", ...]}' },

  // Solutions
  { type: 'solution', prompt: 'List 50 categories of SaaS product types. Include the category name, not brand names. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'solution', prompt: 'List 50 AI-powered product categories and machine learning application types for businesses. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'solution', prompt: 'List 50 business automation tool types: workflow automation, RPA, scheduled tasks, integrations. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'solution', prompt: 'List 50 developer tool categories: IDEs, CI/CD, monitoring, testing, API tools, infrastructure. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'solution', prompt: 'List 50 mobile and web app categories for consumers and prosumers. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'solution', prompt: 'List 50 no-code and low-code tool categories that empower non-developers. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'solution', prompt: 'List 50 data and analytics platform categories: BI tools, dashboards, data pipelines, visualization. Return JSON: {"keywords": ["string", ...]}' },

  // Industries
  { type: 'industry', prompt: 'List 50 technology and software industry verticals and sub-sectors. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'industry', prompt: 'List 50 non-tech industries undergoing digital transformation: healthcare, legal, education, finance, real estate. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'industry', prompt: 'List 50 niche and emerging industry categories ripe for startup disruption. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'industry', prompt: 'List 50 consumer and lifestyle market categories: fitness, food, travel, entertainment, home. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'industry', prompt: 'List 50 B2B and enterprise industry verticals with large software budgets. Return JSON: {"keywords": ["string", ...]}' },

  // General keywords
  { type: 'keyword', prompt: 'List 50 startup business model types and revenue model keywords. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 product and UX terminology: design patterns, feature types, user experience concepts. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 growth hacking and go-to-market strategy terms for startups. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 venture capital and startup ecosystem terms: funding stages, metrics, investor types. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 creator economy, content monetization, and community platform categories. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 API economy and integration platform terms: webhooks, marketplace, ecosystem concepts. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 AI and machine learning application buzzwords and product categories for 2024-2025. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 cybersecurity product and service categories for the enterprise and SMB market. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 platform and marketplace business concepts: two-sided markets, network effects, aggregator models. Return JSON: {"keywords": ["string", ...]}' },
  { type: 'keyword', prompt: 'List 50 product-led growth and community-led growth strategy terms and concepts. Return JSON: {"keywords": ["string", ...]}' },
];

async function generateKeywords() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let totalInserted = 0;
  let totalSkipped = 0;

  for (let i = 0; i < PROMPTS.length; i++) {
    const { type, prompt } = PROMPTS[i];
    console.log(`[${i + 1}/${PROMPTS.length}] Generating ${type} keywords...`);

    try {
      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const raw = response.choices[0].message.content ?? '{}';
      const parsed = JSON.parse(raw) as { keywords?: unknown };
      const keywords = Array.isArray(parsed.keywords) ? (parsed.keywords as unknown[]) : [];

      const rows = keywords
        .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
        .map((k) => ({ name: k.trim().toLowerCase(), type }));

      if (rows.length === 0) {
        console.warn(`  No valid keywords in response`);
        continue;
      }

      const { data, error } = await supabase
        .from('keywords')
        .upsert(rows, { onConflict: 'name,type', ignoreDuplicates: true })
        .select('id');

      if (error) {
        console.error(`  DB error:`, error.message);
        continue;
      }

      const inserted = data?.length ?? 0;
      const skipped = rows.length - inserted;
      totalInserted += inserted;
      totalSkipped += skipped;
      console.log(`  Inserted ${inserted}, skipped ${skipped} duplicates`);
    } catch (err) {
      console.error(`  Error on prompt ${i + 1}:`, err);
    }

    // Respect Groq free tier: ~30 req/min → 2s between requests
    if (i < PROMPTS.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\nDone! Total inserted: ${totalInserted}, skipped: ${totalSkipped}`);
}

generateKeywords().catch(console.error);
