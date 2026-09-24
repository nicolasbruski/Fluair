import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const listingModules = [
  '../../src/server/modules/calculations/calculations.service.ts',
  '../../src/server/modules/catalog/catalog.service.ts',
  '../../src/server/modules/orders/orders.service.ts',
  '../../src/server/modules/price-lists/standalone-products.service.ts',
];

describe('seleção Prisma de mídia', () => {
  it('não adiciona blobs às consultas comuns de listagem', async () => {
    for (const modulePath of listingModules) {
      const source = await readFile(new URL(modulePath, import.meta.url), 'utf8');
      expect(source).not.toContain('displayData');
      expect(source).not.toContain('thumbnailData');
    }
  });

  it('seleciona somente o blob da variante pedida no armazenamento', async () => {
    const source = await readFile(
      new URL('../../src/server/modules/media/prisma-media.store.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('select: { thumbnailData: true');
    expect(source).toContain('select: { displayData: true');
    expect(source).not.toContain('include: { currentImage: true');
  });
});
