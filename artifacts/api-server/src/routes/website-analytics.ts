import { Router } from "express";
import { db, websiteSessionsTable, websitePageviewsTable, websiteClicksTable, websiteErrorsTable } from "@workspace/db";
import { eq, desc, gte, count, and, sql } from "drizzle-orm";
import * as ai from "../lib/ai";

const router = Router();

// --- Geo cache ---
const geoCache = new Map<string, { data: any; exp: number }>();

async function geolocate(ip: string) {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("192.168") || ip.startsWith("10.") || ip.startsWith("::")) return null;
  const cached = geoCache.get(ip);
  if (cached && cached.exp > Date.now()) return cached.data;
  try {
    const r = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,city,regionName,lat,lon,status`, { signal: AbortSignal.timeout(2000) });
    const d = await r.json() as any;
    if (d.status === "success") {
      const geo = { country: d.country, countryCode: d.countryCode, city: d.city, region: d.regionName, lat: d.lat, lon: d.lon };
      geoCache.set(ip, { data: geo, exp: Date.now() + 3_600_000 });
      return geo;
    }
  } catch {}
  return null;
}

function parseUA(ua: string) {
  const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Other";
  const os = ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "macOS" : ua.includes("Linux") ? "Linux" : ua.includes("Android") ? "Android" : ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : "Other";
  const device = ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone") ? "Mobile" : ua.includes("iPad") || ua.includes("Tablet") ? "Tablet" : "Desktop";
  return { browser, os, device };
}

function clientIp(req: any): string {
  const fwd = req.headers["x-forwarded-for"] as string;
  return (fwd ? fwd.split(",")[0].trim() : req.ip) || "";
}

function since(range = "7d") {
  const ms = range === "30d" ? 30 : range === "90d" ? 90 : 7;
  return new Date(Date.now() - ms * 86_400_000);
}

// POST /website-analytics/track  — ingest events from tracking snippet
router.post("/website-analytics/track", async (req, res) => {
  try {
    const { type, sessionId, url, path, title, referrer, source, medium, campaign, userAgent, screenWidth, screenHeight, language, element, elementText, href, x, y, message, stack, errorType, duration } = req.body;
    if (!sessionId || !type) return res.status(400).json({ error: "missing fields" });

    const ip = clientIp(req);
    const geo = type === "pageview" ? await geolocate(ip) : null;
    const parsed = userAgent ? parseUA(userAgent) : null;

    if (type === "pageview") {
      await db.insert(websitePageviewsTable).values({ sessionId, url: url || "", path: path || "/", title, referrer, source, medium, campaign, userAgent, screenWidth, screenHeight, language });
      const [existing] = await db.select().from(websiteSessionsTable).where(eq(websiteSessionsTable.sessionId, sessionId));
      if (existing) {
        await db.update(websiteSessionsTable).set({ lastSeen: new Date(), pageviews: existing.pageviews + 1, bounced: false }).where(eq(websiteSessionsTable.sessionId, sessionId));
      } else {
        await db.insert(websiteSessionsTable).values({ sessionId, pageviews: 1, country: geo?.country, countryCode: geo?.countryCode, city: geo?.city, region: geo?.region, latitude: geo?.lat, longitude: geo?.lon, source, medium, campaign, ipAddress: ip, device: parsed?.device, browser: parsed?.browser, os: parsed?.os, language }).onConflictDoNothing();
      }
    } else if (type === "click") {
      await db.insert(websiteClicksTable).values({ sessionId, path: path || "/", element, elementText, href, x, y });
    } else if (type === "error") {
      await db.insert(websiteErrorsTable).values({ sessionId, url: url || "", path: path || "/", message: message || "Unknown error", stack, errorType });
    } else if (type === "heartbeat" || type === "leave") {
      if (duration != null) await db.update(websiteSessionsTable).set({ lastSeen: new Date(), duration }).where(eq(websiteSessionsTable.sessionId, sessionId));
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to track" });
  }
});

// GET /website-analytics/summary
router.get("/website-analytics/summary", async (req, res) => {
  try {
    const from = since(req.query.range as string);
    const [visits, views, bounced, rt, errors, avgDur] = await Promise.all([
      db.select({ n: count() }).from(websiteSessionsTable).where(gte(websiteSessionsTable.firstSeen, from)),
      db.select({ n: count() }).from(websitePageviewsTable).where(gte(websitePageviewsTable.createdAt, from)),
      db.select({ n: count() }).from(websiteSessionsTable).where(and(gte(websiteSessionsTable.firstSeen, from), eq(websiteSessionsTable.bounced, true))),
      db.select({ n: count() }).from(websiteSessionsTable).where(gte(websiteSessionsTable.lastSeen, new Date(Date.now() - 5 * 60_000))),
      db.select({ n: count() }).from(websiteErrorsTable).where(gte(websiteErrorsTable.createdAt, from)),
      db.select({ avg: sql<number>`COALESCE(AVG(duration),0)` }).from(websiteSessionsTable).where(and(gte(websiteSessionsTable.firstSeen, from), sql`duration > 0`)),
    ]);
    const total = visits[0]?.n ?? 0;
    res.json({ visits: total, pageviews: views[0]?.n ?? 0, bounceRate: total > 0 ? Math.round(((bounced[0]?.n ?? 0) / total) * 100) : 0, avgDuration: Math.round(avgDur[0]?.avg ?? 0), realtime: rt[0]?.n ?? 0, errors: errors[0]?.n ?? 0 });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /website-analytics/timeseries
router.get("/website-analytics/timeseries", async (req, res) => {
  try {
    const from = since(req.query.range as string);
    const rows = await db.execute(sql`SELECT DATE_TRUNC('day', created_at)::date AS day, COUNT(*) AS visits FROM website_pageviews WHERE created_at >= ${from} GROUP BY 1 ORDER BY 1`);
    res.json(rows.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /website-analytics/pages
router.get("/website-analytics/pages", async (req, res) => {
  try {
    const from = since(req.query.range as string);
    const rows = await db.execute(sql`SELECT path, title, COUNT(*) AS views, COUNT(DISTINCT session_id) AS visitors FROM website_pageviews WHERE created_at >= ${from} GROUP BY path, title ORDER BY views DESC LIMIT 20`);
    res.json(rows.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /website-analytics/sources
router.get("/website-analytics/sources", async (req, res) => {
  try {
    const from = since(req.query.range as string);
    const rows = await db.execute(sql`SELECT COALESCE(source,'Direct') AS source, COUNT(*) AS sessions FROM website_sessions WHERE first_seen >= ${from} GROUP BY source ORDER BY sessions DESC LIMIT 10`);
    res.json(rows.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /website-analytics/countries
router.get("/website-analytics/countries", async (req, res) => {
  try {
    const from = since(req.query.range as string);
    const rows = await db.execute(sql`SELECT COALESCE(country,'Unknown') AS country, country_code AS "countryCode", COUNT(*) AS sessions FROM website_sessions WHERE first_seen >= ${from} GROUP BY country, country_code ORDER BY sessions DESC LIMIT 15`);
    res.json(rows.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /website-analytics/devices
router.get("/website-analytics/devices", async (req, res) => {
  try {
    const from = since(req.query.range as string);
    const [devices, browsers, oss] = await Promise.all([
      db.execute(sql`SELECT COALESCE(device,'Unknown') AS name, COUNT(*) AS count FROM website_sessions WHERE first_seen >= ${from} GROUP BY device ORDER BY count DESC`),
      db.execute(sql`SELECT COALESCE(browser,'Unknown') AS name, COUNT(*) AS count FROM website_sessions WHERE first_seen >= ${from} GROUP BY browser ORDER BY count DESC`),
      db.execute(sql`SELECT COALESCE(os,'Unknown') AS name, COUNT(*) AS count FROM website_sessions WHERE first_seen >= ${from} GROUP BY os ORDER BY count DESC`),
    ]);
    res.json({ devices: devices.rows, browsers: browsers.rows, os: oss.rows });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /website-analytics/clicks
router.get("/website-analytics/clicks", async (req, res) => {
  try {
    const from = since(req.query.range as string);
    const rows = await db.execute(sql`SELECT path, element, element_text AS "elementText", href, COUNT(*) AS clicks FROM website_clicks WHERE created_at >= ${from} GROUP BY path, element, element_text, href ORDER BY clicks DESC LIMIT 20`);
    res.json(rows.rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /website-analytics/errors
router.get("/website-analytics/errors", async (req, res) => {
  try {
    const rows = await db.select().from(websiteErrorsTable).orderBy(desc(websiteErrorsTable.createdAt)).limit(50);
    res.json(rows);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// POST /website-analytics/ai-insights
router.post("/website-analytics/ai-insights", async (req, res) => {
  try {
    const from = since(req.query.range as string);
    const [sessions, errors, pages, sources] = await Promise.all([
      db.select({ n: count() }).from(websiteSessionsTable).where(gte(websiteSessionsTable.firstSeen, from)),
      db.select({ n: count() }).from(websiteErrorsTable).where(gte(websiteErrorsTable.createdAt, from)),
      db.execute(sql`SELECT path, COUNT(*) AS views FROM website_pageviews WHERE created_at >= ${from} GROUP BY path ORDER BY views DESC LIMIT 5`),
      db.execute(sql`SELECT COALESCE(source,'Direct') AS source, COUNT(*) AS sessions FROM website_sessions WHERE first_seen >= ${from} GROUP BY source ORDER BY sessions DESC LIMIT 5`),
    ]);

    const fallback = { overallScore: 72, summary: "Add more traffic to unlock deeper AI insights.", insights: [{ title: "Tag marketing links with UTM parameters", description: "UTM tags let you see exactly which campaigns, ads, and emails drive traffic. Without them, most paid traffic appears as 'Direct'.", priority: "high", category: "marketing" }, { title: "Fix JavaScript errors immediately", description: "Every JS error breaks user experience. Set up alerts so errors are caught before users notice.", priority: "high", category: "performance" }, { title: "Optimize bounce rate on top pages", description: "Add internal links, stronger CTAs, and related content to keep visitors engaged beyond the landing page.", priority: "medium", category: "ux" }, { title: "Write SEO blog content for question-based queries", description: "Use the AI Blogger module to create content answering questions your audience searches for.", priority: "medium", category: "seo" }] };

    if (!ai.aiEnabled()) return res.json(fallback);

    const prompt = `You are a website analytics expert for cintexa.com. Analyze and give JSON improvement suggestions:\n\nVisits: ${sessions[0]?.n}, JS Errors: ${errors[0]?.n}\nTop pages: ${JSON.stringify(pages.rows)}\nTraffic sources: ${JSON.stringify(sources.rows)}\n\nReturn JSON: {"overallScore":0-100,"summary":"one sentence","insights":[{"title":"...","description":"...","priority":"high|medium|low","category":"seo|ux|performance|content|marketing"}]}`;

    const reply = await ai.chat(prompt, []);
    try { const m = (reply ?? "").match(/\{[\s\S]*\}/); if (m) return res.json(JSON.parse(m[0])); } catch {}
    res.json(fallback);
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /website-analytics/script — tracking snippet
router.get("/website-analytics/script", (req, res) => {
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? devDomain ?? "localhost";
  const proto = (req.headers["x-forwarded-proto"] as string) ?? (devDomain ? "https" : "http");
  const trackUrl = `${proto}://${host}/api/website-analytics/track`;

  const snippet = `<!-- CINTEXA NEXUS Analytics — paste before </head> on cintexa.com -->
<script>
(function(){
  var sid=localStorage.getItem('_nx_sid');
  if(!sid){sid=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('_nx_sid',sid);}
  var api='${trackUrl}';var t0=Date.now();var p=new URLSearchParams(location.search);
  function track(type,extra){
    var d=Object.assign({type:type,sessionId:sid,url:location.href,path:location.pathname,
      title:document.title,referrer:document.referrer,
      source:p.get('utm_source'),medium:p.get('utm_medium'),campaign:p.get('utm_campaign'),
      screenWidth:screen.width,screenHeight:screen.height,language:navigator.language,userAgent:navigator.userAgent
    },extra||{});
    var b=JSON.stringify(d);
    navigator.sendBeacon?navigator.sendBeacon(api,b):fetch(api,{method:'POST',body:b,headers:{'Content-Type':'application/json'},keepalive:true});
  }
  track('pageview');
  document.addEventListener('click',function(e){var el=e.target;track('click',{element:el.tagName,elementText:(el.innerText||'').slice(0,100),href:el.href||'',x:e.clientX,y:e.clientY});});
  window.addEventListener('error',function(e){track('error',{message:e.message,stack:(e.error&&e.error.stack)||'',errorType:'js'});});
  document.addEventListener('visibilitychange',function(){if(document.hidden)track('leave',{duration:Math.round((Date.now()-t0)/1000)});});
  setInterval(function(){track('heartbeat',{duration:Math.round((Date.now()-t0)/1000)});},30000);
})();
</script>`;

  res.type("text/plain").send(snippet);
});

export default router;
