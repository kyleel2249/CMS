import { Router } from "express";
import { detectAnomalies } from "../lib/ai";

const router = Router();

let cache: { data: Awaited<ReturnType<typeof detectAnomalies>>; ts: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

router.get("/anomalies", async (req, res) => {
  try {
    const force = req.query.force === "true";
    if (!force && cache && Date.now() - cache.ts < CACHE_TTL) {
      return res.json({ anomalies: cache.data, cachedAt: new Date(cache.ts).toISOString(), fresh: false });
    }
    const anomalies = await detectAnomalies();
    cache = { data: anomalies, ts: Date.now() };
    res.json({ anomalies, cachedAt: new Date(cache.ts).toISOString(), fresh: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to detect anomalies" });
  }
});

router.post("/anomalies/scan", async (req, res) => {
  try {
    const anomalies = await detectAnomalies();
    cache = { data: anomalies, ts: Date.now() };
    res.json({ anomalies, cachedAt: new Date(cache.ts).toISOString(), fresh: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to run anomaly scan" });
  }
});

export default router;
