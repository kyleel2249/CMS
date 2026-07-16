import { Router } from "express";
import * as ai from "../lib/ai";

const router = Router();

const STYLES: Record<string, string> = {
  realistic: "photorealistic, professional photography, ultra detailed, 8k resolution",
  illustration: "digital illustration, flat design, vector art, colorful, clean",
  watercolor: "watercolor painting, soft colors, artistic brush strokes, beautiful",
  cyberpunk: "cyberpunk aesthetic, neon lights, futuristic city, dark atmosphere, sci-fi",
  minimalist: "minimalist design, clean, simple, white background, modern, elegant",
  "3d-render": "3D render, octane render, ray tracing, subsurface scattering, detailed",
  anime: "anime style, Japanese animation, manga art, vibrant colors, detailed",
  sketch: "pencil sketch, hand-drawn illustration, black and white, artistic detail",
  cinematic: "cinematic photography, dramatic lighting, movie still, anamorphic lens",
  "logo-design": "professional logo design, vector, brand identity, clean, scalable",
  "social-media": "social media graphic, vibrant, eye-catching, modern typography",
  "product-photo": "product photography, white background, studio lighting, commercial quality",
};

// POST /visuals/generate
router.post("/visuals/generate", async (req, res) => {
  try {
    const { prompt, style = "realistic", width = 1024, height = 1024, enhance = true } = req.body;
    if (!prompt?.trim()) return res.status(400).json({ error: "prompt required" });

    let finalPrompt = prompt.trim();

    if (enhance && ai.aiEnabled()) {
      const enhanced = await ai.chat(
        `You are a professional AI image prompt engineer. Enhance this prompt to produce a stunning, detailed image. Add visual details, lighting, composition, and style descriptors. Keep under 200 words. Return ONLY the enhanced prompt text, nothing else.\n\nPrompt: ${prompt}`,
        []
      );
      if (enhanced?.trim()) finalPrompt = enhanced.trim();
    }

    const styleTag = STYLES[style] || STYLES.realistic;
    const fullPrompt = `${finalPrompt}, ${styleTag}`;
    const seed = Math.floor(Math.random() * 9_999_999);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&nologo=true&enhance=false&seed=${seed}`;

    res.json({ imageUrl, originalPrompt: prompt, enhancedPrompt: finalPrompt, fullPrompt, style, width, height, seed });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Generation failed" }); }
});

// POST /visuals/enhance-prompt
router.post("/visuals/enhance-prompt", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });
    if (!ai.aiEnabled()) return res.json({ enhanced: prompt });
    const enhanced = await ai.chat(
      `Enhance this AI image generation prompt. Add visual details, mood, lighting, and composition. Return ONLY the enhanced prompt, max 150 words.\n\nOriginal: ${prompt}`,
      []
    );
    res.json({ enhanced: enhanced?.trim() || prompt });
  } catch (err) { req.log.error(err); res.status(500).json({ error: "Failed" }); }
});

// GET /visuals/styles
router.get("/visuals/styles", (_req, res) => {
  res.json(Object.entries(STYLES).map(([id, desc]) => ({
    id,
    label: id.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" "),
    description: desc.split(",")[0],
  })));
});

export default router;
