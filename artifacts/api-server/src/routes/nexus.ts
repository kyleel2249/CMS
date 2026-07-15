/**
 * NEXUS AI Routes — Full Intelligence API
 *
 * POST /nexus/chat          — multi-expert + web search copilot
 * POST /nexus/generate-image — AI image generation (Pollinations)
 * POST /nexus/generate-document — document/file creation
 * GET  /nexus/experts       — list all 60+ expert agents (Domain, AI Employees, Platform, Capabilities)
 * GET  /nexus/memory        — retrieve AI memory
 * DELETE /nexus/memory/:id  — forget a memory item
 * GET  /nexus/files         — all generated files/images
 * POST /nexus/learn         — trigger continuous learning from activity
 * GET  /nexus/stream        — SSE streaming chat endpoint
 */

import { Router } from "express";
import * as nexus from "../lib/nexus-ai";
import type { ExpertId } from "../lib/nexus-ai";

const router = Router();

// ── Status ────────────────────────────────────────────────────────────────────
router.get("/nexus/status", (_req, res) => {
  res.json({ enabled: nexus.aiEnabled(), experts: nexus.EXPERTS.length, version: "2.0" });
});

// ── Experts list ──────────────────────────────────────────────────────────────
router.get("/nexus/experts", (_req, res) => {
  res.json(nexus.EXPERTS.map(e => ({
    id: e.id, name: e.name, icon: e.icon, color: e.color, specialty: e.specialty,
    category: (e as any).category ?? "Domain Experts",
  })));
});

// ── Main Chat ─────────────────────────────────────────────────────────────────
router.post("/nexus/chat", async (req, res) => {
  try {
    const {
      message, history, sessionId, useWebSearch,
      requestedExperts, generateImage, generateDocument,
    } = req.body;

    if (!message) return res.status(400).json({ error: "message is required" });

    if (!nexus.aiEnabled()) {
      return res.json({
        synthesis: "NEXUS AI requires an OpenRouter API key to activate. Add OPENROUTER_API_KEY to your environment secrets to unlock all 18 expert agents, web search, image generation, and continuous learning.",
        expertResponses: [],
        webSearchUsed: false,
        memoriesSaved: 0,
        suggestedPrompts: ["How do I set up NEXUS AI?", "What can NEXUS AI do?"],
        enabled: false,
      });
    }

    const result = await nexus.nexusChat({
      message,
      history: history ?? [],
      sessionId: sessionId ?? `session-${Date.now()}`,
      useWebSearch: Boolean(useWebSearch),
      requestedExperts: requestedExperts as ExpertId[],
      generateImage: Boolean(generateImage),
      generateDocument,
    });

    return res.json({ ...result, enabled: true });
  } catch (err) {
    req.log.error({ err }, "nexus chat error");
    return res.status(500).json({ error: "NEXUS AI unavailable" });
  }
});

// ── Image Generation ──────────────────────────────────────────────────────────
router.post("/nexus/generate-image", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt is required" });

    const result = await nexus.createImage(prompt);
    if (!result) return res.status(503).json({ error: "Image generation failed" });

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "image generation error");
    return res.status(500).json({ error: "Image generation failed" });
  }
});

// ── Document Generation ───────────────────────────────────────────────────────
router.post("/nexus/generate-document", async (req, res) => {
  try {
    const { topic, type = "markdown", content, customData } = req.body;
    if (!topic) return res.status(400).json({ error: "topic is required" });

    const result = await nexus.createDocument({ type, topic, content, customData });
    if (!result) return res.status(503).json({ error: "Document generation failed" });

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "document generation error");
    return res.status(500).json({ error: "Document generation failed" });
  }
});

// ── Download generated document ───────────────────────────────────────────────
router.post("/nexus/download", async (req, res) => {
  try {
    const { content, filename, mimeType } = req.body;
    if (!content || !filename) return res.status(400).json({ error: "content and filename required" });

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", mimeType ?? "text/plain");
    return res.send(content);
  } catch (err) {
    req.log.error({ err }, "download error");
    return res.status(500).json({ error: "Download failed" });
  }
});

// ── Memory ────────────────────────────────────────────────────────────────────
router.get("/nexus/memory", async (req, res) => {
  try {
    const { q } = req.query;
    const memories = q
      ? await nexus.searchMemories(String(q))
      : await nexus.getMemories(50);
    return res.json({ memories, total: memories.length });
  } catch (err) {
    req.log.error({ err }, "memory fetch error");
    return res.status(500).json({ error: "Failed to fetch memory" });
  }
});

router.delete("/nexus/memory/:id", async (req, res) => {
  try {
    await nexus.deleteMemory(Number(req.params.id));
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "memory delete error");
    return res.status(500).json({ error: "Failed to delete memory" });
  }
});

router.post("/nexus/memory", async (req, res) => {
  try {
    const { key, value, memoryType, source, tags } = req.body;
    if (!key || !value) return res.status(400).json({ error: "key and value required" });
    const mem = await nexus.saveMemory({ key, value, memoryType, source, tags });
    return res.json(mem);
  } catch (err) {
    req.log.error({ err }, "memory save error");
    return res.status(500).json({ error: "Failed to save memory" });
  }
});

// ── Generated Files ───────────────────────────────────────────────────────────
router.get("/nexus/files", async (req, res) => {
  try {
    const files = await nexus.getGeneratedFiles(30);
    return res.json({ files });
  } catch (err) {
    req.log.error({ err }, "files fetch error");
    return res.status(500).json({ error: "Failed to fetch files" });
  }
});

// ── Continuous Learning ───────────────────────────────────────────────────────
router.post("/nexus/learn", async (req, res) => {
  try {
    const saved = await nexus.learnFromActivity();
    return res.json({ memoriesSaved: saved, message: `NEXUS learned ${saved} new facts from recent activity.` });
  } catch (err) {
    req.log.error({ err }, "learning error");
    return res.status(500).json({ error: "Learning failed" });
  }
});

// ── Single Expert Query ───────────────────────────────────────────────────────
router.post("/nexus/expert/:id", async (req, res) => {
  try {
    const { message } = req.body;
    const expertId = req.params.id as ExpertId;

    if (!nexus.EXPERTS.find(e => e.id === expertId)) {
      return res.status(404).json({ error: "Expert not found" });
    }

    if (!nexus.aiEnabled()) {
      return res.status(400).json({ error: "AI not configured" });
    }

    const snapshot = { note: "business data available in full chat endpoint" };
    const result = await nexus.runExpert(expertId, message, snapshot, "");
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "expert query error");
    return res.status(500).json({ error: "Expert unavailable" });
  }
});

export default router;
