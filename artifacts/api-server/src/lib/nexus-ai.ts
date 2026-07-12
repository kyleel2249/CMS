/**
 * NEXUS AI Engine — Full Intelligence Layer
 *
 * Capabilities:
 *  • Web search via Perplexity online model (internet-connected reasoning)
 *  • 18 parallel domain expert sub-agents (sales, marketing, finance,
 *    architecture, ML, DevOps, security, UX, product, BI, QA, mobile, …)
 *  • Persistent memory: learns from conversations and activities over time
 *  • Image generation: Pollinations.ai (free, no extra API key)
 *  • Document / file generation: Markdown, HTML reports, CSV, JSON
 *  • Video script generation
 */

import OpenAI from "openai";
import { logger } from "./logger";
import {
  db, aiMemoryTable, aiGeneratedFilesTable, aiConversationsTable,
  dealsTable, contactsTable, leadsTable, ticketsTable, invoicesTable,
  projectsTable, campaignsTable, goalsTable, keyResultsTable,
  automationsTable, knowledgeArticlesTable, activityTable,
} from "@workspace/db";
import { desc, eq, like, or, and, gte } from "drizzle-orm";
import { count, sum } from "drizzle-orm";

// ── OpenRouter client ─────────────────────────────────────────────────────────

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://cintexa-nexus.replit.app",
      "X-Title": "Cintexa NEXUS AI",
    },
  });
}

export function aiEnabled() {
  return Boolean(process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY);
}

// Models
const MODEL_PRIMARY   = "google/gemini-2.5-flash";          // fast, capable, cheap
const MODEL_WEB       = "perplexity/llama-3.1-sonar-large-128k-online"; // internet-connected
const MODEL_REASONING = "google/gemini-2.5-flash";          // deep reasoning

// ── Helpers ───────────────────────────────────────────────────────────────────

