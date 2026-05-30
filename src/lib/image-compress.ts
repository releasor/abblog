import sharp from "sharp";

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: "webp" | "jpeg" | "png";
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 80,
  format: "webp",
};

export async function compressImage(
  inputBuffer: Buffer,
  options: CompressOptions = {}
): Promise<{ buffer: Buffer; format: string }> {
  const opts = { ...DEFAULTS, ...options };

  const pipeline = sharp(inputBuffer)
    .resize(opts.maxWidth, opts.maxHeight, {
      fit: "inside",
      withoutEnlargement: true,
    });

  let outputBuffer: Buffer;
  let outputFormat: string;

  switch (opts.format) {
    case "webp":
      outputBuffer = await pipeline.webp({ quality: opts.quality }).toBuffer();
      outputFormat = "webp";
      break;
    case "jpeg":
      outputBuffer = await pipeline.jpeg({ quality: opts.quality }).toBuffer();
      outputFormat = "jpeg";
      break;
    case "png":
      outputBuffer = await pipeline.png({ quality: opts.quality }).toBuffer();
      outputFormat = "png";
      break;
  }

  return { buffer: outputBuffer, format: outputFormat };
}

export function shouldCompress(mimeType: string): boolean {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
}

export function getCompressFormat(mimeType: string): "webp" | "jpeg" | "png" {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpeg";
  return "webp";
}
