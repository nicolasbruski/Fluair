import { createHash } from 'node:crypto';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
  detectImageFormat,
  MEDIA_LIMITS,
  processImage,
  safeOriginalFileName,
} from '../../src/server/modules/media/image-processor.js';
import { safeImageFixture } from '../fixtures/media.js';

describe('processamento seguro de imagens', () => {
  it('detecta assinaturas JPEG, PNG e WebP sem confiar na extensão', async () => {
    expect(detectImageFormat(await safeImageFixture('jpeg'))).toBe('jpeg');
    expect(detectImageFormat(await safeImageFixture('png'))).toBe('png');
    expect(detectImageFormat(await safeImageFixture('webp'))).toBe('webp');
    expect(detectImageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it('corrige orientação, remove metadados e gera variantes WebP com hashes', async () => {
    const source = await sharp({
      create: { width: 20, height: 30, channels: 3, background: '#336699' },
    })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'não deve permanecer' } } })
      .toBuffer();
    const result = await processImage({
      data: source,
      fileName: '../foto.JPG',
      contentType: 'image/jpeg',
    });

    expect(result.originalFileName).toBe('foto.JPG');
    expect(result.originalMimeType).toBe('image/jpeg');
    expect(result.mimeType).toBe('image/webp');
    expect([result.width, result.height]).toEqual([30, 20]);
    expect(result.thumbnailWidth).toBeLessThanOrEqual(MEDIA_LIMITS.thumbnailMaximumDimension);
    expect(result.sourceSha256).toBe(createHash('sha256').update(source).digest('hex'));
    expect(result.displaySha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.thumbnailSha256).toMatch(/^[a-f0-9]{64}$/);
    expect((await sharp(result.displayData).metadata()).exif).toBeUndefined();
  });

  it('limita dimensões da exibição sem ampliar imagens pequenas', async () => {
    const source = await safeImageFixture('png', 2_000, 1_000);
    const result = await processImage({
      data: source,
      fileName: 'foto.png',
      contentType: 'image/png',
    });
    expect([result.width, result.height]).toEqual([1_600, 800]);
    expect([result.thumbnailWidth, result.thumbnailHeight]).toEqual([320, 160]);
  });

  it.each([
    [
      'SVG',
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      'foto.svg',
      'image/svg+xml',
      'IMAGE_FORMAT_NOT_ALLOWED',
    ],
    [
      'arquivo falso',
      Buffer.from('isto não é uma imagem'),
      'foto.png',
      'image/png',
      'IMAGE_FORMAT_NOT_ALLOWED',
    ],
    [
      'JPEG corrompido',
      Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]),
      'foto.jpg',
      'image/jpeg',
      'IMAGE_DECODE_FAILED',
    ],
  ])('recusa %s', async (_label, data, fileName, contentType, code) => {
    await expect(processImage({ data, fileName, contentType })).rejects.toMatchObject({ code });
  });

  it('recusa extensão incompatível com a assinatura', async () => {
    await expect(
      processImage({
        data: await safeImageFixture('png'),
        fileName: 'foto.jpg',
        contentType: 'image/png',
      }),
    ).rejects.toMatchObject({ code: 'IMAGE_EXTENSION_MISMATCH' });
  });

  it('recusa entrada acima de 12 megapixels antes da normalização', async () => {
    const source = await safeImageFixture('png', 4_000, 4_000);
    await expect(
      processImage({ data: source, fileName: 'grande.png', contentType: 'image/png' }),
    ).rejects.toMatchObject({ code: 'IMAGE_PIXEL_LIMIT_EXCEEDED' });
  });

  it('sanitiza nomes enviados sem usá-los como caminho', () => {
    expect(safeOriginalFileName('..\\pasta\\foto.png\u0000')).toBe('foto.png');
  });
});
