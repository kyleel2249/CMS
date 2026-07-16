import { Router } from "express";
import { db, emailThreadsTable, emailMessagesTable, activityTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import * as ai from "../lib/ai";
import * as emailService from "../lib/email";

const router = Router();

function threadToResponse(t: typeof emailThreadsTable.$inferSelect) {
  return {
    id: t.id,
    subject: t.subject,
    participants: t.participants,
    lastMessageAt: t.lastMessageAt.toISOString(),
    isRead: t.isRead,
    isStarred: t.isStarred,
    labels: t.labels,
    contactId: t.contactId,
    dealId: t.dealId,
    ticketId: t.ticketId,
    aiSummary: t.aiSummary,
    aiTriage: t.aiTriage,
    createdAt: t.createdAt.toISOString(),
  };
}

function messageToResponse(m: typeof emailMessagesTable.$inferSelect) {
  return {
    id: m.id,
    threadId: m.threadId,
    from: m.from,
    to: m.to,
    cc: m.cc,
    body: m.body,
    bodyHtml: m.bodyHtml,
    isOutbound: m.isOutbound,
    isRead: m.isRead,
    aiDraft: m.aiDraft,
    sentAt: m.sentAt.toISOString(),
    createdAt: m.createdAt.toISOString(),
  };
}

// GET /email/config — returns sender identity and inbound webhook URL
router.get("/email/config", (req, res) => {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const forwardedHost = req.headers["x-forwarded-host"] as string | undefined;
  const host = forwardedHost ?? req.headers.host ?? devDomain ?? "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) ?? (devDomain ? "https" : "http");
  const webhookUrl = `${proto}://${host}/api/email/inbound`;
  res.json({
    connected: emailService.emailEnabled(),
    provider: "resend",
    fromEmail: emailService.FROM_EMAIL,
    webhookUrl,
  });
});

// GET /email/threads
router.get("/email/threads", async (req, res) => {
  try {
    const label = req.query.label as string | undefined;
    const starred = req.query.starred === "true";
    const limit = Number(req.query.limit ?? 50);

    let query = db.select().from(emailThreadsTable);
    if (starred) query = query.where(eq(emailThreadsTable.isStarred, true)) as typeof query;
    const rows = await query.orderBy(desc(emailThreadsTable.lastMessageAt)).limit(limit);

    let result = rows;
    if (label) result = result.filter((t) => t.labels.includes(label));
    res.json(result.map(threadToResponse));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// GET /email/threads/:id
router.get("/email/threads/:id", async (req, res) => {
  try {
    const [thread] = await db.select().from(emailThreadsTable).where(eq(emailThreadsTable.id, Number(req.params.id)));
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    const messages = await db
      .select()
      .from(emailMessagesTable)
      .where(eq(emailMessagesTable.threadId, thread.id))
      .orderBy(emailMessagesTable.sentAt);
    res.json({ thread: threadToResponse(thread), messages: messages.map(messageToResponse) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

// POST /email/threads — compose a new email
router.post("/email/threads", async (req, res) => {
  try {
    const { subject, participants, contactId, dealId, body, from } = req.body;

    // Create thread in DB
    const [thread] = await db
      .insert(emailThreadsTable)
      .values({ subject, participants: participants ?? [], contactId, dealId })
      .returning();

    let resendId: string | undefined;

    if (body) {
      // Actually send via Resend
      if (emailService.emailEnabled()) {
        try {
          resendId = await emailService.sendEmail({
            from: from ?? emailService.FROM_EMAIL,
            to: participants ?? [],
            subject,
            body,
          });
          req.log.info({ resendId }, "Email sent via Resend");
        } catch (sendErr) {
          req.log.error(sendErr, "Resend delivery failed — message saved locally only");
        }
      }

      await db.insert(emailMessagesTable).values({
        threadId: thread.id,
        from: from ?? emailService.FROM_EMAIL,
        to: participants ?? [],
        body,
        isOutbound: true,
        metadata: resendId ? { resendId } : null,
      });
    }

    res.status(201).json({ ...threadToResponse(thread), resendId });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create thread" });
  }
});

// PATCH /email/threads/:id
router.patch("/email/threads/:id", async (req, res) => {
  try {
    const [row] = await db
      .update(emailThreadsTable)
      .set(req.body)
      .where(eq(emailThreadsTable.id, Number(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(threadToResponse(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update thread" });
  }
});

// POST /email/threads/:id/reply — send a reply
router.post("/email/threads/:id/reply", async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const { from, to, body, cc, isOutbound } = req.body;
    const outbound = isOutbound ?? true;

    let resendId: string | undefined;

    if (outbound && emailService.emailEnabled()) {
      // Fetch subject for the reply
      const [thread] = await db.select().from(emailThreadsTable).where(eq(emailThreadsTable.id, threadId));
      if (thread) {
        try {
          resendId = await emailService.sendEmail({
            from: from ?? emailService.FROM_EMAIL,
            to: to ?? thread.participants,
            subject: `Re: ${thread.subject}`,
            body,
          });
          req.log.info({ resendId, threadId }, "Reply sent via Resend");
        } catch (sendErr) {
          req.log.error(sendErr, "Resend delivery failed — reply saved locally only");
        }
      }
    }

    const [msg] = await db
      .insert(emailMessagesTable)
      .values({
        threadId,
        from: from ?? emailService.FROM_EMAIL,
        to: to ?? [],
        cc: cc ?? [],
        body,
        isOutbound: outbound,
        metadata: resendId ? { resendId } : null,
      })
      .returning();

    await db
      .update(emailThreadsTable)
      .set({ lastMessageAt: new Date(), isRead: false })
      .where(eq(emailThreadsTable.id, threadId));

    res.status(201).json(messageToResponse(msg));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

// POST /email/inbound — Resend inbound webhook (set this URL in Resend dashboard)
// Resend posts JSON with: from, to, subject, text, html, headers
router.post("/email/inbound", async (req, res) => {
  try {
    const { from, to, subject, text, html } = req.body;
    if (!from || !subject) return res.status(400).json({ error: "Missing required fields" });

    const toAddresses: string[] = Array.isArray(to) ? to : [to].filter(Boolean);
    const participants = [from, ...toAddresses];

    // Check if a thread with this subject already exists (naive dedup)
    const existing = await db
      .select()
      .from(emailThreadsTable)
      .where(eq(emailThreadsTable.subject, subject))
      .limit(1);

    let threadId: number;

    if (existing.length > 0) {
      threadId = existing[0].id;
    } else {
      const [newThread] = await db
        .insert(emailThreadsTable)
        .values({ subject, participants, isRead: false })
        .returning();
      threadId = newThread.id;
    }

    await db.insert(emailMessagesTable).values({
      threadId,
      from,
      to: toAddresses,
      body: text ?? "",
      bodyHtml: html ?? null,
      isOutbound: false,
      isRead: false,
    });

    await db
      .update(emailThreadsTable)
      .set({ lastMessageAt: new Date(), isRead: false })
      .where(eq(emailThreadsTable.id, threadId));

    req.log.info({ from, subject, threadId }, "Inbound email received");
    res.json({ ok: true, threadId });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to process inbound email" });
  }
});

// POST /email/threads/:id/ai-triage
router.post("/email/threads/:id/ai-triage", async (req, res) => {
  try {
    const [thread] = await db.select().from(emailThreadsTable).where(eq(emailThreadsTable.id, Number(req.params.id)));
    if (!thread) return res.status(404).json({ error: "Not found" });
    const messages = await db.select().from(emailMessagesTable).where(eq(emailMessagesTable.threadId, thread.id)).orderBy(emailMessagesTable.sentAt);

    if (!ai.aiEnabled()) {
      const triage = "High priority — follow up within 24h";
      const summary = `Thread about: ${thread.subject}`;
      await db.update(emailThreadsTable).set({ aiTriage: triage, aiSummary: summary }).where(eq(emailThreadsTable.id, thread.id));
      return res.json({ triage, summary, labels: ["follow-up"] });
    }

    const context = messages.map((m) => `${m.isOutbound ? "Sent" : "Received"}: ${m.body}`).join("\n\n");
    const prompt = `You are an AI email triage assistant for a CRM. Analyze this email thread and respond with JSON only:\n{"triage":"<priority: urgent|high|normal|low>","summary":"<one sentence summary>","labels":["<label1>","<label2>"],"suggestedReply":"<draft reply>"}.\n\nSubject: ${thread.subject}\n\n${context}`;

    const reply = await ai.chat(prompt, []);
    let parsed: any = { triage: "normal", summary: thread.subject, labels: [], suggestedReply: "" };
    try {
      const match = (reply ?? "").match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /**/ }

    await db.update(emailThreadsTable)
      .set({ aiTriage: parsed.triage, aiSummary: parsed.summary, labels: [...new Set([...thread.labels, ...parsed.labels])] })
      .where(eq(emailThreadsTable.id, thread.id));

    res.json(parsed);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to triage email" });
  }
});

// POST /email/threads/:id/ai-draft
router.post("/email/threads/:id/ai-draft", async (req, res) => {
  try {
    const { instruction } = req.body;
    const [thread] = await db.select().from(emailThreadsTable).where(eq(emailThreadsTable.id, Number(req.params.id)));
    if (!thread) return res.status(404).json({ error: "Not found" });

    if (!ai.aiEnabled()) {
      return res.json({ draft: `Thank you for reaching out regarding ${thread.subject}. I'll get back to you shortly.` });
    }

    const messages = await db.select().from(emailMessagesTable).where(eq(emailMessagesTable.threadId, thread.id)).orderBy(emailMessagesTable.sentAt).limit(5);
    const context = messages.map((m) => `${m.isOutbound ? "Sent" : "Received"}: ${m.body}`).join("\n\n");
    const prompt = `Write a professional email reply for: Subject: ${thread.subject}.\n\n${instruction ? `Instruction: ${instruction}\n\n` : ""}Context:\n${context}\n\nReply only with the email body, no subject line.`;
    const draft = await ai.chat(prompt, []);
    res.json({ draft: draft ?? "" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate draft" });
  }
});

export default router;
