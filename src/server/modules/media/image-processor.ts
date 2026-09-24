import { createHash } from 'node:crypto';
import path from 'node:path';

import sharp from 'sharp';

import { AppError } from '../../errors/app-error.js';
import type { ProcessedMedia } from './media.types.js';

export const MEDIA_LIMITS = {
  maximumBytes: 5 * 1024 * 1024,
  maximumPixels: 12_000_000,
  displayMaximumDimension: 1_600,
  thumbnailMaximumDimension: 320,
} as const;

type AcceptedFormat = 'jpeg' | 'png' | 'webp';

const formatMimeTypes: Record<AcceptedFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

const extensions: Record<AcceptedFormat, string[]> = {
  jpeg: ['.jpg', '.jpeg'],
  png: ['.png'],
  webp: ['.webp'],
};

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function detectImageFormat(data: Buffer): AcceptedFormat | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'jpeg';
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

export function safeOriginalFileName(value: string): string {
  const name = [...path.basename(value.replaceAll('\\', '/'))]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join('');
  return (name || 'imagem').slice(0, 255);
}

function validateDeclaredType(format: AcceptedFormat, fileName: string, contentType: string): void {
  const extension = path.extname(fileName).toLocaleLowerCase('en-US');
  if (!extensions[format].includes(extension)) {
    throw new AppError(
      400,
      'IMAGE_EXTENSION_MISMATCH',
      'O conteúdo da imagem não corresponde à extensão do arquivo.',
    );
  }
  const normalizedContentType = contentType.split(';', 1)[0]?.trim().toLocaleLowerCase('en-US');
  if (
    normalizedContentType &&
    normalizedContentType !== 'application/octet-stream' &&
    normalizedContentType !== formatMimeTypes[format]
  ) {
    throw new AppError(
      400,
      'IMAGE_CONTENT_TYPE_MISMATCH',
      'O conteúdo da imagem não corresponde ao tipo informado.',
    );
  }
}

async function variantMetadata(data: Buffer): Promise<{ width: number; height: number }> {
  const metadata = await sharp(data).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Dimensões processadas ausentes.');
  return { width: metadata.width, height: metadata.height };
}

export async function processImage(input: {
  data: Buffer;
  fileName: string;
  contentType: string;
}): Promise<ProcessedMedia> {
  if (input.data.length === 0) {
    throw new AppError(400, 'EMPTY_IMAGE', 'Selecione uma imagem válida.');
  }
  if (input.data.length > MEDIA_LIMITS.maximumBytes) {
    throw new AppError(413, 'IMAGE_TOO_LARGE', 'A imagem deve ter no máximo 5 MB.');
  }

  const format = detectImageFormat(input.data);
  if (!format) {
    throw new AppError(415, 'IMAGE_FORMAT_NOT_ALLOWED', 'Envie uma imagem JPEG, PNG ou WebP.');
  }
  const fileName = safeOriginalFileName(input.fileName);
  validateDeclaredType(format, fileName, input.contentType);

  try {
    const metadata = await sharp(input.data, {
      failOn: 'error',
      limitInputPixels: false,
    }).metadata();
    if (!metadata.width || !metadata.height) throw new Error('Dimensões ausentes.');
    if (metadata.width * metadata.height > MEDIA_LIMITS.maximumPixels) {
      throw new AppError(
        413,
        'IMAGE_PIXEL_LIMIT_EXCEEDED',
        'A imagem deve ter no máximo 12 megapixels.',
      );
    }

    const normalized = sharp(input.data, {
      failOn: 'error',
      limitInputPixels: MEDIA_LIMITS.maximumPixels,
    }).rotate();
    const [displayData, thumbnailData] = await Promise.all([
      normalized
        .clone()
        .resize({
          width: MEDIA_LIMITS.displayMaximumDimension,
          height: MEDIA_LIMITS.displayMaximumDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer(),
      normalized
        .clone()
        .resize({
          width: MEDIA_LIMITS.thumbnailMaximumDimension,
          height: MEDIA_LIMITS.thumbnailMaximumDimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 76, effort: 4 })
        .toBuffer(),
    ]);
    const [display, thumbnail] = await Promise.all([
      variantMetadata(displayData),
      variantMetadata(thumbnailData),
    ]);

    return {
      originalFileName: fileName,
      originalMimeType: formatMimeTypes[format],
      mimeType: 'image/webp',
      sourceSize: input.data.length,
      sourceSha256: sha256(input.data),
      width: display.width,
      height: display.height,
      displaySize: displayData.length,
      displaySha256: sha256(displayData),
      displayData,
      thumbnailWidth: thumbnail.width,
      thumbnailHeight: thumbnail.height,
      thumbnailSize: thumbnailData.length,
      thumbnailSha256: sha256(thumbnailData),
      thumbnailData,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'IMAGE_DECODE_FAILED', 'A imagem está corrompida ou é inválida.');
  }
}
