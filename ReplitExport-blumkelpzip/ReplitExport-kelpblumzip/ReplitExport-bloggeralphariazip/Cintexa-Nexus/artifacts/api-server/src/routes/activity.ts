import { Router } from "express";
import { db } from "@workspace/db";
import {
  activityTable,
  contactsTable,
  dealsTable,
  ticketsTable,
  leadsTable,
  invoicesTable,
  projectsTable,
  knowledgeArticlesTable,
  automationsTable,
  notesTable,
} from "@workspace/db";
import { desc } from "drizzle-orm";
import { commentOnEvent } from "../lib/ai";

const router = Router();

type StreamEvent = {
  id: string;
  type: string;
  module: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

function moduleColor(module: string): string {
  const map: Record<string, string> = {
    crm: "violet",
    sales: "cyan",
    support: "rose",
    marketing: "amber",
    finance: "emerald",
    projects: "blue",
    automations: "orange",
    knowledge: "purple",
    collaboration: "teal",
    system: "slate",
  };
  return map[module] ?? "slate";
}

router.get("/activity/stream", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 50), 100);
    const module = req.query.module as string | undefined;

    const [
      rawActivity,
      contacts,
      deals,
      tickets,
      leads,
      invoices,
      projects,
      articles,
      automations,
      notes,
    ] = await Promise.all([
      db.select().from(activityTable).orderBy(desc(activityTable.createdAt)).limit(20),
      db.select().from(contactsTable).orderBy(desc(contactsTable.id)).limit(8),
      db.select().from(dealsTable).orderBy(desc(dealsTable.id)).limit(8),
      db.select().from(ticketsTable).orderBy(desc(ticketsTable.id)).limit(8),
      db.select().from(leadsTable).orderBy(desc(leadsTable.id)).limit(6),
      db.select().from(invoicesTable).orderBy(desc(invoicesTable.id)).limit(6),
      db.select().from(projectsTable).orderBy(desc(projectsTable.id)).limit(4),
      db.select().from(knowledgeArticlesTable).orderBy(desc(knowledgeArticlesTable.id)).limit(4),
      db.select().from(automationsTable).orderBy(desc(automationsTable.id)).limit(6),
      db.select().from(notesTable).orderBy(desc(notesTable.id)).limit(4),
    ]);

    const events: StreamEvent[] = [];

    // Base activity log
    for (const a of rawActivity) {
      const mod = a.type.split(".")[0] ?? "system";
      events.push({
        id: `activity-${a.id}`,
        type: a.type,
        module: mod === "lead" ? "crm" : mod === "deal" ? "sales" : mod === "ticket" ? "support" : mod,
        title: a.title,
        description: a.description,
        timestamp: a.createdAt.toISOString(),
      });
    }

    // Synthesize events from live data
    const now = Date.now();

    for (const c of contacts) {
      events.push({
        id: `contact-${c.id}`,
        type: "contact.created",
        module: "crm",
        title: `Contact added: ${c.name}`,
        description: `${c.name} at ${c.company ?? "unknown company"} added to CRM.`,
        timestamp: new Date(now - c.id * 3_600_000 * 2).toISOString(),
        metadata: { contactId: c.id, company: c.company },
      });
    }

    for (const d of deals) {
      const isDealWon = d.stage === "closed_won";
      const isDealLost = d.stage === "closed_lost";
      events.push({
        id: `deal-${d.id}`,
        type: isDealWon ? "deal.won" : isDealLost ? "deal.lost" : "deal.stage_changed",
        module: "sales",
        title: isDealWon
          ? `Deal won: ${d.title}`
          : isDealLost
          ? `Deal lost: ${d.title}`
          : `Deal updated: ${d.title}`,
        description: `${d.title} moved to ${d.stage.replace(/_/g, " ")} — value $${Number(d.value).toLocaleString()}, ${d.probability}% probability.`,
        timestamp: new Date(now - d.id * 5_400_000).toISOString(),
        metadata: { dealId: d.id, stage: d.stage, value: d.value, probability: d.probability },
      });
    }

    for (const t of tickets) {
      events.push({
        id: `ticket-${t.id}`,
        type: `ticket.${t.status}`,
        module: "support",
        title: `Ticket ${t.status}: ${t.subject}`,
        description: `${t.contactName} via ${t.channel} — priority: ${t.priority}.`,
        timestamp: new Date(now - t.id * 4_200_000).toISOString(),
        metadata: { ticketId: t.id, priority: t.priority, channel: t.channel, status: t.status },
      });
    }

    for (const l of leads) {
      events.push({
        id: `lead-${l.id}`,
        type: l.status === "qualified" ? "lead.qualified" : "lead.created",
        module: "crm",
        title: l.status === "qualified" ? `Lead qualified: ${l.name}` : `New lead: ${l.name}`,
        description: `${l.name} from ${l.company ?? "unknown"} via ${l.source} — score ${l.score ?? 0}.`,
        timestamp: new Date(now - l.id * 6_000_000).toISOString(),
        metadata: { leadId: l.id, score: l.score, source: l.source, status: l.status },
      });
    }

    for (const inv of invoices) {
      const type = inv.status === "paid" ? "invoice.paid" : inv.status === "overdue" ? "invoice.overdue" : "invoice.sent";
      events.push({
        id: `invoice-${inv.id}`,
        type,
        module: "finance",
        title: `Invoice ${inv.status}: ${inv.number}`,
        description: `$${Number(inv.amount).toLocaleString()} — ${inv.status}.`,
        timestamp: new Date(now - inv.id * 8_000_000).toISOString(),
        metadata: { invoiceId: inv.id, amount: inv.amount, status: inv.status, number: inv.number },
      });
    }

    for (const p of projects) {
      events.push({
        id: `project-${p.id}`,
        type: `project.${p.status}`,
        module: "projects",
        title: `Project ${p.status}: ${p.name}`,
        description: `${p.name} is ${p.status} — ${p.progress ?? 0}% complete.`,
        timestamp: new Date(now - p.id * 12_000_000).toISOString(),
        metadata: { projectId: p.id, status: p.status, progress: p.progress },
      });
    }

    for (const art of articles) {
      events.push({
        id: `article-${art.id}`,
        type: "article.published",
        module: "knowledge",
        title: `Article published: ${art.title}`,
        description: `"${art.title}" added to the ${art.category} knowledge base by ${art.author}.`,
        timestamp: new Date(now - art.id * 9_000_000).toISOString(),
        metadata: { articleId: art.id, category: art.category, author: art.author },
      });
    }

    for (const auto of automations) {
      if (auto.lastRunAt) {
        events.push({
          id: `automation-${auto.id}`,
          type: "automation.run",
          module: "automations",
          title: `Automation ran: ${auto.name}`,
          description: `"${auto.name}" fired (${auto.runsSuccess}/${auto.runsTotal} successful runs).`,
          timestamp: new Date(auto.lastRunAt).toISOString(),
          metadata: { automationId: auto.id, trigger: auto.trigger, action: auto.action, status: auto.status },
        });
      }
    }

    for (const n of notes) {
      events.push({
        id: `note-${n.id}`,
        type: "note.created",
        module: "collaboration",
        title: `Note shared: ${n.title}`,
        description: `${n.author} shared a ${n.tags ? n.tags.split(",")[0] : "general"} note.`,
        timestamp: new Date(now - n.id * 7_200_000).toISOString(),
        metadata: { noteId: n.id, author: n.author, tags: n.tags },
      });
    }

    // Deduplicate by id and sort by timestamp desc
    const seen = new Set<string>();
    const deduped = events.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });

    deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter by module if requested
    const filtered = module && module !== "all"
      ? deduped.filter((e) => e.module === module)
      : deduped;

    res.json(filtered.slice(0, limit));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch activity stream" });
  }
});

