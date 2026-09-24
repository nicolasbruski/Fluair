import sharp from 'sharp';

export type SafeImageFixtureFormat = 'jpeg' | 'png' | 'webp';

/**
 * Gera uma imagem mínima, determinística e sem metadados pessoais para testes.
 * Manter a fixture em memória evita versionar fotos reais ou dados comerciais.
 */
export async function safeImageFixture(
  format: SafeImageFixtureFormat,
  width = 24,
  height = 12,
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 20, g: 100, b: 180, alpha: 0.8 } },
  })
    .toFormat(format)
    .toBuffer();
}