async function llm(system: string, user: string, opts: {
  model?: string; maxTokens?: number; json?: boolean;
} = {}): Promise<string | null> {
  const client = getClient();
  if (!client) return null;
  try {
    const resp = await client.chat.completions.create({
      model: opts.model ?? MODEL_PRIMARY,
      max_tokens: opts.maxTokens ?? 1024,
      messages: [
        { role: "system", content: system + (opts.json ? " Respond with valid JSON only." : "") },
        { role: "user",   content: user },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    });
    return resp.choices[0]?.message?.content ?? null;
  } catch (err) {
    logger.error({ err }, "llm call failed");
    return null;
  }
}

async function llmJson<T>(system: string, user: string, maxTokens = 2048): Promise<T | null> {
  const raw = await llm(system, user, { json: true, maxTokens });
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ── Live business snapshot (injected into every expert) ───────────────────────

async function getBusinessSnapshot() {
  const [
    [{ contacts }], [{ deals: dealCount }], [{ leads }], [{ tickets }],
    [{ invoiced }], [{ paid }], [{ projects }],
    allDeals, recentActivity,
  ] = await Promise.all([
    db.select({ contacts: count() }).from(contactsTable),
    db.select({ deals: count() }).from(dealsTable),
    db.select({ leads: count() }).from(leadsTable),
    db.select({ tickets: count() }).from(ticketsTable).where(eq(ticketsTable.status, "open")),
    db.select({ invoiced: sum(invoicesTable.amount) }).from(invoicesTable),
    db.select({ paid: sum(invoicesTable.amount) }).from(invoicesTable).where(eq(invoicesTable.status, "paid")),
    db.select({ projects: count() }).from(projectsTable).where(eq(projectsTable.status, "active")),
    db.select().from(dealsTable).limit(20),
    db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(10),
  ]);

  const openDeals = allDeals.filter(d => !["closed_won","closed_lost"].includes(d.stage));
  const pipelineValue = openDeals.reduce((s, d) => s + Number(d.value), 0);
  const closedWon = allDeals.filter(d => d.stage === "closed_won").reduce((s, d) => s + Number(d.value), 0);

  return {
    contacts, openDeals: openDeals.length, totalDeals: dealCount, leads,
    openTickets: tickets, pipelineValue, closedWonRevenue: closedWon,
    totalInvoiced: Number(invoiced ?? 0), totalPaid: Number(paid ?? 0),
    activeProjects: projects,
    topDeals: openDeals.slice(0, 5).map(d => ({ title: d.title, stage: d.stage, value: Number(d.value), probability: d.probability })),
    recentActivity: recentActivity.map(a => ({ type: a.type, title: a.title })),
  };
}

// ── Memory system ─────────────────────────────────────────────────────────────

export async function saveMemory(params: {
  key: string; value: string;
  memoryType?: "fact" | "preference" | "pattern" | "insight" | "learning";
  source?: string; tags?: string[]; sessionId?: string;
}) {
  const existing = await db.select().from(aiMemoryTable).where(eq(aiMemoryTable.key, params.key)).limit(1);
  if (existing.length > 0) {
    await db.update(aiMemoryTable).set({
      value: params.value, updatedAt: new Date(),
      confidence: Math.min(100, (existing[0].confidence ?? 80) + 5),
    }).where(eq(aiMemoryTable.id, existing[0].id));
    return existing[0];
  }
  const [row] = await db.insert(aiMemoryTable).values({
    key: params.key, value: params.value,
    memoryType: params.memoryType ?? "fact",
    source: params.source ?? "observed",
    tags: params.tags ?? [],
    sessionId: params.sessionId,
  }).returning();
  return row;
}

export async function getMemories(limit = 30) {
  return db.select().from(aiMemoryTable).orderBy(desc(aiMemoryTable.updatedAt)).limit(limit);
}

export async function deleteMemory(id: number) {
  await db.delete(aiMemoryTable).where(eq(aiMemoryTable.id, id));
}

export async function searchMemories(query: string) {
  return db.select().from(aiMemoryTable).where(
    or(like(aiMemoryTable.key, `%${query}%`), like(aiMemoryTable.value, `%${query}%`))
  ).limit(10);
}

// ── Save conversation to DB ───────────────────────────────────────────────────

async function saveConversation(sessionId: string, role: string, content: string, expertName?: string, metadata?: Record<string,unknown>) {
  await db.insert(aiConversationsTable).values({
    sessionId, role, content, expertName, metadata: metadata ?? {},
  });
}

// ── 18 Expert Agent Definitions ───────────────────────────────────────────────

export const EXPERTS = [
  {
    id: "sales",
    name: "Sales Expert",
    icon: "💼",
    color: "#22c55e",
    specialty: "Pipeline management, deal strategy, forecasting, quota attainment, win rates, negotiation",
    prompt: "You are a world-class Sales Expert and Revenue Leader with 20+ years of B2B enterprise sales experience. You specialize in pipeline management, deal strategy, forecasting, quota attainment, and sales methodology (MEDDIC, Challenger, SPIN). You have deep knowledge of CRM best practices and revenue operations.",
  },
  {
    id: "marketing",
    name: "Marketing Expert",
    icon: "📣",
    color: "#f59e0b",
    specialty: "Campaigns, content strategy, SEO, demand generation, brand positioning, ABM",
    prompt: "You are a world-class Marketing Expert and CMO-level strategist with expertise in demand generation, content marketing, ABM (Account-Based Marketing), SEO, paid media, brand positioning, and campaign optimization. You understand modern B2B marketing funnels and growth frameworks.",
  },
  {
    id: "finance",
    name: "Finance Expert",
    icon: "💰",
    color: "#8b5cf6",
    specialty: "P&L analysis, revenue forecasting, cash flow, SaaS metrics (ARR/MRR/churn), unit economics",
    prompt: "You are a world-class Finance Expert and CFO-level advisor specializing in SaaS financial modeling, revenue forecasting, P&L analysis, cash flow management, unit economics (LTV/CAC), and ARR/MRR growth. You understand GAAP accounting, financial reporting, and investor-grade metrics.",
  },
  {
    id: "projects",
    name: "Projects Expert",
    icon: "📋",
    color: "#06b6d4",
    specialty: "Project delivery, resource allocation, risk management, agile/scrum, OKRs",
    prompt: "You are a world-class Project Management Expert and Program Director specializing in agile methodologies, risk management, resource allocation, stakeholder communication, and delivery excellence. You are certified in PMP, SAFe, and Scrum and have delivered hundreds of complex enterprise programs.",
  },
  {
    id: "software-architect",
    name: "Software Architect",
    icon: "🏗️",
    color: "#ec4899",
    specialty: "System design, microservices, distributed systems, scalability, technical debt, architecture patterns",
    prompt: "You are a Principal Software Architect and Staff+ Engineer with deep expertise in distributed systems, microservices architecture, API design, event-driven systems, and scalability patterns. You specialize in making high-impact architectural decisions, reducing technical debt, and designing systems that scale to millions of users.",
  },
  {
    id: "ai-ml",
    name: "AI/ML Researcher",
    icon: "🤖",
    color: "#6366f1",
    specialty: "Machine learning, LLMs, model selection, MLOps, AI strategy, RAG, fine-tuning",
    prompt: "You are a Senior AI/ML Researcher and applied scientist with expertise in large language models, retrieval-augmented generation (RAG), fine-tuning, MLOps, vector databases, computer vision, and AI strategy. You stay current with the latest research from OpenAI, Anthropic, Google DeepMind, and Meta AI.",
  },
  {
    id: "cto",
    name: "CTO Advisor",
    icon: "⚙️",
    color: "#f97316",
    specialty: "Technology strategy, build vs buy, team structure, technical roadmap, R&D investment",
    prompt: "You are a seasoned CTO and technology executive who has led engineering organizations of 50-500+ engineers. You specialize in technology strategy, build vs buy decisions, engineering team structure, technical roadmap planning, R&D investment prioritization, and translating business goals into engineering execution.",
  },
  {
    id: "database",
    name: "Database Architect",
    icon: "🗄️",
    color: "#84cc16",
    specialty: "Schema design, query optimization, PostgreSQL, indexing, data modeling, warehousing",
    prompt: "You are a Senior Database Architect with expert-level knowledge of PostgreSQL, data modeling, query optimization, indexing strategies, partitioning, data warehousing, and OLAP vs OLTP design. You have deep expertise in both relational databases and modern data platforms like Snowflake, BigQuery, and DuckDB.",
  },
  {
    id: "devops",
    name: "DevOps & Cloud Engineer",
    icon: "☁️",
    color: "#0ea5e9",
    specialty: "CI/CD, Kubernetes, cloud infrastructure, IaC, observability, SRE, cost optimization",
    prompt: "You are a Senior DevOps and Cloud Infrastructure Engineer with deep expertise in Kubernetes, Docker, CI/CD pipelines (GitHub Actions, GitLab CI), Terraform/Pulumi, AWS/GCP/Azure, observability (Prometheus, Grafana, DataDog), SRE practices, and cloud cost optimization. You champion infrastructure-as-code and GitOps principles.",
  },
  {
    id: "security",
    name: "Security Engineer",
    icon: "🔒",
    color: "#ef4444",
    specialty: "Application security, threat modeling, OWASP, zero trust, compliance (SOC2/GDPR), penetration testing",
    prompt: "You are a Senior Security Engineer and CISO-level advisor specializing in application security, threat modeling, zero trust architecture, OWASP Top 10, penetration testing, compliance frameworks (SOC2, ISO27001, GDPR, HIPAA), and secure SDLC. You proactively identify vulnerabilities and design defense-in-depth strategies.",
  },
  {
    id: "ux-design",
    name: "UX/UI Designer",
    icon: "🎨",
    color: "#a855f7",
    specialty: "User experience, design systems, accessibility, usability testing, interaction design, conversion optimization",
    prompt: "You are a Principal UX/UI Designer and design systems expert with deep knowledge of human-computer interaction, accessibility (WCAG 2.2), design systems (Figma, Storybook), usability testing, conversion rate optimization, and data-driven design decisions. You champion user-centered design and have shipped products used by millions.",
  },
  {
    id: "product",
    name: "Product Manager",
    icon: "🗺️",
    color: "#14b8a6",
    specialty: "Product strategy, roadmap, user research, prioritization, go-to-market, metrics",
    prompt: "You are a Senior Product Manager and product strategist with expertise in product-led growth, user research, roadmap prioritization (RICE, ICE), go-to-market strategy, competitive analysis, and defining north star metrics. You excel at translating user problems into winning product solutions and aligning engineering, design, and business stakeholders.",
  },
  {
    id: "bi",
    name: "BI & Data Architect",
    icon: "📊",
    color: "#eab308",
    specialty: "Business intelligence, KPIs, dashboards, data pipelines, analytics strategy, SQL",
    prompt: "You are a Senior Business Intelligence Architect and data strategy expert specializing in KPI frameworks, self-serve analytics, data pipeline architecture, dashboard design (Tableau, Looker, Power BI), SQL optimization, and building data-driven organizational cultures. You design metrics frameworks that connect operational data to business outcomes.",
  },
  {
    id: "automation",
    name: "Automation Architect",
    icon: "⚡",
    color: "#f43f5e",
    specialty: "Workflow automation, iPaaS, RPA, event-driven architecture, low-code, Zapier/Make",
    prompt: "You are a Senior Automation Architect and workflow intelligence expert specializing in enterprise automation platforms (Zapier, Make/Integromat, n8n, Workato), RPA (UiPath, Automation Anywhere), event-driven architecture, and AI-powered workflow orchestration. You identify and eliminate manual work through intelligent automation.",
  },
  {
    id: "api",
    name: "API Architect",
    icon: "🔌",
    color: "#06b6d4",
    specialty: "REST/GraphQL/gRPC API design, webhooks, OAuth, rate limiting, versioning, developer experience",
    prompt: "You are a Principal API Architect and developer experience expert specializing in REST, GraphQL, and gRPC API design, webhooks, OAuth 2.0/OIDC, API versioning strategies, rate limiting, developer portals, and SDK design. You have designed APIs consumed by thousands of developers and understand how to build APIs that are a joy to use.",
  },
  {
    id: "qa",
    name: "QA & Performance Engineer",
    icon: "🧪",
    color: "#10b981",
    specialty: "Test strategy, automated testing, load testing, performance optimization, reliability engineering",
    prompt: "You are a Senior QA and Performance Engineer specializing in test strategy, automated testing (Playwright, Cypress, Jest, pytest), load and stress testing (k6, Locust, JMeter), performance optimization, chaos engineering, and reliability engineering. You define quality gates, reduce flaky tests, and ensure systems perform under extreme load.",
  },
  {
    id: "mobile",
    name: "Mobile Engineer",
    icon: "📱",
    color: "#8b5cf6",
    specialty: "iOS, Android, React Native, Flutter, mobile UX, push notifications, app store optimization",
    prompt: "You are a Senior Mobile Engineer with deep expertise in iOS (Swift/SwiftUI), Android (Kotlin/Jetpack Compose), React Native, and Flutter. You specialize in mobile performance optimization, offline-first architecture, push notifications, deep linking, App Store Optimization (ASO), and mobile-specific UX patterns.",
  },
  {
    id: "technical-writer",
    name: "Technical Writer",
    icon: "✍️",
    color: "#f59e0b",
    specialty: "API documentation, user guides, architecture docs, developer onboarding, content strategy",
    prompt: "You are a Principal Technical Writer and documentation strategist specializing in API documentation, developer onboarding, architecture documentation, user guides, and docs-as-code workflows. You make complex technical concepts accessible to any audience and have documented platforms used by Fortune 500 companies.",
  },
] as const;

export type ExpertId = typeof EXPERTS[number]["id"];

// ── Web Search ─────────────────────────────────────────────────────────────────

export async function webSearch(query: string): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    // Perplexity's online model searches the live internet
    const resp = await client.chat.completions.create({
      model: MODEL_WEB,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content: "You are a real-time web research assistant. Search the internet for the latest, most accurate information. Always cite sources when possible. Be comprehensive but concise. Include relevant statistics, recent news, and expert opinions.",
        },
        { role: "user", content: query },
      ],
    });
    return resp.choices[0]?.message?.content ?? null;
  } catch (err) {
    logger.warn({ err }, "Perplexity search failed, no fallback available");
    return null;
  }
}