router.post("/activity/stream/comment", async (req, res) => {
  try {
    const { type, title, description, module, metadata } = req.body as {
      type: string;
      title: string;
      description: string;
      module: string;
      metadata?: Record<string, unknown>;
    };

    if (!type || !title) {
      return res.status(400).json({ error: "type and title are required" });
    }

    const comment = await commentOnEvent({ type, title, description: description ?? "", module: module ?? "system", metadata });

    res.json({
      comment: comment ?? "NEXUS AI is not configured — add an OPENAI_API_KEY to enable commentary.",
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate comment" });
  }
});

// Volume stats by module
router.get("/activity/stream/stats", async (req, res) => {
  try {
    const [contacts, deals, tickets, leads, invoices, projects, articles, automations, notes] = await Promise.all([
      db.select().from(contactsTable),
      db.select().from(dealsTable),
      db.select().from(ticketsTable),
      db.select().from(leadsTable),
      db.select().from(invoicesTable),
      db.select().from(projectsTable),
      db.select().from(knowledgeArticlesTable),
      db.select().from(automationsTable),
      db.select().from(notesTable),
    ]);

    const stats = [
      { module: "crm",           label: "CRM",           count: contacts.length + leads.length,  color: "violet" },
      { module: "sales",         label: "Sales",         count: deals.length,                   color: "cyan" },
      { module: "support",       label: "Support",       count: tickets.length,                  color: "rose" },
      { module: "finance",       label: "Finance",       count: invoices.length,                 color: "emerald" },
      { module: "projects",      label: "Projects",      count: projects.length,                 color: "blue" },
      { module: "automations",   label: "Automations",   count: automations.filter((a) => a.lastRunAt).length, color: "orange" },
      { module: "knowledge",     label: "Knowledge",     count: articles.length,                 color: "purple" },
      { module: "collaboration",  label: "Collab",        count: notes.length,                    color: "teal" },
    ];

    res.json({ stats, total: stats.reduce((s, m) => s + m.count, 0) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch stream stats" });
  }
});

export default router;
