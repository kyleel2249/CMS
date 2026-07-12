import { Router } from "express";
import { db, integrationConnectionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// Static integration catalogue
const CATALOGUE = [
  { key: "slack", name: "Slack", category: "Communication", description: "Send notifications and alerts to Slack channels when deals close, tickets escalate, or automations fire.", icon: "MessageSquare", color: "#4A154B", popular: true },
  { key: "gmail", name: "Gmail", category: "Email", description: "Sync inbound and outbound emails with contacts and deals automatically.", icon: "Mail", color: "#EA4335", popular: true },
  { key: "stripe", name: "Stripe", category: "Payments", description: "Sync invoices, subscriptions, and payment events with your finance dashboard.", icon: "CreditCard", color: "#635BFF", popular: true },
  { key: "hubspot", name: "HubSpot", category: "CRM", description: "Two-way sync contacts and deals between HubSpot and Nexus.", icon: "Layers", color: "#FF7A59", popular: false },
  { key: "salesforce", name: "Salesforce", category: "CRM", description: "Import Salesforce contacts, opportunities, and accounts into Nexus.", icon: "Cloud", color: "#00A1E0", popular: false },
  { key: "zapier", name: "Zapier", category: "Automation", description: "Connect Nexus to 5,000+ apps via Zapier triggers and actions.", icon: "Zap", color: "#FF4A00", popular: true },
  { key: "jira", name: "Jira", category: "Project Management", description: "Link Nexus projects and tickets to Jira issues for dev team handoffs.", icon: "Briefcase", color: "#0052CC", popular: false },
  { key: "notion", name: "Notion", category: "Docs", description: "Sync project documents and knowledge articles to Notion pages.", icon: "BookOpen", color: "#000000", popular: false },
  { key: "quickbooks", name: "QuickBooks", category: "Accounting", description: "Export invoices and billing data directly to QuickBooks Online.", icon: "DollarSign", color: "#2CA01C", popular: false },
  { key: "google_calendar", name: "Google Calendar", category: "Calendar", description: "Create and sync meetings from deal activity and task due dates.", icon: "Calendar", color: "#4285F4", popular: true },
  { key: "twilio", name: "Twilio", category: "Communication", description: "Trigger SMS notifications and voice calls from automations.", icon: "Phone", color: "#F22F46", popular: false },
  { key: "openai", name: "OpenAI", category: "AI", description: "Power NEXUS AI features — copilot, forecasting, triage — with your own OpenAI key.", icon: "Cpu", color: "#10A37F", popular: true },
];

router.get("/marketplace/catalogue", (_req, res) => {
  res.json(CATALOGUE);
});

router.get("/marketplace/connections", async (req, res) => {
  try {
    const rows = await db.select().from(integrationConnectionsTable).orderBy(desc(integrationConnectionsTable.createdAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

router.post("/marketplace/connections", async (req, res) => {
  try {
    const item = CATALOGUE.find((c) => c.key === req.body.integrationKey);
    const [row] = await db.insert(integrationConnectionsTable).values({
      integrationKey: req.body.integrationKey,
      displayName: item?.name ?? req.body.integrationKey,
      status: "connected",
      config: req.body.config ?? {},
      connectedAt: new Date(),
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create connection" });
  }
});

router.patch("/marketplace/connections/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(integrationConnectionsTable)
      .set(req.body)
      .where(eq(integrationConnectionsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update connection" });
  }
});

router.delete("/marketplace/connections/:id", async (req, res) => {
  try {
    await db.delete(integrationConnectionsTable).where(eq(integrationConnectionsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
