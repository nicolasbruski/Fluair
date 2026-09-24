import type { Prisma } from '@prisma/client';

import type { ProcessedMedia } from './media.types.js';

export async function createMediaAsset(
  transaction: Prisma.TransactionClient,
  media: ProcessedMedia,
  createdByUserId: string,
): Promise<string> {
  const asset = await transaction.mediaAsset.create({
    data: {
      ...media,
      displayData: Uint8Array.from(media.displayData),
      thumbnailData: Uint8Array.from(media.thumbnailData),
      createdByUserId,
    },
    select: { id: true },
  });
  return asset.id;
}
