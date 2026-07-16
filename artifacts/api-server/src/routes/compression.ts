import { Router } from "express";
import multer from "multer";
import zlib from "node:zlib";
import { promisify } from "node:util";
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import { db } from "@workspace/db";
import { compressionJobs } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

// ─── Promisified zlib ──────────────────────────────────────────────────────────
const gzip          = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);

// ─── Disk blob store — survives server restarts ───────────────────────────────
const BLOB_DIR = path.join(os.tmpdir(), "nexus-compression");
fs.mkdirSync(BLOB_DIR, { recursive: true });

async function writeBlobToDisk(jobId: number, buf: Buffer, filename: string): Promise<string> {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
  const filePath = path.join(BLOB_DIR, `${jobId}_${safe}`);
  await fsp.writeFile(filePath, buf);
  return filePath;
}

async function cleanupOldBlobs() {
  try {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 h
    const entries = await fsp.readdir(BLOB_DIR);
    await Promise.all(
      entries.map(async (e) => {
        const p = path.join(BLOB_DIR, e);
        const stat = await fsp.stat(p).catch(() => null);
        if (stat && stat.mtimeMs < cutoff) await fsp.unlink(p).catch(() => {});
      })
    );
  } catch { /* non-fatal */ }
}
// Run cleanup once at startup
cleanupOldBlobs();

// ─── Multer — memory storage, 500 MB limit ────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

