import { Prisma, type PrismaClient } from '@prisma/client';

import { imageReference, type MediaVariant } from '../../../shared/media.js';
import { AppError } from '../../errors/app-error.js';
import type {
  MediaEntityType,
  MediaMutationContext,
  MediaStore,
  ProcessedMedia,
  StoredMediaVariant,
} from './media.types.js';

type Transaction = Prisma.TransactionClient;

async function currentImageId(
  transaction: Transaction,
  entityType: MediaEntityType,
  entityId: string,
): Promise<string | null | undefined> {
  if (entityType === 'product') {
    return (
      await transaction.product.findUnique({
        where: { id: entityId },
        select: { currentImageId: true },
      })
    )?.currentImageId;
  }
  return (
    await transaction.kit.findUnique({
      where: { id: entityId },
      select: { currentImageId: true },
    })
  )?.currentImageId;
}

async function updateCurrentImage(
  transaction: Transaction,
  entityType: MediaEntityType,
  entityId: string,
  expectedImageId: string | null,
  newImageId: string | null,
): Promise<void> {
  const where = { id: entityId, currentImageId: expectedImageId };
  const result =
    entityType === 'product'
      ? await transaction.product.updateMany({ where, data: { currentImageId: newImageId } })
      : await transaction.kit.updateMany({ where, data: { currentImageId: newImageId } });
  if (result.count !== 1) {
    throw new AppError(
      409,
      'MEDIA_LINK_CONFLICT',
      'A foto foi alterada por outro usuário. Atualize os dados e tente novamente.',
    );
  }
}

async function audit(
  transaction: Transaction,
  entityType: MediaEntityType,
  entityId: string,
  previousAssetId: string | null,
  newAssetId: string | null,
  context: MediaMutationContext,
): Promise<void> {
  const action = newAssetId
    ? previousAssetId
      ? 'MEDIA_REPLACED'
      : 'MEDIA_ADDED'
    : 'MEDIA_REMOVED';
  await transaction.auditLog.create({
    data: {
      actorUserId: context.actorUserId,
      action,
      entityType: entityType.toUpperCase(),
      entityId,
      requestId: context.requestId,
      metadata: {
        previousAssetId,
        newAssetId,
        origin: context.origin,
      },
    },
  });
}

export class PrismaMediaStore implements MediaStore {
  constructor(private readonly prisma: PrismaClient) {}

  async attach(
    entityType: MediaEntityType,
    entityId: string,
    media: ProcessedMedia,
    context: MediaMutationContext,
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        const previousAssetId = await currentImageId(transaction, entityType, entityId);
        if (previousAssetId === undefined) {
          throw new AppError(
            404,
            entityType === 'product' ? 'PRODUCT_NOT_FOUND' : 'KIT_NOT_FOUND',
            entityType === 'product' ? 'Produto não encontrado.' : 'Kit não encontrado.',
          );
        }
        const asset = await transaction.mediaAsset.create({
          data: {
            ...media,
            displayData: Uint8Array.from(media.displayData),
            thumbnailData: Uint8Array.from(media.thumbnailData),
            createdByUserId: context.actorUserId,
          },
          select: { id: true, width: true, height: true, createdAt: true },
        });
        await updateCurrentImage(transaction, entityType, entityId, previousAssetId, asset.id);
        await audit(transaction, entityType, entityId, previousAssetId, asset.id, context);
        return imageReference(asset);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async detach(
    entityType: MediaEntityType,
    entityId: string,
    context: MediaMutationContext,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const previousAssetId = await currentImageId(transaction, entityType, entityId);
        if (previousAssetId === undefined) {
          throw new AppError(
            404,
            entityType === 'product' ? 'PRODUCT_NOT_FOUND' : 'KIT_NOT_FOUND',
            entityType === 'product' ? 'Produto não encontrado.' : 'Kit não encontrado.',
          );
        }
        if (!previousAssetId) return;
        await updateCurrentImage(transaction, entityType, entityId, previousAssetId, null);
        await audit(transaction, entityType, entityId, previousAssetId, null, context);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async readVariant(assetId: string, variant: MediaVariant): Promise<StoredMediaVariant | null> {
    const referenceFilter = {
      OR: [
        { currentForProducts: { some: {} } },
        { currentForKits: { some: {} } },
        { calculationVersions: { some: {} } },
      ],
    };
    if (variant === 'thumb') {
      const asset = await this.prisma.mediaAsset.findFirst({
        where: { id: assetId, ...referenceFilter },
        select: { thumbnailData: true, thumbnailSha256: true, mimeType: true },
      });
      return asset
        ? {
            data: Buffer.from(asset.thumbnailData),
            mimeType: asset.mimeType,
            etag: `"${asset.thumbnailSha256}"`,
          }
        : null;
    }
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: assetId, ...referenceFilter },
      select: { displayData: true, displaySha256: true, mimeType: true },
    });
    return asset
      ? {
          data: Buffer.from(asset.displayData),
          mimeType: asset.mimeType,
          etag: `"${asset.displaySha256}"`,
        }
      : null;
  }
}
