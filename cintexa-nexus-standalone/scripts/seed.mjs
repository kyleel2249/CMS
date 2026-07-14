/**
 * Populates the database with realistic demo data.
 * Reads DATABASE_URL from .env or the environment.
 *
 * Usage:  node scripts/seed.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

// Load .env
const envPath = path.join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set."); process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = (sql, params = []) => pool.query(sql, params);

async function seed() {
  console.log("Seeding demo data…");

  // Companies
  const { rows: companies } = await q(`
    INSERT INTO companies (name, industry, website, size, revenue, country)
    VALUES
      ('Meridian Corp','Manufacturing','meridiancorp.com','501-1000','48000000','United States'),
      ('Vertex Solutions','Software','vertexsolutions.io','51-200','9200000','United States'),
      ('Northgate Inc','Retail','northgateinc.com','1001-5000','120000000','Canada'),
      ('Aurora Health','Healthcare','aurorahealth.org','201-500','31000000','United States'),
      ('Blue Harbor Logistics','Logistics','blueharbor.com','51-200','6100000','United Kingdom'),
      ('Lumen Financial','Finance','lumenfinancial.com','201-500','22000000','United States')
    RETURNING id`);

  // Contacts
  const { rows: contacts } = await q(`
    INSERT INTO contacts (first_name, last_name, email, phone, company, job_title, status, score)
    VALUES
      ('Elena','Cross','elena.cross@meridiancorp.com','+1-555-0142','Meridian Corp','VP of Operations','customer',88),
      ('Marcus','Dane','marcus.dane@vertexsolutions.io','+1-555-0198','Vertex Solutions','CTO','opportunity',74),
      ('Priya','Nair','priya.nair@northgateinc.com','+1-555-0176','Northgate Inc','Director of Procurement','customer',91),
      ('Samuel','Okafor','samuel.okafor@aurorahealth.org','+1-555-0154','Aurora Health','IT Manager','prospect',62),
      ('Nina','Petrova','nina.petrova@blueharbor.com','+44-20-5550-131','Blue Harbor Logistics','Head of Supply Chain','opportunity',69),
      ('Tomas','Reyes','tomas.reyes@lumenfinancial.com','+1-555-0187','Lumen Financial','Controller','customer',85),
      ('Grace','Lindqvist','grace.lindqvist@vertexsolutions.io','+1-555-0163','Vertex Solutions','Head of Product','prospect',58),
      ('David','Kim','david.kim@northgateinc.com','+1-555-0121','Northgate Inc','Finance Manager','customer',79)
    RETURNING id`);

  // Leads
  await q(`
    INSERT INTO leads (name, email, phone, company, source, status, score, notes) VALUES
      ('Whitfield & Co','hello@whitfieldco.com','+1-555-0301','Whitfield & Co','referral','qualified',81,'Introduced by Meridian Corp; interested in enterprise tier.'),
      ('Solace Robotics','contact@solacerobotics.ai','+1-555-0322','Solace Robotics','website','new',54,'Downloaded pricing sheet, no response yet.'),
      ('Harbor & Finch','info@harborfinch.com','+1-555-0344','Harbor & Finch','event','contacted',66,'Met at SaaS Connect; scheduling a demo.'),
      ('Ridgeline Analytics','team@ridgeline.io','+1-555-0355','Ridgeline Analytics','referral','qualified',77,'Champion is a former Vertex employee.'),
      ('Cobalt Freight','sales@cobaltfreight.com','+1-555-0366','Cobalt Freight','other','unqualified',22,'Budget does not match tier pricing.')`);

  // Deals
  const { rows: deals } = await q(`
    INSERT INTO deals (title, value, stage, probability, contact_name, company_name, expected_close_date, notes) VALUES
      ('Meridian Enterprise Renewal',184000,'closed_won',100,'Elena Cross','Meridian Corp','2026-06-15','Renewed with 15% expansion.'),
      ('Vertex Platform Upgrade',96000,'negotiation',65,'Marcus Dane','Vertex Solutions','2026-07-25','Negotiating multi-year discount.'),
      ('Northgate Retail Rollout',312000,'proposal',45,'Priya Nair','Northgate Inc','2026-08-10','Proposal sent, awaiting procurement review.'),
      ('Aurora Health Pilot',58000,'qualification',25,'Samuel Okafor','Aurora Health','2026-09-01','Pilot scoped for two departments.'),
      ('Blue Harbor Logistics Suite',142000,'prospecting',15,'Nina Petrova','Blue Harbor Logistics','2026-09-20','Initial discovery call completed.'),
      ('Lumen Financial Expansion',76000,'closed_won',100,'Tomas Reyes','Lumen Financial','2026-05-30','Added 40 additional seats.'),
      ('Vertex Analytics Add-on',41000,'closed_lost',0,'Grace Lindqvist','Vertex Solutions','2026-06-05','Lost to internal build decision.'),
      ('Northgate Support Tier Upsell',22000,'negotiation',70,'David Kim','Northgate Inc','2026-07-31','Final terms under legal review.')
    RETURNING id`);

  // Tickets
  await q(`
    INSERT INTO tickets (subject, description, status, priority, channel, contact_name, assigned_to, tags) VALUES
      ('SSO login failures after IdP update','SAML authentication failing for new team members after recent identity provider certificate rotation.','open','high','email','Marcus Dane','Sarah Chen','sso,auth,urgent'),
      ('Billing discrepancy on July invoice','Customer reports duplicate charge on invoice #INV-1042.','open','high','email','Elena Cross','Sarah Chen','billing,urgent'),
      ('Dashboard not loading for read-only users','Users with read-only role see a blank dashboard after last release.','in_progress','medium','chat','Priya Nair','Alex Rivera','bug,dashboard'),
      ('Feature request: dark mode for reports','Customer would like a dark theme option for the analytics module.','resolved','low','email','Samuel Okafor','Jordan Lee','feature-request')`);

  // Campaigns
  await q(`
    INSERT INTO campaigns (name, type, status, audience_size, sent, opened, clicked, converted) VALUES
      ('Q4 Product Launch','email','active',18400,18400,6256,1840,312),
      ('Summer Referral Push','email','active',9200,9200,3312,920,141),
      ('Enterprise Decision-Makers LinkedIn','social','active',4200,0,1890,380,42),
      ('Churn Win-back Sequence','email','draft',1120,0,0,0,0)`);

  // Invoices
  await q(`
    INSERT INTO invoices (number, client_name, amount, tax, status, due_date, paid_at) VALUES
      ('INV-1040','Meridian Corp',184000,14720,'paid','2026-06-20','2026-06-18'),
      ('INV-1041','Lumen Financial',76000,6080,'paid','2026-06-05','2026-06-03'),
      ('INV-1042','Northgate Inc',38000,3040,'overdue','2026-06-25',NULL),
      ('INV-1043','Vertex Solutions',25500,2040,'overdue','2026-06-30',NULL),
      ('INV-1044','Aurora Health',19000,1520,'sent','2026-07-28',NULL),
      ('INV-1045','Blue Harbor Logistics',42000,3360,'paid','2026-07-10','2026-07-08'),
      ('INV-1046','Northgate Inc',312000,24960,'draft','2026-08-15',NULL)`);

  // Projects + tasks
  const { rows: projects } = await q(`
    INSERT INTO projects (name, description, status, progress, owner, due_date) VALUES
      ('Meridian Enterprise Onboarding','Full onboarding and data migration for Meridian Corp''s renewed contract.','active',62,'Jordan Lee','2026-08-01'),
      ('Northgate Retail Rollout','Phased deployment across 40 Northgate retail locations.','active',28,'Sarah Chen','2026-09-15'),
      ('API v3 Migration','Internal migration of all customers from API v2 to v3.','planning',5,'Alex Rivera','2026-10-01'),
      ('Aurora Health Pilot Program','Two-department pilot ahead of full enterprise deal.','active',40,'Jordan Lee','2026-08-20'),
      ('Q3 Analytics Revamp','Rebuild the analytics dashboard with new reporting widgets.','completed',100,'Sarah Chen','2026-06-30')
    RETURNING id`);

  await q(`
    INSERT INTO tasks (title, status, priority, project_id, assigned_to, due_date) VALUES
      ('Finalize data migration mapping','in_progress','high',${projects[0].id},'Jordan Lee','2026-07-18'),
      ('Schedule Northgate store manager training','todo','medium',${projects[1].id},'Sarah Chen','2026-07-30'),
      ('Draft API v3 deprecation notice','todo','medium',${projects[2].id},'Alex Rivera','2026-08-01'),
      ('Review pilot success metrics with Aurora Health','in_progress','high',${projects[3].id},'Jordan Lee','2026-07-22'),
      ('Archive Q3 analytics revamp documentation','done','low',${projects[4].id},'Sarah Chen','2026-07-01')`);

  // Activity
  await q(`
    INSERT INTO activity (type, title, description) VALUES
      ('deal','Deal won: Meridian Enterprise Renewal','Elena Cross signed the renewal at $184,000, a 15% expansion over last year.'),
      ('ticket','Urgent ticket opened: SSO login failures','Marcus Dane reported SAML authentication failures for new team members.'),
      ('contact','New contact added: Grace Lindqvist','Head of Product at Vertex Solutions added as a new prospect contact.'),
      ('campaign','Q4 Product Launch campaign sent','Email campaign delivered to 18,400 recipients with a 34% open rate.'),
      ('invoice','Invoice INV-1045 paid','Blue Harbor Logistics paid invoice INV-1045 for $42,000.'),
      ('lead','New qualified lead: Whitfield & Co','Referred by Meridian Corp; interested in the enterprise tier.'),
      ('project','Q3 Analytics Revamp completed','Sarah Chen marked the analytics dashboard rebuild as complete.')`);

  // Email threads + messages
  const { rows: threads } = await q(`
    INSERT INTO email_threads (subject, participants, is_read, is_starred, labels, contact_id, deal_id, ai_summary, ai_triage, last_message_at)
    VALUES
      ('Meridian Corp — Enterprise Renewal Contract',ARRAY['elena.cross@meridiancorp.com','jordan.lee@cintexanexus.com'],true,true,ARRAY['contract','priority'],${contacts[0].id},${deals[0].id},'Elena confirmed renewal at $184K. Awaiting countersignature.','priority','2026-07-10 14:32:00'),
      ('Vertex Platform Upgrade — Multi-Year Discount',ARRAY['marcus.dane@vertexsolutions.io','sarah.chen@cintexanexus.com'],false,false,ARRAY['negotiation'],${contacts[1].id},${deals[1].id},'Marcus pushing for 20% multi-year discount.','follow-up','2026-07-11 09:15:00'),
      ('Northgate Retail Rollout — Procurement Review',ARRAY['priya.nair@northgateinc.com','jordan.lee@cintexanexus.com'],false,true,ARRAY['proposal','legal'],${contacts[2].id},${deals[2].id},'Legal flagged two SLA clauses. Sign-off expected July 18.','action-required','2026-07-11 16:48:00'),
      ('Re: SSO Login Failures — SAML Auth Fix',ARRAY['marcus.dane@vertexsolutions.io','support@cintexanexus.com'],true,false,ARRAY['support','resolved'],${contacts[1].id},NULL,'SAML certificate mismatch resolved.','resolved','2026-07-09 11:22:00'),
      ('Aurora Health Pilot — Success Metrics Review',ARRAY['samuel.okafor@aurorahealth.org','jordan.lee@cintexanexus.com'],false,false,ARRAY['pilot'],${contacts[3].id},${deals[3].id},'Samuel wants to review pilot KPIs before full rollout.','follow-up','2026-07-10 08:05:00'),
      ('Blue Harbor — Initial Discovery Follow-up',ARRAY['nina.petrova@blueharbor.com','alex.rivera@cintexanexus.com'],true,false,ARRAY['prospecting'],${contacts[4].id},${deals[4].id},'Demo slot confirmed for July 17.','scheduled','2026-07-08 15:30:00')
    RETURNING id`);

  await q(`
    INSERT INTO email_messages (thread_id, from_address, to_addresses, body, is_outbound, is_read, sent_at) VALUES
      (${threads[0].id},'elena.cross@meridiancorp.com',ARRAY['jordan.lee@cintexanexus.com'],'Jordan, we are ready to proceed with the renewal. Can you send the updated contract?',false,true,'2026-07-08 10:00:00'),
      (${threads[0].id},'jordan.lee@cintexanexus.com',ARRAY['elena.cross@meridiancorp.com'],'Hi Elena, attached is the updated contract with the 15% expansion terms. Legal has signed off.',true,true,'2026-07-09 09:30:00'),
      (${threads[0].id},'elena.cross@meridiancorp.com',ARRAY['jordan.lee@cintexanexus.com'],'Perfect. I have passed it to our legal team. Expect the countersignature by end of week.',false,true,'2026-07-10 14:32:00'),
      (${threads[1].id},'marcus.dane@vertexsolutions.io',ARRAY['sarah.chen@cintexanexus.com'],'Sarah, we would like to revisit pricing for a 3-year commitment. Our CFO is asking for 20% off list.',false,false,'2026-07-11 09:15:00'),
      (${threads[2].id},'priya.nair@northgateinc.com',ARRAY['jordan.lee@cintexanexus.com'],'Legal flagged sections 4.2 and 8.1 of the SLA. Please review and propose revised language.',false,false,'2026-07-11 16:48:00'),
      (${threads[3].id},'support@cintexanexus.com',ARRAY['marcus.dane@vertexsolutions.io'],'We identified the issue — SAML certificate on your IdP expired. Please rotate it.',true,true,'2026-07-09 08:45:00'),
      (${threads[3].id},'marcus.dane@vertexsolutions.io',ARRAY['support@cintexanexus.com'],'Done! All team members can log in now. Thanks for the quick fix.',false,true,'2026-07-09 11:22:00'),
      (${threads[4].id},'samuel.okafor@aurorahealth.org',ARRAY['jordan.lee@cintexanexus.com'],'Before I recommend full rollout to our CISO I need a formal review of pilot KPIs. Can we schedule a call?',false,false,'2026-07-10 08:05:00'),
      (${threads[5].id},'alex.rivera@cintexanexus.com',ARRAY['nina.petrova@blueharbor.com'],'Hi Nina, I reserved a 45-minute demo slot for July 17 at 2pm BST focused on logistics modules.',true,true,'2026-07-08 15:30:00')`);

  // Webhooks
  await q(`
    INSERT INTO webhooks (name, url, events, is_active, deliveries_total, deliveries_success) VALUES
      ('Slack — Deal Stage Changes','https://hooks.slack.com/services/placeholder','deal.stage_changed,deal.won,deal.lost',true,142,140),
      ('Zapier — New Lead Created','https://hooks.zapier.com/hooks/catch/placeholder','lead.created,lead.qualified',true,89,89),
      ('Internal BI — Invoice Paid','https://bi.internal.corp/webhook/invoices','invoice.paid,invoice.overdue',false,34,31)`);

  // Goals + key results
  const { rows: goals } = await q(`
    INSERT INTO goals (title, description, owner, quarter, year, status, progress) VALUES
      ('Grow ARR to $5M by Q4 2026','Expand revenue through enterprise upsells and new logo acquisition.','Sarah Chen','Q4',2026,'on_track',62),
      ('Launch AI-powered support automation','Reduce ticket resolution time by 40% using NEXUS AI triage.','Alex Rivera','Q3',2026,'on_track',55),
      ('Build $2M+ pipeline for Q3','Ensure sufficient pipeline coverage for Q3 quota attainment.','Jordan Lee','Q3',2026,'on_track',71)
    RETURNING id`);

  await q(`
    INSERT INTO key_results (goal_id, title, target_value, current_value, unit, status, linked_metric, auto_tracked) VALUES
      (${goals[0].id},'Close 3 enterprise deals above $100K',3,1,'deals','on_track','enterprise_deals',true),
      (${goals[0].id},'Upsell 8 existing accounts',8,5,'accounts','on_track','upsells',false),
      (${goals[1].id},'AI triage rate reaches 80% of tickets',80,52,'%','on_track','ai_triage_rate',true),
      (${goals[2].id},'Open pipeline value reaches $2M',2000000,1225000,'$','on_track','pipeline_value',true),
      (${goals[2].id},'Maintain 10+ active deals',10,8,'deals','at_risk','open_deals',true)`);

  // Knowledge articles
  await q(`
    INSERT INTO knowledge_articles (title, slug, content, category, tags, status, helpful) VALUES
      ('Getting Started with CINTEXA NEXUS','getting-started','Welcome to CINTEXA NEXUS. This guide walks you through setting up your account, importing contacts, and activating your first AI workflow.','onboarding','setup,quickstart,beginner','published',42),
      ('How AI Deal Scoring Works','ai-deal-scoring','NEXUS AI analyzes 14 signals from your CRM to produce a deal win probability score (0–100). Signals include engagement recency, deal velocity, company size, and stage progression.','ai','ai,deals,scoring','published',31),
      ('Setting Up Webhook Integrations','setting-up-webhook-integrations','Webhooks let you push real-time events to external systems. Navigate to Extensions → Webhooks to create and test outbound webhooks.','integrations','webhooks,api,integrations','published',18)`);

  // Automations
  await q(`
    INSERT INTO automations (name, description, trigger, trigger_config, action, action_config, status, runs_total, runs_success) VALUES
      ('New Lead Auto-Qualify','Automatically score and qualify new leads using NEXUS AI when they are created.','lead.created','{"source": "any"}','ai.qualify_lead','{"notify_slack":"#sales"}','active',89,87),
      ('Overdue Invoice Alert','Send a Slack alert and create a follow-up task when an invoice becomes overdue.','invoice.overdue','{"grace_days": 0}','notify_slack','{"channel":"#finance","create_task":"account_owner"}','active',12,12),
      ('Deal Won Celebration','Post a win announcement to Slack and log an activity when a deal moves to Closed Won.','deal.stage_changed','{"to_stage": "closed_won"}','notify_slack','{"channel":"#wins","create_activity":true}','active',6,6)`);

  console.log("✅ Demo data seeded successfully.");
  await pool.end();
}

seed().catch(async (err) => {
  console.error("❌ Seed failed:", err.message);
  await pool.end();
  process.exit(1);
});