// ── Expert Agent System ────────────────────────────────────────────────────────

export async function runExpert(
  expertId: ExpertId,
  message: string,
  businessSnapshot: Record<string, unknown>,
  memories: string,
  webContext?: string,
): Promise<{ expertId: ExpertId; response: string; name: string; icon: string }> {
  const expert = EXPERTS.find(e => e.id === expertId)!;

  const systemPrompt = `${expert.prompt}

You are operating as part of NEXUS AI, an integrated business intelligence platform.

LIVE BUSINESS DATA:
${JSON.stringify(businessSnapshot, null, 2)}

PREVIOUS LEARNINGS:
${memories || "No prior context yet."}

${webContext ? `WEB SEARCH RESULTS (real-time internet data):\n${webContext}\n` : ""}

Respond as this specific expert. Be highly specific, data-driven, and actionable. Reference the live business data when relevant. Maximum 3-4 concise, high-value paragraphs. No fluff.`;

  const response = await llm(systemPrompt, message, { model: MODEL_REASONING, maxTokens: 1500 }) ?? `[${expert.name} is analyzing your question…]`;

  return { expertId, response, name: expert.name, icon: expert.icon };
}

// ── Orchestrated Multi-Expert Chat ─────────────────────────────────────────────

export type NexusChatOptions = {
  message: string;
  history?: { role: string; content: string; expertName?: string }[];
  sessionId?: string;
  useWebSearch?: boolean;
  requestedExperts?: ExpertId[];    // specific experts to use; empty = auto-select
  generateImage?: boolean;
  generateDocument?: "markdown" | "html" | "csv" | "json";
};

