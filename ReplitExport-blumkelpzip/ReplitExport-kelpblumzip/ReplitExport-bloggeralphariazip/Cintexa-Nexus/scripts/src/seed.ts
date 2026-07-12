import {
  pool,
  db,
  companiesTable,
  contactsTable,
  leadsTable,
  dealsTable,
  ticketsTable,
  campaignsTable,
  invoicesTable,
  projectsTable,
  tasksTable,
  activityTable,
  knowledgeArticlesTable,
  automationsTable,
  notesTable,
  goalsTable,
  keyResultsTable,
} from "@workspace/db";

async function seed() {
  console.log("Seeding Cintexa Nexus demo data...");

  const companies = await db
    .insert(companiesTable)
    .values([
      { name: "Meridian Corp", industry: "Manufacturing", website: "meridiancorp.com", size: "501-1000", revenue: "48000000", country: "United States" },
      { name: "Vertex Solutions", industry: "Software", website: "vertexsolutions.io", size: "51-200", revenue: "9200000", country: "United States" },
      { name: "Northgate Inc", industry: "Retail", website: "northgateinc.com", size: "1001-5000", revenue: "120000000", country: "Canada" },
      { name: "Aurora Health", industry: "Healthcare", website: "aurorahealth.org", size: "201-500", revenue: "31000000", country: "United States" },
      { name: "Blue Harbor Logistics", industry: "Logistics", website: "blueharbor.com", size: "51-200", revenue: "6100000", country: "United Kingdom" },
      { name: "Lumen Financial", industry: "Finance", website: "lumenfinancial.com", size: "201-500", revenue: "22000000", country: "United States" },
    ])
    .returning();

  await db.insert(contactsTable).values([
    { firstName: "Elena", lastName: "Cross", email: "elena.cross@meridiancorp.com", phone: "+1-555-0142", company: "Meridian Corp", jobTitle: "VP of Operations", status: "customer", score: 88 },
    { firstName: "Marcus", lastName: "Dane", email: "marcus.dane@vertexsolutions.io", phone: "+1-555-0198", company: "Vertex Solutions", jobTitle: "CTO", status: "opportunity", score: 74 },
    { firstName: "Priya", lastName: "Nair", email: "priya.nair@northgateinc.com", phone: "+1-555-0176", company: "Northgate Inc", jobTitle: "Director of Procurement", status: "customer", score: 91 },
    { firstName: "Samuel", lastName: "Okafor", email: "samuel.okafor@aurorahealth.org", phone: "+1-555-0154", company: "Aurora Health", jobTitle: "IT Manager", status: "prospect", score: 62 },
    { firstName: "Nina", lastName: "Petrova", email: "nina.petrova@blueharbor.com", phone: "+44-20-5550-131", company: "Blue Harbor Logistics", jobTitle: "Head of Supply Chain", status: "opportunity", score: 69 },
    { firstName: "Tomas", lastName: "Reyes", email: "tomas.reyes@lumenfinancial.com", phone: "+1-555-0187", company: "Lumen Financial", jobTitle: "Controller", status: "customer", score: 85 },
    { firstName: "Grace", lastName: "Lindqvist", email: "grace.lindqvist@vertexsolutions.io", phone: "+1-555-0163", company: "Vertex Solutions", jobTitle: "Head of Product", status: "prospect", score: 58 },
    { firstName: "David", lastName: "Kim", email: "david.kim@northgateinc.com", phone: "+1-555-0121", company: "Northgate Inc", jobTitle: "Finance Manager", status: "customer", score: 79 },
  ]);

  await db.insert(leadsTable).values([
    { name: "Whitfield & Co", email: "hello@whitfieldco.com", phone: "+1-555-0301", company: "Whitfield & Co", source: "referral", status: "qualified", score: 81, notes: "Introduced by Meridian Corp; interested in enterprise tier." },
    { name: "Solace Robotics", email: "contact@solacerobotics.ai", phone: "+1-555-0322", company: "Solace Robotics", source: "website", status: "new", score: 54, notes: "Downloaded pricing sheet, no response yet." },
    { name: "Harbor & Finch", email: "info@harborfinch.com", phone: "+1-555-0344", company: "Harbor & Finch", source: "event", status: "contacted", score: 66, notes: "Met at SaaS Connect; scheduling a demo." },
    { name: "Ridgeline Analytics", email: "team@ridgeline.io", phone: "+1-555-0355", company: "Ridgeline Analytics", source: "referral", status: "qualified", score: 77, notes: "Champion is a former Vertex employee." },
    { name: "Cobalt Freight", email: "sales@cobaltfreight.com", phone: "+1-555-0366", company: "Cobalt Freight", source: "other", status: "unqualified", score: 22, notes: "Budget doesn't match tier pricing." },
  ]);

  await db.insert(dealsTable).values([
    { title: "Meridian Enterprise Renewal", value: "184000", stage: "closed_won", probability: 100, contactName: "Elena Cross", companyName: "Meridian Corp", expectedCloseDate: "2026-06-15", notes: "Renewed with 15% expansion." },
    { title: "Vertex Platform Upgrade", value: "96000", stage: "negotiation", probability: 65, contactName: "Marcus Dane", companyName: "Vertex Solutions", expectedCloseDate: "2026-07-25", notes: "Negotiating multi-year discount." },
    { title: "Northgate Retail Rollout", value: "312000", stage: "proposal", probability: 45, contactName: "Priya Nair", companyName: "Northgate Inc", expectedCloseDate: "2026-08-10", notes: "Proposal sent, awaiting procurement review." },
    { title: "Aurora Health Pilot", value: "58000", stage: "qualification", probability: 25, contactName: "Samuel Okafor", companyName: "Aurora Health", expectedCloseDate: "2026-09-01", notes: "Pilot scoped for two departments." },
    { title: "Blue Harbor Logistics Suite", value: "142000", stage: "prospecting", probability: 15, contactName: "Nina Petrova", companyName: "Blue Harbor Logistics", expectedCloseDate: "2026-09-20", notes: "Initial discovery call completed." },
    { title: "Lumen Financial Expansion", value: "76000", stage: "closed_won", probability: 100, contactName: "Tomas Reyes", companyName: "Lumen Financial", expectedCloseDate: "2026-05-30", notes: "Added 40 additional seats." },
    { title: "Vertex Analytics Add-on", value: "41000", stage: "closed_lost", probability: 0, contactName: "Grace Lindqvist", companyName: "Vertex Solutions", expectedCloseDate: "2026-06-05", notes: "Lost to internal build decision." },
    { title: "Northgate Support Tier Upsell", value: "22000", stage: "negotiation", probability: 70, contactName: "David Kim", companyName: "Northgate Inc", expectedCloseDate: "2026-07-31", notes: "Final terms under legal review." },
  ]);

  await db.insert(ticketsTable).values([
    { subject: "Billing discrepancy on July invoice", description: "Customer reports duplicate charge on invoice #INV-1042.", status: "open", priority: "high", channel: "email", contactName: "Elena Cross", assignedTo: "Sarah Chen", tags: "billing,urgent" },
    { subject: "SSO login failures for new team members", description: "Several new hires cannot authenticate via SAML.", status: "in_progress", priority: "urgent", channel: "chat", contactName: "Marcus Dane", assignedTo: "Jordan Lee", tags: "auth,sso" },
    { subject: "Export report stuck at 90%", description: "Large CSV export hangs indefinitely.", status: "open", priority: "medium", channel: "web", contactName: "Priya Nair", assignedTo: "Sarah Chen", tags: "export,bug" },
    { subject: "Feature request: dark mode for reports", description: "Customer would like a dark theme option for the analytics module.", status: "resolved", priority: "low", channel: "email", contactName: "Samuel Okafor", assignedTo: "Jordan Lee", tags: "feature-request" },
    { subject: "API rate limit questions", description: "Wants clarification on rate limits for the new integration tier.", status: "closed", priority: "low", channel: "email", contactName: "Nina Petrova", assignedTo: "Sarah Chen", tags: "api,docs" },
    { subject: "Unexpected downtime during migration", description: "Reported 12 minutes of downtime during scheduled migration window.", status: "in_progress", priority: "high", channel: "phone", contactName: "Tomas Reyes", assignedTo: "Jordan Lee", tags: "infra,incident" },
  ]);

  await db.insert(campaignsTable).values([
    { name: "Q4 Product Launch", type: "email", status: "active", audienceSize: 18400, sent: 18400, opened: 6256, clicked: 1840, converted: 312, scheduledAt: "2026-07-01" },
    { name: "Summer Referral Push", type: "email", status: "active", audienceSize: 9200, sent: 9200, opened: 3312, clicked: 920, converted: 141, scheduledAt: "2026-06-15" },
    { name: "Enterprise Webinar Series", type: "webinar", status: "scheduled", audienceSize: 3400, sent: 0, opened: 0, clicked: 0, converted: 0, scheduledAt: "2026-08-05" },
    { name: "Churn Win-back Sequence", type: "email", status: "draft", audienceSize: 1120, sent: 0, opened: 0, clicked: 0, converted: 0, scheduledAt: null },
    { name: "LinkedIn Enterprise Ads", type: "social", status: "active", audienceSize: 52000, sent: 52000, opened: 8320, clicked: 2080, converted: 96, scheduledAt: "2026-06-20" },
  ]);

  await db.insert(invoicesTable).values([
    { number: "INV-1040", clientName: "Meridian Corp", amount: "184000", tax: "14720", status: "paid", dueDate: "2026-06-20", paidAt: "2026-06-18" },
    { number: "INV-1041", clientName: "Lumen Financial", amount: "76000", tax: "6080", status: "paid", dueDate: "2026-06-05", paidAt: "2026-06-04" },
    { number: "INV-1042", clientName: "Northgate Inc", amount: "38000", tax: "3040", status: "overdue", dueDate: "2026-06-25", paidAt: null },
    { number: "INV-1043", clientName: "Vertex Solutions", amount: "25500", tax: "2040", status: "overdue", dueDate: "2026-06-30", paidAt: null },
    { number: "INV-1044", clientName: "Aurora Health", amount: "19000", tax: "1520", status: "sent", dueDate: "2026-07-28", paidAt: null },
    { number: "INV-1045", clientName: "Blue Harbor Logistics", amount: "42000", tax: "3360", status: "paid", dueDate: "2026-07-10", paidAt: "2026-07-08" },
    { number: "INV-1046", clientName: "Northgate Inc", amount: "312000", tax: "24960", status: "draft", dueDate: "2026-08-15", paidAt: null },
  ]);

  const projects = await db
    .insert(projectsTable)
    .values([
      { name: "Meridian Enterprise Onboarding", description: "Full onboarding and data migration for Meridian Corp's renewed contract.", status: "active", progress: 62, owner: "Jordan Lee", dueDate: "2026-08-01" },
      { name: "Northgate Retail Rollout", description: "Phased deployment across 40 Northgate retail locations.", status: "active", progress: 28, owner: "Sarah Chen", dueDate: "2026-09-15" },
      { name: "API v3 Migration", description: "Internal migration of all customers from API v2 to v3.", status: "planning", progress: 5, owner: "Alex Rivera", dueDate: "2026-10-01" },
      { name: "Aurora Health Pilot Program", description: "Two-department pilot ahead of full enterprise deal.", status: "active", progress: 40, owner: "Jordan Lee", dueDate: "2026-08-20" },
      { name: "Q3 Analytics Revamp", description: "Rebuild the analytics dashboard with new reporting widgets.", status: "completed", progress: 100, owner: "Sarah Chen", dueDate: "2026-06-30" },
    ])
    .returning();

  await db.insert(tasksTable).values([
    { title: "Finalize data migration mapping", status: "in_progress", priority: "high", projectId: projects[0].id, assignedTo: "Jordan Lee", dueDate: "2026-07-18" },
    { title: "Schedule Northgate store manager training", status: "todo", priority: "medium", projectId: projects[1].id, assignedTo: "Sarah Chen", dueDate: "2026-07-30" },
    { title: "Draft API v3 deprecation notice", status: "todo", priority: "medium", projectId: projects[2].id, assignedTo: "Alex Rivera", dueDate: "2026-08-01" },
    { title: "Review pilot success metrics with Aurora Health", status: "in_progress", priority: "high", projectId: projects[3].id, assignedTo: "Jordan Lee", dueDate: "2026-07-22" },
    { title: "Archive Q3 analytics revamp documentation", status: "done", priority: "low", projectId: projects[4].id, assignedTo: "Sarah Chen", dueDate: "2026-07-01" },
  ]);

  await db.insert(activityTable).values([
    { type: "deal", title: "Deal won: Meridian Enterprise Renewal", description: "Elena Cross signed the renewal at $184,000, a 15% expansion over last year." },
    { type: "ticket", title: "Urgent ticket opened: SSO login failures", description: "Marcus Dane reported SAML authentication failures for new team members." },
    { type: "contact", title: "New contact added: Grace Lindqvist", description: "Head of Product at Vertex Solutions added as a new prospect contact." },
    { type: "campaign", title: "Q4 Product Launch campaign sent", description: "Email campaign delivered to 18,400 recipients with a 34% open rate." },
    { type: "invoice", title: "Invoice INV-1045 paid", description: "Blue Harbor Logistics paid invoice INV-1045 for $42,000." },
    { type: "lead", title: "New qualified lead: Whitfield & Co", description: "Referred by Meridian Corp; interested in the enterprise tier." },
    { type: "project", title: "Q3 Analytics Revamp completed", description: "Sarah Chen marked the analytics dashboard rebuild as complete." },
    { type: "deal", title: "Deal lost: Vertex Analytics Add-on", description: "Grace Lindqvist confirmed Vertex will build the feature internally." },
  ]);

  // ── Knowledge Base ─────────────────────────────────────────────────────────
  await db.insert(knowledgeArticlesTable).values([
    {
      title: "Getting Started with NEXUS",
      slug: "getting-started-with-nexus",
      content: `Welcome to NEXUS — your company's AI-powered business operating system.

This guide walks you through the core modules and how they work together.

**Dashboard** — Your executive command center. See KPIs, revenue trajectory, pipeline health, and the AI morning brief updated daily.

**CRM Hub** — Manage contacts, companies, and leads. Every new lead is automatically scored and qualified by NEXUS AI.

**Sales Pipeline** — Track deals through stages from prospecting to close. AI surfaces at-risk deals before they slip.

**Support** — Every new ticket is triaged by NEXUS AI, assigned a priority, and given a draft reply.

**Finance** — Invoices, forecasting, and revenue analytics. AI generates narrative forecasts for exec reporting.

**Projects** — Track work across your team with task boards and progress tracking.

**Automations** — Set rules once. NEXUS runs them forever — lead qualification, ticket triage, invoice chasers, and more.

**Knowledge Base** — This very page. Keep your team's expertise organized and searchable.

**Collaboration** — Shared notes with AI-extracted action items.

**Extensions** — Webhooks, integrations, and API access to connect NEXUS to your entire stack.`,
      category: "onboarding",
      tags: "getting-started,overview,guide",
      author: "NEXUS Team",
      status: "published",
      isPinned: true,
    },
    {
      title: "How NEXUS AI Qualifies Leads",
      slug: "how-nexus-ai-qualifies-leads",
      content: `NEXUS AI acts as your always-on sales development rep. When a new lead enters the system, the AI immediately evaluates it against your historical data and ICP (Ideal Customer Profile).

**Scoring factors include:**
- Company size and industry fit
- Lead source quality (referral vs cold outbound)
- Notes and stated requirements
- Previous deal velocity with similar companies

**Score tiers:**
- 80-100: Hot — immediate follow-up recommended
- 60-79: Warm — schedule within 48 hours
- 40-59: Cold — nurture sequence
- 0-39: Unqualified — flag for review

The AI also generates a concrete "next action" for each lead — no guesswork required.

To see AI qualifications, open CRM Hub → Leads and click the Qualify button on any lead.`,
      category: "sales",
      tags: "ai,leads,qualification,crm",
      author: "Jordan Lee",
      status: "published",
      isPinned: true,
    },
    {
      title: "Setting Up Webhook Integrations",
      slug: "setting-up-webhook-integrations",
      content: `NEXUS can fire events to any external endpoint when things happen in your system.

**Step 1: Create a webhook**
Go to Extensions → Webhooks → New Webhook. Enter a name and your endpoint URL.

**Step 2: Choose events**
Subscribe to specific events (e.g. lead.created, deal.won) or select "*" for all events.

**Step 3: Test the connection**
Click "Test" to send a sample payload. A 200 response confirms success.

**Payload format:**
Every NEXUS webhook delivers a JSON payload with:
- event: the event name (e.g. "deal.won")
- timestamp: ISO 8601 datetime
- data: the full entity object

**Security:**
Optionally add a shared secret. NEXUS signs every payload with HMAC-SHA256 so you can verify authenticity on the receiving end.`,
      category: "technical",
      tags: "webhooks,integrations,api,extensions",
      author: "Alex Rivera",
      status: "published",
      isPinned: false,
    },
    {
      title: "Automation Best Practices",
      slug: "automation-best-practices",
      content: `Automations are the backbone of NEXUS's "always-on employee" philosophy. Here's how to build them well.

**Start with the highest-friction manual tasks.** Think: what does your team do every single day that takes 30 seconds but feels repetitive? That's your first automation.

**Good starting automations:**
1. Lead created → AI qualify (already built-in)
2. Ticket created → AI triage (already built-in)
3. Invoice overdue → Email reminder
4. Deal won → Create onboarding project
5. Weekly schedule → Generate pipeline report

**Monitoring:** Check the Automations page weekly. A success rate below 90% signals a broken downstream system, not an automation problem.

**Layering:** The real power comes from chaining automations. Lead qualified (hot) → Create deal → Notify account exec → Schedule follow-up task.

Ask NEXUS AI to suggest automations based on your live data — it analyzes gaps in your current coverage.`,
      category: "process",
      tags: "automations,workflow,best-practices",
      author: "Sarah Chen",
      status: "published",
      isPinned: false,
    },
    {
      title: "Revenue Forecasting with NEXUS AI",
      slug: "revenue-forecasting-nexus-ai",
      content: `NEXUS generates probability-weighted revenue forecasts that blend your current pipeline with historical win rates.

**How it works:**
1. Every deal in your pipeline has a stage and a probability (e.g. Proposal = 45%)
2. NEXUS multiplies each deal's value by its probability to produce a weighted pipeline value
3. The AI adds narrative context — trends, risks, and what needs to happen to hit target

**Reading the forecast:**
- Total Pipeline Value: raw sum of all open deals
- Weighted Pipeline: probability-adjusted expected revenue
- Outstanding Invoices: money owed that hasn't been collected
- Paid Revenue: confirmed closed-won and collected

**Running a forecast:**
Navigate to Finance → click "AI Forecast" to generate a fresh narrative. The AI also runs this automatically as part of the daily morning brief.

**Improving accuracy:**
Keep deal probabilities updated. A deal sitting in "Proposal" at 45% for 90 days should be moved to "Negotiation" or closed out.`,
      category: "billing",
      tags: "finance,forecasting,ai,revenue",
      author: "NEXUS Team",
      status: "published",
      isPinned: false,
    },
    {
      title: "NEXUS AI Morning Brief Guide",
      slug: "nexus-ai-morning-brief-guide",
      content: `The Morning Brief is NEXUS's daily executive summary — generated fresh every morning with live data across all modules.

**What's included:**
- A headline summarizing the business state
- 4-5 key insights (pipeline changes, support load, financial health)
- 3-4 concrete priorities — specific actions the team should take today

**Where to find it:**
The brief appears on the Dashboard every morning. You can also access it in the NEXUS AI Command Center for deeper conversation.

**Customizing the brief:**
Chat with NEXUS AI to drill into any insight. Ask "Which deal is at highest risk?" or "What's blocking our Q3 target?" and NEXUS responds with live data.

**Sharing the brief:**
Use the Extensions module to set up a webhook that fires the morning brief payload to your Slack channel at 8am daily.

**No OpenAI key?**
The brief still generates with live data, but without the AI narrative layer. Add OPENAI_API_KEY in your environment to unlock full AI briefings.`,
      category: "general",
      tags: "morning-brief,ai,executive,dashboard",
      author: "NEXUS Team",
      status: "published",
      isPinned: false,
    },
  ]);

  // ── Automations ────────────────────────────────────────────────────────────
  await db.insert(automationsTable).values([
    {
      name: "Auto-qualify new leads",
      description: "When a lead is created, immediately score and qualify them using AI.",
      trigger: "lead.created",
      triggerConfig: {},
      action: "ai.qualify_lead",
      actionConfig: {},
      status: "active",
      runsTotal: 47,
      runsSuccess: 46,
      lastRunAt: new Date("2026-07-11T14:32:00Z"),
    },
    {
      name: "AI triage new support tickets",
      description: "Assign priority and draft a first reply for every new ticket.",
      trigger: "ticket.created",
      triggerConfig: {},
      action: "ai.triage_ticket",
      actionConfig: {},
      status: "active",
      runsTotal: 38,
      runsSuccess: 38,
      lastRunAt: new Date("2026-07-12T09:14:00Z"),
    },
    {
      name: "Chase overdue invoices",
      description: "Send an automatic payment reminder email when an invoice passes its due date.",
      trigger: "invoice.overdue",
      triggerConfig: {},
      action: "email.send_reminder",
      actionConfig: { template: "invoice_reminder", delay_hours: 0 },
      status: "active",
      runsTotal: 12,
      runsSuccess: 12,
      lastRunAt: new Date("2026-07-10T08:00:00Z"),
    },
    {
      name: "Welcome new contacts",
      description: "Send a personalized welcome email when a new contact is added to the CRM.",
      trigger: "contact.created",
      triggerConfig: {},
      action: "email.send_welcome",
      actionConfig: { template: "contact_welcome" },
      status: "active",
      runsTotal: 23,
      runsSuccess: 22,
      lastRunAt: new Date("2026-07-11T16:45:00Z"),
    },
    {
      name: "Create onboarding project on deal won",
      description: "Automatically spin up a project template when a deal closes.",
      trigger: "deal.won",
      triggerConfig: {},
      action: "crm.create_task",
      actionConfig: { template: "onboarding_project" },
      status: "active",
      runsTotal: 6,
      runsSuccess: 6,
      lastRunAt: new Date("2026-07-08T11:20:00Z"),
    },
    {
      name: "Weekly pipeline report",
      description: "Generate and distribute a pipeline summary every Monday at 8am.",
      trigger: "schedule.weekly",
      triggerConfig: { day: "monday", time: "08:00" },
      action: "report.generate",
      actionConfig: { template: "pipeline_summary", distribute: ["slack", "email"] },
      status: "paused",
      runsTotal: 8,
      runsSuccess: 7,
      lastRunAt: new Date("2026-07-07T08:00:00Z"),
    },
  ]);

  // ── Collaboration Notes ────────────────────────────────────────────────────
  await db.insert(notesTable).values([
    {
      title: "Q3 Go-to-Market Strategy",
      content: `Key themes for Q3:
1. Push enterprise tier hard — Northgate and Aurora Health are the two deals that will make or miss the quarter.
2. Churn prevention: 3 customers at risk based on support ticket volume. Need dedicated CSM attention.
3. Marketing: LinkedIn ads showing 4.2% CTR — double the budget for the next 6 weeks.
4. Headcount: Approved 2 new AEs, start date August 1st. Onboarding plan needs to be ready.

Next review: July 18th leadership sync.`,
      author: "Jordan Lee",
      color: "cyan",
      isPinned: 1,
      tags: "strategy,q3,leadership",
    },
    {
      title: "Northgate Deal — Internal Notes",
      content: `Champion: Priya Nair (Director of Procurement)
Economic buyer: CFO (not yet engaged directly)
Timeline: Board approval needed before August 10th

Key risks:
- Procurement committee has 3 members we haven't spoken to
- Competing with one other vendor (name unknown)
- Price sensitivity on multi-year commitment

Action items:
- Get CFO intro from Priya this week
- Prepare ROI analysis for procurement committee
- Ask legal to expedite contract review`,
      author: "Sarah Chen",
      color: "emerald",
      isPinned: 1,
      entityType: "deal",
      tags: "northgate,deal,enterprise",
    },
    {
      title: "Support Load Analysis — July",
      content: `Open tickets: 2 high, 1 urgent
Main issues:
- Auth/SSO problems: Vertex Solutions (affects 8 users)
- Billing: Elena Cross at Meridian flagged duplicate charge — needs immediate resolution
- Export bug: Northgate Priya's team affected — risk to deal

Recommendation: Move Tomas Reyes (infra incident) to critical and get an ETA from engineering by EOD.

SLA breach risk: Vertex SSO ticket is at 18 hours open, SLA is 24h for urgent.`,
      author: "Alex Rivera",
      color: "rose",
      isPinned: 0,
      tags: "support,tickets,sla",
    },
    {
      title: "Marketing Experiment Results",
      content: `Experiments run in June-July:
1. Subject line A/B test: "How X company saved 40%" vs "Your Q3 toolkit" → Winner: specific ROI headline (+22% open rate)
2. Send time test: 10am Tuesday vs 9am Thursday → Tie. Will retest with larger sample.
3. LinkedIn vs Email for enterprise: LinkedIn drives higher-quality leads (avg score 71 vs 58) but 3x cost per lead.

Budget recommendation: Shift 20% of email budget to LinkedIn targeting VP+ titles in manufacturing and healthcare.`,
      author: "Morgan Kim",
      color: "violet",
      isPinned: 0,
      tags: "marketing,experiments,campaigns",
    },
    {
      title: "Team OKRs — Q3 2026",
      content: `Objective: Become the operating system for the mid-market enterprise segment.

Key Results:
KR1: Close $800K in new ARR by September 30 (currently at $321K)
KR2: Reduce average ticket resolution time from 26h to under 18h
KR3: Launch 3 new integrations (Slack, HubSpot, QuickBooks)
KR4: Publish 20 knowledge base articles across all modules
KR5: Automate 80% of repetitive ops tasks via the Automations module

Owner: Leadership team
Review cadence: Weekly Fridays`,
      author: "Jordan Lee",
      color: "amber",
      isPinned: 0,
      tags: "okrs,q3,goals,leadership",
    },
  ]);

  // Goals & OKRs
  const goal1 = await db.insert(goalsTable).values({
    title: "Grow ARR to $1.5M",
    description: "Scale revenue through enterprise deals and improved win rates across the pipeline.",
    owner: "Jordan Lee",
    quarter: "Q3",
    year: 2026,
    status: "at_risk",
    progress: 20,
  }).returning().then((r) => r[0]);

  const goal2 = await db.insert(goalsTable).values({
    title: "Achieve <15% open ticket rate",
    description: "Reduce support load through proactive automation, knowledge base expansion, and faster resolution.",
    owner: "Alex Rivera",
    quarter: "Q3",
    year: 2026,
    status: "behind",
    progress: 44,
  }).returning().then((r) => r[0]);

  const goal3 = await db.insert(goalsTable).values({
    title: "Scale and qualify pipeline to $2M",
    description: "Build a deep, well-qualified pipeline by improving lead scoring and deal velocity.",
    owner: "Sarah Chen",
    quarter: "Q3",
    year: 2026,
    status: "on_track",
    progress: 61,
  }).returning().then((r) => r[0]);

  await db.insert(keyResultsTable).values([
    // Goal 1: ARR
    {
      goalId: goal1.id,
      title: "Paid revenue reaches $500k this quarter",
      targetValue: 500000,
      currentValue: 302000,
      unit: "$",
      status: "at_risk",
      linkedMetric: "revenue",
      autoTracked: true,
    },
    {
      goalId: goal1.id,
      title: "Win rate improves to 35%",
      targetValue: 35,
      currentValue: 25,
      unit: "%",
      status: "at_risk",
      linkedMetric: "win_rate",
      autoTracked: true,
    },
    {
      goalId: goal1.id,
      title: "Average deal size reaches $60k",
      targetValue: 60000,
      currentValue: 37750,
      unit: "$",
      status: "behind",
      linkedMetric: "avg_deal_size",
      autoTracked: true,
    },
    // Goal 2: Support
    {
      goalId: goal2.id,
      title: "Open ticket rate drops below 15%",
      targetValue: 15,
      currentValue: 33,
      unit: "%",
      status: "behind",
      linkedMetric: "ticket_open_rate",
      autoTracked: true,
    },
    {
      goalId: goal2.id,
      title: "Publish 20 knowledge base articles",
      targetValue: 20,
      currentValue: 6,
      unit: "articles",
      status: "behind",
      linkedMetric: "knowledge_articles",
      autoTracked: false,
    },
    {
      goalId: goal2.id,
      title: "Automate 8 repetitive support workflows",
      targetValue: 8,
      currentValue: 5,
      unit: "automations",
      status: "on_track",
      linkedMetric: "active_automations",
      autoTracked: false,
    },
    // Goal 3: Pipeline
    {
      goalId: goal3.id,
      title: "Open pipeline value reaches $2M",
      targetValue: 2000000,
      currentValue: 1225000,
      unit: "$",
      status: "on_track",
      linkedMetric: "pipeline_value",
      autoTracked: true,
    },
    {
      goalId: goal3.id,
      title: "Lead qualification rate reaches 70%",
      targetValue: 70,
      currentValue: 60,
      unit: "%",
      status: "on_track",
      linkedMetric: "lead_conversion",
      autoTracked: true,
    },
    {
      goalId: goal3.id,
      title: "Maintain 10+ active deals at all times",
      targetValue: 10,
      currentValue: 8,
      unit: "deals",
      status: "at_risk",
      linkedMetric: "open_deals",
      autoTracked: true,
    },
  ]);

  console.log(`Seeded ${companies.length} companies, knowledge base, automations, collaboration notes, and 3 Q3 OKRs.`);
}

seed()
  .then(async () => {
    await pool.end();
    console.log("Seed complete.");
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await pool.end();
    process.exit(1);
  });
