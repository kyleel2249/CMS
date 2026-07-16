import { Router } from "express";
import multer from "multer";
import zlib from "node:zlib";
import { promisify } from "node:util";
import crypto from "node:crypto";
import sharp from "sharp";
import { db } from "@workspace/db";
import { compressionJobs } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

// ─── Promisified zlib ──────────────────────────────────────────────────────────
const gzip         = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);
const deflate      = promisify(zlib.deflate);

// ─── In-memory store for compressed blobs (keyed by jobId) ───────────────────
const compressedBlobs = new Map<number, { buffer: Buffer; filename: string; mimeType: string }>();

// ─── Multer – memory storage, 200 MB limit ────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

// ─── File-type detection via magic bytes ──────────────────────────────────────
function detectFileType(buf: Buffer, originalName: string): { type: string; mime: string } {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";

  const sig = buf.subarray(0, 12);
  // Images
  if (sig[0] === 0xff && sig[1] === 0xd8)                               return { type: "jpeg", mime: "image/jpeg" };
  if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return { type: "png",  mime: "image/png"  };
  if (sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46)            return { type: "gif",  mime: "image/gif"  };
  if (sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46 && sig[8] === 0x57 && sig[9] === 0x45) return { type: "webp", mime: "image/webp" };
  // PDF
  if (sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46) return { type: "pdf",  mime: "application/pdf" };
  // ZIP-based (docx, xlsx, pptx, zip)
  if (sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04) {
    if (["docx","doc"].includes(ext)) return { type: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (["xlsx","xls"].includes(ext)) return { type: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    if (["pptx","ppt"].includes(ext)) return { type: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    return { type: "zip", mime: "application/zip" };
  }
  // 7z
  if (sig[0] === 0x37 && sig[1] === 0x7a && sig[2] === 0xbc && sig[3] === 0xaf) return { type: "7z", mime: "application/x-7z-compressed" };
  // GZIP
  if (sig[0] === 0x1f && sig[1] === 0x8b)                              return { type: "gz",   mime: "application/gzip" };
  // Video signatures
  if ((sig[4] === 0x66 && sig[5] === 0x74 && sig[6] === 0x79 && sig[7] === 0x70)) return { type: "video", mime: "video/mp4" };
  // Audio
  if (sig[0] === 0x49 && sig[1] === 0x44 && sig[2] === 0x33)           return { type: "mp3",  mime: "audio/mpeg" };
  if (sig[0] === 0x66 && sig[1] === 0x4c && sig[2] === 0x61 && sig[3] === 0x43) return { type: "flac", mime: "audio/flac" };
  if (sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46 && sig[8] === 0x57 && sig[9] === 0x41) return { type: "wav", mime: "audio/wav" };

  // Fallback to extension
  const extMap: Record<string, { type: string; mime: string }> = {
    svg: { type: "svg", mime: "image/svg+xml" }, avif: { type: "avif", mime: "image/avif" },
    json: { type: "json", mime: "application/json" }, xml: { type: "xml", mime: "application/xml" },
    csv: { type: "csv", mime: "text/csv" }, txt: { type: "txt", mime: "text/plain" },
    html: { type: "html", mime: "text/html" }, css: { type: "css", mime: "text/css" },
    js: { type: "js", mime: "application/javascript" }, ts: { type: "ts", mime: "text/typescript" },
    py: { type: "py", mime: "text/x-python" }, rs: { type: "rs", mime: "text/x-rust" },
    go: { type: "go", mime: "text/x-go" }, java: { type: "java", mime: "text/x-java" },
    mp4: { type: "video", mime: "video/mp4" }, mov: { type: "video", mime: "video/quicktime" },
    avi: { type: "video", mime: "video/x-msvideo" }, mkv: { type: "video", mime: "video/x-matroska" },
    webm: { type: "video", mime: "video/webm" }, mp3: { type: "mp3", mime: "audio/mpeg" },
    wav: { type: "wav", mime: "audio/wav" }, flac: { type: "flac", mime: "audio/flac" },
    aac: { type: "aac", mime: "audio/aac" }, ogg: { type: "ogg", mime: "audio/ogg" },
    m4a: { type: "m4a", mime: "audio/mp4" }, bmp: { type: "bmp", mime: "image/bmp" },
    tiff: { type: "tiff", mime: "image/tiff" }, heif: { type: "heif", mime: "image/heif" },
  };
  return extMap[ext] ?? { type: ext || "binary", mime: "application/octet-stream" };
}

// ─── Classify into broad category ────────────────────────────────────────────
function classify(type: string): "image" | "video" | "audio" | "document" | "code" | "archive" | "data" | "binary" {
  if (["jpeg","png","gif","webp","avif","bmp","tiff","heif","svg"].includes(type)) return "image";
  if (["video","mp4","mov","avi","mkv","webm","mpeg","flv","wmv"].includes(type)) return "video";
  if (["mp3","wav","flac","aac","ogg","m4a","aiff"].includes(type)) return "audio";
  if (["pdf","docx","xlsx","pptx","epub"].includes(type)) return "document";
  if (["js","ts","py","rs","go","java","c","cpp","php","ruby","swift","kt","html","css","json","xml","csv","txt"].includes(type)) return "code";
  if (["zip","7z","gz","tar","bz2","rar"].includes(type)) return "archive";
  if (["sqlite","sql"].includes(type)) return "data";
  return "binary";
}

// ─── Entropy analysis ─────────────────────────────────────────────────────────
function analyzeEntropy(buf: Buffer): number {
  const freq = new Array(256).fill(0);
  for (const b of buf) freq[b]++;
  let entropy = 0;
  const len = buf.length;
  for (const f of freq) {
    if (f === 0) continue;
    const p = f / len;
    entropy -= p * Math.log2(p);
  }
  return parseFloat(entropy.toFixed(4));
}

function detectRedundancy(buf: Buffer): number {
  // Sample compression ratio as proxy for redundancy
  const sample = buf.subarray(0, Math.min(buf.length, 65536));
  const compressed = zlib.gzipSync(sample, { level: 1 });
  return parseFloat((1 - compressed.length / sample.length).toFixed(4));
}

// ─── Compression logic ────────────────────────────────────────────────────────
type ImageResult = { result: Buffer; algorithm: string; ext: string; mime: string };

async function compressImage(
  buf: Buffer,
  type: string,
  mode: string,
  quality: number
): Promise<ImageResult> {
  const qualityMap: Record<string, number> = {
    lossless: 100, balanced: 82, smart: 75, fast: 70, ultra: 60,
  };
  const q = quality > 0 ? quality : (qualityMap[mode] ?? 80);

  let pipeline = sharp(buf);
  let algorithm = "";
  let ext = "";
  let mime = "";

  if (type === "png") {
    if (mode === "lossless") {
      pipeline = pipeline.png({ compressionLevel: 9, palette: true });
      algorithm = "PNG + palette optimization (lossless)";
      ext = ".png"; mime = "image/png";
    } else {
      pipeline = pipeline.webp({ quality: q, effort: mode === "ultra" ? 6 : 4 });
      algorithm = `WebP (quality ${q}, effort ${mode === "ultra" ? 6 : 4})`;
      ext = ".webp"; mime = "image/webp";
    }
  } else if (type === "jpeg" || type === "jpg") {
    pipeline = pipeline.jpeg({ quality: q, mozjpeg: true, optimizeCoding: true });
    algorithm = `MozJPEG (quality ${q})`;
    ext = ".jpg"; mime = "image/jpeg";
  } else if (type === "webp") {
    pipeline = pipeline.webp({ quality: q, effort: mode === "ultra" ? 6 : 4 });
    algorithm = `WebP recompression (quality ${q})`;
    ext = ".webp"; mime = "image/webp";
  } else {
    // GIF, BMP, TIFF, HEIF, SVG, RAW and any other image → convert to WebP
    pipeline = pipeline.webp({ quality: q, effort: mode === "ultra" ? 6 : 4 });
    algorithm = `WebP conversion (quality ${q})`;
    ext = ".webp"; mime = "image/webp";
  }

  const result = await pipeline.toBuffer();
  return { result, algorithm, ext, mime };
}

type GeneralResult = { result: Buffer; algorithm: string; format: "gzip" | "brotli" | "deflate"; ext: string; mime: string };

async function compressGeneral(
  buf: Buffer,
  mode: string,
  _category: string
): Promise<GeneralResult> {
  const levelMap: Record<string, number> = { fast: 1, balanced: 6, smart: 7, lossless: 9, ultra: 9 };
  const level = levelMap[mode] ?? 6;

  if (mode === "ultra" || mode === "smart") {
    // Race brotli vs gzip — pick whichever is smaller, report the actual winner
    const [brotliResult, gzipResult] = await Promise.all([
      brotliCompress(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).catch(() => null),
      gzip(buf, { level }),
    ]);
    if (brotliResult && brotliResult.length < (gzipResult?.length ?? Infinity)) {
      return {
        result: brotliResult,
        algorithm: `Brotli (quality 11) — best of 2 algorithms`,
        format: "brotli",
        ext: ".br",
        mime: "application/x-brotli",
      };
    }
    return {
      result: gzipResult,
      algorithm: `GZIP (level ${level}) — best of 2 algorithms`,
      format: "gzip",
      ext: ".gz",
      mime: "application/gzip",
    };
  }

  if (mode === "fast") {
    // deflate is universally decompressible via zlib; serve as gzip for tooling compatibility
    const result = await gzip(buf, { level: 1 });
    return { result, algorithm: "GZIP (level 1, fast)", format: "gzip", ext: ".gz", mime: "application/gzip" };
  }

  // Default: gzip
  const result = await gzip(buf, { level });
  return { result, algorithm: `GZIP (level ${level})`, format: "gzip", ext: ".gz", mime: "application/gzip" };
}

// ─── POST /compression/compress ───────────────────────────────────────────────
router.post("/compression/compress", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { mode = "balanced", quality = "0" } = req.body as { mode: string; quality: string };
  const qualityNum = parseInt(quality, 10) || 0;
  const buf = req.file.buffer;
  const { type, mime } = detectFileType(buf, req.file.originalname);
  const category = classify(type);
  const originalSize = buf.length;
  const entropy = analyzeEntropy(buf);
  const redundancy = detectRedundancy(buf);

  // Insert job as 'processing'
  const [job] = await db.insert(compressionJobs).values({
    filename: req.file.originalname,
    originalSize,
    mode,
    fileType: type,
    mimeType: mime,
    status: "processing",
    quality: qualityNum,
    analysis: { entropy, redundancy, category },
    settings: { mode, quality: qualityNum },
  }).returning();

  const start = Date.now();

  try {
    let result: Buffer;
    let algorithm: string;
    let outMime = mime;

    let outExt = "";
    if (category === "image") {
      const out = await compressImage(buf, type, mode, qualityNum);
      result = out.result;
      algorithm = out.algorithm;
      outMime = out.mime;   // always use the actual output format's MIME (may differ from input)
      outExt  = out.ext;    // always use the actual output format's extension
    } else {
      // Already compressed archives → just store as-is with a note
      if (category === "archive" || type === "gz" || type === "7z") {
        result = buf;
        algorithm = "Already compressed — stored as-is";
      } else {
        const out = await compressGeneral(buf, mode, category);
        result = out.result;
        algorithm = out.algorithm;
        outMime = out.mime;   // use the actual format's MIME (gzip or brotli)
        outExt = out.ext;     // use the actual format's extension (.gz or .br)
      }
    }

    const timeTakenMs = Date.now() - start;
    const compressedSize = result.length;
    const saved = originalSize - compressedSize;
    const savingsPercent = Math.max(0, Math.round((saved / originalSize) * 100));

    // Build output filename using the exact extension matching the compression format
    const outFilename = category === "image"
      ? (outExt
          ? req.file.originalname.replace(/\.[^.]+$/, outExt)   // e.g. photo.png → photo.webp
          : req.file.originalname)                                // lossless PNG stays .png
      : category === "archive"
        ? req.file.originalname                                   // archives pass through unchanged
        : req.file.originalname + outExt;                         // e.g. report.pdf → report.pdf.gz or .br

    compressedBlobs.set(job.id, { buffer: result, filename: outFilename, mimeType: outMime });

    // Update DB
    await db.update(compressionJobs)
      .set({
        status: "done",
        compressedSize,
        algorithm,
        savingsPercent,
        timeTakenMs,
        completedAt: new Date(),
        analysis: { entropy, redundancy, category, sha256: crypto.createHash("sha256").update(result).digest("hex") },
      })
      .where(eq(compressionJobs.id, job.id));

    res.json({
      jobId: job.id,
      filename: req.file.originalname,
      outFilename,
      originalSize,
      compressedSize,
      savingsPercent,
      algorithm,
      timeTakenMs,
      category,
      fileType: type,
      entropy,
      redundancy,
    });
  } catch (err: any) {
    req.log.error(err);
    await db.update(compressionJobs)
      .set({ status: "error", errorMessage: String(err?.message ?? err), completedAt: new Date() })
      .where(eq(compressionJobs.id, job.id));
    res.status(500).json({ error: "Compression failed", details: String(err?.message) });
  }
});

// ─── GET /compression/jobs ────────────────────────────────────────────────────
router.get("/compression/jobs", async (_req, res) => {
  const jobs = await db.select().from(compressionJobs).orderBy(desc(compressionJobs.createdAt)).limit(50);
  res.json(jobs);
});

// ─── GET /compression/download/:id ───────────────────────────────────────────
router.get("/compression/download/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const blob = compressedBlobs.get(id);
  if (!blob) return res.status(404).json({ error: "Not found or expired — re-compress the file" });

  res.setHeader("Content-Disposition", `attachment; filename="${blob.filename}"`);
  res.setHeader("Content-Type", blob.mimeType);
  res.send(blob.buffer);
});

// ─── DELETE /compression/jobs/:id ────────────────────────────────────────────
router.delete("/compression/jobs/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  compressedBlobs.delete(id);
  await db.delete(compressionJobs).where(eq(compressionJobs.id, id));
  res.json({ ok: true });
});

// ─── GET /compression/stats ───────────────────────────────────────────────────
router.get("/compression/stats", async (_req, res) => {
  const jobs = await db.select().from(compressionJobs).orderBy(desc(compressionJobs.createdAt)).limit(200);
  const done = jobs.filter(j => j.status === "done");
  const totalOriginal = done.reduce((s, j) => s + (j.originalSize ?? 0), 0);
  const totalCompressed = done.reduce((s, j) => s + (j.compressedSize ?? 0), 0);
  const saved = totalOriginal - totalCompressed;
  res.json({
    totalJobs: jobs.length,
    completedJobs: done.length,
    totalOriginalBytes: totalOriginal,
    totalCompressedBytes: totalCompressed,
    totalSavedBytes: saved,
    avgSavingsPercent: done.length
      ? Math.round(done.reduce((s, j) => s + (j.savingsPercent ?? 0), 0) / done.length)
      : 0,
  });
});

export default router;