export type NexusChatResult = {
  synthesis: string;
  expertResponses: { expertId: string; name: string; icon: string; response: string }[];
  webSearchUsed: boolean;
  webSearchResults?: string;
  imageUrl?: string;
  imagePrompt?: string;
  document?: { title: string; content: string; type: string; filename: string };
  memoriesSaved: number;
  suggestedPrompts: string[];
};

export async function nexusChat(opts: NexusChatOptions): Promise<NexusChatResult> {
  const { message, history = [], sessionId, useWebSearch, requestedExperts, generateImage, generateDocument } = opts;

  // 1. Load memories relevant to this conversation
  const allMemories = await getMemories(20);
  const memoryContext = allMemories.map(m => `[${m.memoryType}] ${m.key}: ${m.value}`).join("\n");

  // 2. Get live business snapshot
  const snapshot = await getBusinessSnapshot();

  // 3. Auto-select experts based on message intent (or use requested ones)
  let selectedExpertIds: ExpertId[];
  if (requestedExperts && requestedExperts.length > 0) {
    selectedExpertIds = requestedExperts;
  } else {
    // Route the message to relevant experts using a fast classification call
    const routingResult = await llmJson<{ experts: string[] }>(
      `You are an expert router. Given a user message, select the 2-4 most relevant experts from this list to answer it. Return JSON: { experts: string[] } using only these IDs: ${EXPERTS.map(e => e.id).join(", ")}`,
      `Message: "${message}"\nBusiness context: contacts=${snapshot.contacts}, pipeline=$${snapshot.pipelineValue}, openDeals=${snapshot.openDeals}`,
      256,
    );
    selectedExpertIds = (routingResult?.experts ?? ["sales"]).filter(
      id => EXPERTS.some(e => e.id === id)
    ) as ExpertId[];
    if (selectedExpertIds.length === 0) selectedExpertIds = ["sales"];
  }

  // 4. Web search (run concurrently with expert selection)
  let webResults: string | undefined;
  let webSearchUsed = false;
  if (useWebSearch) {
    const searchQuery = `${message} business 2025 2026 latest research`;
    const result = await webSearch(searchQuery);
    if (result) { webResults = result; webSearchUsed = true; }
  }

  // 5. Run selected experts IN PARALLEL
  const expertResults = await Promise.all(
    selectedExpertIds.map(id => runExpert(id, message, snapshot, memoryContext, webResults))
  );

  // 6. Synthesize all expert responses into a unified, coherent answer
  const expertSummaries = expertResults.map(r => `### ${r.icon} ${r.name}\n${r.response}`).join("\n\n");

  const synthesisPrompt = `You are NEXUS AI — the unified intelligence layer of a business operating system. You have received parallel input from ${expertResults.length} domain experts. Synthesize their insights into ONE coherent, actionable response.

User question: "${message}"

Expert inputs:
${expertSummaries}

Synthesis rules:
- Combine the most valuable insights from all experts
- Eliminate redundancy
- Prioritize concrete next actions
- Reference specific business data where available
- Be direct, confident, and CXO-grade in communication style
- Use markdown formatting (headers, bullets, bold) for readability
- End with 2-3 "Next Steps" the user should take`;

  const synthesis = await llm(
    "You are NEXUS AI, the combined intelligence of all business domains. Synthesize expert inputs into executive-grade guidance.",
    synthesisPrompt,
    { model: MODEL_REASONING, maxTokens: 2000 }
  ) ?? expertResults[0]?.response ?? "Unable to generate synthesis.";

  // 7. Generate image if requested
  let imageUrl: string | undefined;
  let imagePrompt: string | undefined;
  if (generateImage) {
    const imgResult = await createImage(`Business visualization: ${message}`);
    imageUrl = imgResult?.url;
    imagePrompt = imgResult?.prompt;
  }

  // 8. Generate document if requested
  let document: NexusChatResult["document"];
  if (generateDocument) {
    const docResult = await createDocument({
      type: generateDocument,
      topic: message,
      content: synthesis,
      snapshot,
    });
    if (docResult) document = docResult;
  }

  // 9. Extract and save new memories from this conversation
  const memoriesToSave = await llmJson<{ memories: { key: string; value: string; type: string }[] }>(
    "Extract durable facts, patterns, or preferences from this conversation worth remembering. Return JSON: { memories: [{ key: string, value: string, type: 'fact'|'preference'|'pattern'|'insight' }] }. Return empty array if nothing worth saving. Maximum 3 items.",
    `User asked: "${message}"\nSynthesis: "${synthesis.substring(0, 500)}"`,
    512,
  );

  let memoriesSaved = 0;
  if (memoriesToSave?.memories) {
    for (const mem of memoriesToSave.memories) {
      await saveMemory({
        key: mem.key, value: mem.value,
        memoryType: (mem.type as any) ?? "insight",
        source: "inferred", sessionId,
      });
      memoriesSaved++;
    }
  }

  // 10. Save conversation to DB
  if (sessionId) {
    await Promise.all([
      saveConversation(sessionId, "user", message),
      saveConversation(sessionId, "assistant", synthesis, "NEXUS", {
        experts: selectedExpertIds, webSearchUsed,
      }),
    ]);
  }

  // 11. Generate follow-up suggestions
  const suggestions = await llmJson<{ prompts: string[] }>(
    "Generate 3 natural follow-up questions the user might want to ask next, based on their question and the response. Return JSON: { prompts: string[] }. Keep each under 60 characters.",
    `Question: "${message}"\nResponse summary: "${synthesis.substring(0, 300)}"`,
    256,
  );

  return {
    synthesis,
    expertResponses: expertResults,
    webSearchUsed,
    webSearchResults: webResults,
    imageUrl,
    imagePrompt,
    document,
    memoriesSaved,
    suggestedPrompts: suggestions?.prompts ?? [
      "What should I prioritize next?",
      "Show me detailed analytics",
      "Generate a report on this",
    ],
  };
}