// ─── File-type detection via magic bytes ──────────────────────────────────────
function detectFileType(buf: Buffer, originalName: string): { type: string; mime: string } {
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
  const sig = buf.subarray(0, 12);

  // Images
  if (sig[0] === 0xff && sig[1] === 0xd8)                                           return { type: "jpeg", mime: "image/jpeg" };
  if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47)    return { type: "png",  mime: "image/png"  };
  if (sig[0] === 0x47 && sig[1] === 0x49 && sig[2] === 0x46)                        return { type: "gif",  mime: "image/gif"  };
  if (sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46 &&
      sig[8] === 0x57 && sig[9] === 0x45)                                            return { type: "webp", mime: "image/webp" };
  // PDF
  if (sig[0] === 0x25 && sig[1] === 0x50 && sig[2] === 0x44 && sig[3] === 0x46)    return { type: "pdf",  mime: "application/pdf" };
  // ZIP-based
  if (sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04) {
    if (["docx","doc"].includes(ext))   return { type: "docx",  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (["xlsx","xls"].includes(ext))   return { type: "xlsx",  mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    if (["pptx","ppt"].includes(ext))   return { type: "pptx",  mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    return { type: "zip", mime: "application/zip" };
  }
  // 7z
  if (sig[0] === 0x37 && sig[1] === 0x7a && sig[2] === 0xbc && sig[3] === 0xaf)    return { type: "7z", mime: "application/x-7z-compressed" };
  // GZIP
  if (sig[0] === 0x1f && sig[1] === 0x8b)                                           return { type: "gz",  mime: "application/gzip" };
  // MP4/MOV/video container (ftyp box)
  if (sig[4] === 0x66 && sig[5] === 0x74 && sig[6] === 0x79 && sig[7] === 0x70)    return { type: "video", mime: "video/mp4" };
  // Audio magic bytes
  if (sig[0] === 0x49 && sig[1] === 0x44 && sig[2] === 0x33)                        return { type: "mp3",  mime: "audio/mpeg" };
  if (sig[0] === 0xff && (sig[1] & 0xe0) === 0xe0)                                  return { type: "mp3",  mime: "audio/mpeg" };
  if (sig[0] === 0x66 && sig[1] === 0x4c && sig[2] === 0x61 && sig[3] === 0x43)    return { type: "flac", mime: "audio/flac" };
  if (sig[0] === 0x52 && sig[1] === 0x49 && sig[2] === 0x46 && sig[3] === 0x46 &&
      sig[8] === 0x57 && sig[9] === 0x41)                                            return { type: "wav",  mime: "audio/wav"  };

  // Extension fallback
  const extMap: Record<string, { type: string; mime: string }> = {
    svg:  { type: "svg",   mime: "image/svg+xml" },
    avif: { type: "avif",  mime: "image/avif" },
    bmp:  { type: "bmp",   mime: "image/bmp" },
    tiff: { type: "tiff",  mime: "image/tiff" },
    heif: { type: "heif",  mime: "image/heif" },
    json: { type: "json",  mime: "application/json" },
    xml:  { type: "xml",   mime: "application/xml" },
    csv:  { type: "csv",   mime: "text/csv" },
    txt:  { type: "txt",   mime: "text/plain" },
    html: { type: "html",  mime: "text/html" },
    css:  { type: "css",   mime: "text/css" },
    js:   { type: "js",    mime: "application/javascript" },
    ts:   { type: "ts",    mime: "text/typescript" },
    py:   { type: "py",    mime: "text/x-python" },
    rs:   { type: "rs",    mime: "text/x-rust" },
    go:   { type: "go",    mime: "text/x-go" },
    java: { type: "java",  mime: "text/x-java" },
    mp4:  { type: "video", mime: "video/mp4" },
    mov:  { type: "video", mime: "video/quicktime" },
    avi:  { type: "video", mime: "video/x-msvideo" },
    mkv:  { type: "video", mime: "video/x-matroska" },
    webm: { type: "video", mime: "video/webm" },
    wmv:  { type: "video", mime: "video/x-ms-wmv" },
    flv:  { type: "video", mime: "video/x-flv" },
    mpeg: { type: "video", mime: "video/mpeg" },
    mp3:  { type: "mp3",   mime: "audio/mpeg" },
    wav:  { type: "wav",   mime: "audio/wav" },
    flac: { type: "flac",  mime: "audio/flac" },
    aac:  { type: "aac",   mime: "audio/aac" },
    ogg:  { type: "ogg",   mime: "audio/ogg" },
    m4a:  { type: "m4a",   mime: "audio/mp4" },
    aiff: { type: "aiff",  mime: "audio/aiff" },
  };
  return extMap[ext] ?? { type: ext || "binary", mime: "application/octet-stream" };
}

// ─── Category classifier ──────────────────────────────────────────────────────
function classify(type: string): "image" | "video" | "audio" | "document" | "code" | "archive" | "data" | "binary" {
  if (["jpeg","png","gif","webp","avif","bmp","tiff","heif","svg"].includes(type))         return "image";
  if (["video","mp4","mov","avi","mkv","webm","mpeg","flv","wmv"].includes(type))          return "video";
  if (["mp3","wav","flac","aac","ogg","m4a","aiff"].includes(type))                        return "audio";
  if (["pdf","docx","xlsx","pptx","epub"].includes(type))                                  return "document";
  if (["js","ts","py","rs","go","java","c","cpp","php","html","css","json","xml","csv","txt"].includes(type)) return "code";
  if (["zip","7z","gz","tar","bz2","rar"].includes(type))                                  return "archive";
  if (["sqlite","sql"].includes(type))                                                     return "data";
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
  const sample = buf.subarray(0, Math.min(buf.length, 65536));
  const compressed = zlib.gzipSync(sample, { level: 1 });
  return parseFloat((1 - compressed.length / sample.length).toFixed(4));
}

// ─── Image compression (Sharp) ────────────────────────────────────────────────
type CompressResult = { result: Buffer; algorithm: string; ext: string; mime: string };

async function compressImage(buf: Buffer, type: string, mode: string, quality: number): Promise<CompressResult> {
  const qualityMap: Record<string, number> = { lossless: 100, balanced: 82, smart: 75, fast: 70, ultra: 60, maximum: 40 };
  const q = quality > 0 ? quality : (qualityMap[mode] ?? 80);
  let pipeline = sharp(buf);
  let algorithm = "", ext = "", mime = "";

  // Maximum mode → AVIF (best-in-class perceptual compression, up to 98% smaller than raw PNG)
  if (mode === "maximum") {
    pipeline = pipeline.avif({ quality: q, effort: 9 });
    algorithm = `AVIF (quality ${q}, effort 9) — perceptual max compression`;
    ext = ".avif"; mime = "image/avif";
  } else if (type === "png") {
    if (mode === "lossless") {
      pipeline = pipeline.png({ compressionLevel: 9, palette: true });
      algorithm = "PNG + palette optimization (lossless)"; ext = ".png"; mime = "image/png";
    } else {
      pipeline = pipeline.webp({ quality: q, effort: mode === "ultra" ? 6 : 4 });
      algorithm = `WebP (quality ${q})`; ext = ".webp"; mime = "image/webp";
    }
  } else if (type === "jpeg" || type === "jpg") {
    pipeline = pipeline.jpeg({ quality: q, mozjpeg: true, optimizeCoding: true });
    algorithm = `MozJPEG (quality ${q})`; ext = ".jpg"; mime = "image/jpeg";
  } else if (type === "webp") {
    pipeline = pipeline.webp({ quality: q, effort: mode === "ultra" ? 6 : 4 });
    algorithm = `WebP recompression (quality ${q})`; ext = ".webp"; mime = "image/webp";
  } else {
    // GIF, BMP, TIFF, HEIF, SVG, RAW → WebP
    pipeline = pipeline.webp({ quality: q, effort: mode === "ultra" ? 6 : 4 });
    algorithm = `WebP conversion from ${type} (quality ${q})`; ext = ".webp"; mime = "image/webp";
  }

  const result = await pipeline.toBuffer();
  return { result, algorithm, ext, mime };
}

// ─── Video compression (FFmpeg) ───────────────────────────────────────────────
async function compressVideo(buf: Buffer, origName: string, mode: string): Promise<CompressResult> {
  const inExt  = path.extname(origName).replace(".", "") || "mp4";
  const tmpIn  = path.join(os.tmpdir(), `nxv-in-${Date.now()}.${inExt}`);
  const tmpOut = path.join(os.tmpdir(), `nxv-out-${Date.now()}.mp4`);

  const modeConfig: Record<string, { codec: string; crf: number; preset: string }> = {
    lossless: { codec: "libx264", crf: 18, preset: "slow"      },
    smart:    { codec: "libx264", crf: 26, preset: "medium"    },
    balanced: { codec: "libx264", crf: 28, preset: "medium"    },
    fast:     { codec: "libx264", crf: 30, preset: "ultrafast" },
    ultra:    { codec: "libx265", crf: 28, preset: "medium"    },
    maximum:  { codec: "libx265", crf: 32, preset: "slow"      },
  };
  const { codec, crf, preset } = modeConfig[mode] ?? modeConfig.balanced;

  try {
    await fsp.writeFile(tmpIn, buf);
    await new Promise<void>((resolve, reject) => {
      const extraOpts = codec === "libx265" ? ["-tag:v", "hvc1"] : [];
      ffmpeg(tmpIn)
        .videoCodec(codec)
        .audioCodec("aac").audioBitrate("128k")
        .outputOptions(["-crf", String(crf), "-preset", preset, "-movflags", "+faststart", ...extraOpts])
        .on("end", resolve)
        .on("error", reject)
        .save(tmpOut);
    });
    const result = await fsp.readFile(tmpOut);
    const label = codec === "libx265" ? "H.265/HEVC" : "H.264";
    return { result, algorithm: `${label} CRF ${crf} (${preset}) + AAC 128k`, ext: ".mp4", mime: "video/mp4" };
  } finally {
    await Promise.all([fsp.unlink(tmpIn).catch(() => {}), fsp.unlink(tmpOut).catch(() => {})]);
  }
}

// ─── Audio compression (FFmpeg) ───────────────────────────────────────────────
async function compressAudio(buf: Buffer, origName: string, mode: string): Promise<CompressResult> {
  const inExt = path.extname(origName).replace(".", "") || "mp3";
  const tmpIn  = path.join(os.tmpdir(), `nxa-in-${Date.now()}.${inExt}`);

  type AudioConfig = { codec: string; bitrate: string; outExt: string; mime: string; label: string };
  const modeConfig: Record<string, AudioConfig> = {
    lossless: { codec: "flac",     bitrate: "",      outExt: "flac", mime: "audio/flac",     label: "FLAC (lossless)"     },
    ultra:    { codec: "libopus",  bitrate: "64k",   outExt: "opus", mime: "audio/ogg",      label: "Opus 64k"            },
    maximum:  { codec: "libopus",  bitrate: "48k",   outExt: "opus", mime: "audio/ogg",      label: "Opus 48k (maximum)"  },
    smart:    { codec: "aac",      bitrate: "96k",   outExt: "m4a",  mime: "audio/mp4",      label: "AAC 96k"             },
    fast:     { codec: "aac",      bitrate: "64k",   outExt: "m4a",  mime: "audio/mp4",      label: "AAC 64k"             },
    balanced: { codec: "aac",      bitrate: "128k",  outExt: "m4a",  mime: "audio/mp4",      label: "AAC 128k"            },
  };
  const cfg = modeConfig[mode] ?? modeConfig.balanced;
  const tmpOut = path.join(os.tmpdir(), `nxa-out-${Date.now()}.${cfg.outExt}`);

  try {
    await fsp.writeFile(tmpIn, buf);
    await new Promise<void>((resolve, reject) => {
      let cmd = ffmpeg(tmpIn).audioCodec(cfg.codec).noVideo();
      if (cfg.bitrate) cmd = cmd.audioBitrate(cfg.bitrate);
      cmd.on("end", resolve).on("error", reject).save(tmpOut);
    });
    const result = await fsp.readFile(tmpOut);
    return { result, algorithm: cfg.label, ext: `.${cfg.outExt}`, mime: cfg.mime };
  } finally {
    await Promise.all([fsp.unlink(tmpIn).catch(() => {}), fsp.unlink(tmpOut).catch(() => {})]);
  }
}

// ─── General compression (GZIP / Brotli) ─────────────────────────────────────
async function compressGeneral(buf: Buffer, mode: string): Promise<CompressResult> {
  const levelMap: Record<string, number> = { fast: 1, balanced: 6, smart: 7, lossless: 9, ultra: 9, maximum: 9 };
  const level = levelMap[mode] ?? 6;

  if (mode === "ultra" || mode === "smart" || mode === "maximum") {
    const [br, gz] = await Promise.all([
      brotliCompress(buf, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).catch(() => null),
      gzip(buf, { level }),
    ]);
    if (br && br.length < (gz?.length ?? Infinity)) {
      return { result: br, algorithm: "Brotli (quality 11) — best of 2 algorithms", ext: ".br", mime: "application/x-brotli" };
    }
    return { result: gz, algorithm: `GZIP (level ${level}) — best of 2 algorithms`, ext: ".gz", mime: "application/gzip" };
  }

  const result = await gzip(buf, { level: mode === "fast" ? 1 : level });
  return { result, algorithm: `GZIP (level ${mode === "fast" ? 1 : level})`, ext: ".gz", mime: "application/gzip" };
}

// ─── POST /compression/compress ───────────────────────────────────────────────
router.post("/compression/compress", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const { mode = "balanced", quality = "0" } = req.body as { mode: string; quality: string };
  const qualityNum  = parseInt(quality, 10) || 0;
  const buf         = req.file.buffer;
  const { type, mime } = detectFileType(buf, req.file.originalname);
  const category    = classify(type);
  const originalSize = buf.length;
  const entropy     = analyzeEntropy(buf);
  const redundancy  = detectRedundancy(buf);

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
    let out: CompressResult;

    if (category === "image") {
      out = await compressImage(buf, type, mode, qualityNum);
    } else if (category === "video") {
      out = await compressVideo(buf, req.file.originalname, mode);
    } else if (category === "audio") {
      out = await compressAudio(buf, req.file.originalname, mode);
    } else if (category === "archive") {
      out = { result: buf, algorithm: "Already compressed — stored as-is", ext: path.extname(req.file.originalname) || "", mime };
    } else {
      out = await compressGeneral(buf, mode);
    }

    const timeTakenMs   = Date.now() - start;
    const compressedSize = out.result.length;
    const savingsPercent = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

    // Build output filename from actual format ext
    const baseName  = req.file.originalname.replace(/\.[^.]+$/, "");
    const outFilename = category === "image" || category === "video" || category === "audio"
      ? `${baseName}${out.ext}`
      : category === "archive"
        ? req.file.originalname
        : req.file.originalname + out.ext;

    // Persist to disk — survives restarts
    const outputPath = await writeBlobToDisk(job.id, out.result, outFilename);

    await db.update(compressionJobs).set({
      status: "done",
      compressedSize,
      algorithm: out.algorithm,
      savingsPercent,
      timeTakenMs,
      outputPath,
      completedAt: new Date(),
      analysis: {
        entropy, redundancy, category,
        sha256: crypto.createHash("sha256").update(out.result).digest("hex"),
      },
    }).where(eq(compressionJobs.id, job.id));

    res.json({
      jobId: job.id, filename: req.file.originalname, outFilename,
      originalSize, compressedSize, savingsPercent, algorithm: out.algorithm,
      timeTakenMs, category, fileType: type, entropy, redundancy,
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
router.get("/compression/download/:id", async (req, res) => {
  const id  = parseInt(req.params.id, 10);
  const [job] = await db.select().from(compressionJobs).where(eq(compressionJobs.id, id));
  if (!job || !job.outputPath) return res.status(404).json({ error: "Not found — re-compress the file" });

  const buf = await fsp.readFile(job.outputPath).catch(() => null);
  if (!buf) return res.status(404).json({ error: "File missing from disk — re-compress the file" });

  const filename = path.basename(job.outputPath).replace(/^\d+_/, "");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", job.mimeType ?? "application/octet-stream");
  res.send(buf);
});

// ─── DELETE /compression/jobs/:id ────────────────────────────────────────────
router.delete("/compression/jobs/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [job] = await db.select({ outputPath: compressionJobs.outputPath })
    .from(compressionJobs).where(eq(compressionJobs.id, id));
  if (job?.outputPath) await fsp.unlink(job.outputPath).catch(() => {});
  await db.delete(compressionJobs).where(eq(compressionJobs.id, id));
  res.json({ ok: true });
});

// ─── GET /compression/stats ───────────────────────────────────────────────────
router.get("/compression/stats", async (_req, res) => {
  const jobs = await db.select().from(compressionJobs).orderBy(desc(compressionJobs.createdAt)).limit(200);
  const done = jobs.filter(j => j.status === "done");
  const totalOriginal   = done.reduce((s, j) => s + (j.originalSize ?? 0), 0);
  const totalCompressed = done.reduce((s, j) => s + (j.compressedSize ?? 0), 0);
  res.json({
    totalJobs: jobs.length,
    completedJobs: done.length,
    totalOriginalBytes: totalOriginal,
    totalCompressedBytes: totalCompressed,
    totalSavedBytes: totalOriginal - totalCompressed,
    avgSavingsPercent: done.length
      ? Math.round(done.reduce((s, j) => s + (j.savingsPercent ?? 0), 0) / done.length)
      : 0,
  });
});

export default router;