// ── Image Generation (Pollinations.ai — free, no API key needed) ──────────────

export async function createImage(prompt: string): Promise<{
  url: string; prompt: string; title: string; id: number;
} | null> {
  const enhancedPrompt = await llm(
    "You are a professional art director. Enhance this prompt for AI image generation to produce a stunning, professional business visualization. Keep it under 200 characters. Return just the enhanced prompt, nothing else.",
    prompt,
    { maxTokens: 100 }
  ) ?? prompt;

  const encodedPrompt = encodeURIComponent(enhancedPrompt);
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=768&seed=${seed}&nologo=true&enhance=true&model=flux`;

  // Save to DB
  const [row] = await db.insert(aiGeneratedFilesTable).values({
    title: prompt.substring(0, 80),
    fileType: "image",
    mimeType: "image/jpeg",
    url,
    prompt: enhancedPrompt,
    metadata: { originalPrompt: prompt, seed },
  }).returning();

  return { url, prompt: enhancedPrompt, title: prompt.substring(0, 80), id: row.id };
}

// ── Document / File Generation ─────────────────────────────────────────────────

type DocType = "markdown" | "html" | "csv" | "json" | "video_script";

export async function createDocument(opts: {
  type: DocType;
  topic: string;
  content?: string;
  snapshot?: Record<string, unknown>;
  customData?: unknown;
}): Promise<{ title: string; content: string; type: string; filename: string } | null> {
  const { type, topic, content, snapshot } = opts;
  const date = new Date().toISOString().split("T")[0];

  let systemPrompt = "";
  let userPrompt = "";

  if (type === "markdown") {
    systemPrompt = "You are a technical writer creating professional Markdown documents. Use headers, tables, bullet points, and code blocks where appropriate.";
    userPrompt = `Create a comprehensive Markdown report on: "${topic}"\n\nBusiness context: ${JSON.stringify(snapshot ?? {})}\n\nAdditional content to incorporate:\n${content ?? ""}`;
  } else if (type === "html") {
    systemPrompt = `You are a web developer creating beautiful HTML reports. Use modern CSS (dark theme, professional fonts, cards, tables). Include inline styles only. Start with <!DOCTYPE html>.`;
    userPrompt = `Create a full HTML report page for: "${topic}"\n\nData: ${JSON.stringify(snapshot ?? {})}\n\nContent: ${content ?? ""}`;
  } else if (type === "csv") {
    systemPrompt = "You are a data analyst creating CSV exports. Return only valid CSV with headers. No explanation text.";
    userPrompt = `Create a CSV data export for: "${topic}"\nData: ${JSON.stringify(snapshot ?? opts.customData ?? {})}`;
  } else if (type === "json") {
    systemPrompt = "You are a data engineer creating structured JSON exports. Return only valid, well-structured JSON.";
    userPrompt = `Create a structured JSON export for: "${topic}"\nData: ${JSON.stringify(snapshot ?? opts.customData ?? {})}`;
  } else if (type === "video_script") {
    systemPrompt = "You are a professional video scriptwriter specializing in business content. Create engaging, structured video scripts with scene directions, narration, and visual cues.";
    userPrompt = `Write a professional video script for: "${topic}"\n\nBusiness data: ${JSON.stringify(snapshot ?? {})}\n\nInclude: [SCENE], [NARRATOR], [VISUAL], [CTA] markers. Target length: 60-90 seconds.`;
  }

  const generatedContent = await llm(systemPrompt, userPrompt, { maxTokens: 4096 });
  if (!generatedContent) return null;

  const extensions: Record<DocType, string> = {
    markdown: "md", html: "html", csv: "csv", json: "json", video_script: "txt",
  };
  const mimeTypes: Record<DocType, string> = {
    markdown: "text/markdown", html: "text/html", csv: "text/csv",
    json: "application/json", video_script: "text/plain",
  };

  const title = `${topic.substring(0, 60)} — ${date}`;
  const filename = `nexus-${type}-${date}.${extensions[type]}`;

  // Save to DB
  await db.insert(aiGeneratedFilesTable).values({
    title, fileType: type, mimeType: mimeTypes[type],
    content: generatedContent, prompt: topic,
    sizeBytes: Buffer.byteLength(generatedContent, "utf8"),
    metadata: { topic, date },
  });

  return { title, content: generatedContent, type, filename };
}

// ── Generated Files Browser ───────────────────────────────────────────────────

export async function getGeneratedFiles(limit = 20) {
  return db.select().from(aiGeneratedFilesTable)
    .orderBy(desc(aiGeneratedFilesTable.createdAt))
    .limit(limit);
}

// ── Continuous Learning: auto-capture from activity ───────────────────────────

export async function learnFromActivity() {
  const recent = await db.select().from(activityTable)
    .orderBy(desc(activityTable.createdAt)).limit(20);

  if (recent.length === 0) return 0;

  const learned = await llmJson<{ learnings: { key: string; value: string }[] }>(
    "You are an AI that learns from business activity logs. Extract 2-3 high-level patterns or facts worth remembering long-term for future business intelligence. Focus on trends, not individual events. Return JSON: { learnings: [{ key: string, value: string }] }",
    `Recent activities: ${JSON.stringify(recent.map(a => ({ type: a.type, title: a.title, description: a.description })))}`,
    512,
  );

  let saved = 0;
  for (const learning of learned?.learnings ?? []) {
    await saveMemory({
      key: learning.key,
      value: learning.value,
      memoryType: "learning",
      source: "observed",
    });
    saved++;
  }
  return saved;
}
