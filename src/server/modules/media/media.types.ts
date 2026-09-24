import type { ImageReference, MediaVariant } from '../../../shared/media.js';

export type MediaEntityType = 'product' | 'kit';

export interface ProcessedMedia {
  originalFileName: string;
  originalMimeType: string;
  mimeType: 'image/webp';
  sourceSize: number;
  sourceSha256: string;
  width: number;
  height: number;
  displaySize: number;
  displaySha256: string;
  displayData: Buffer;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailSize: number;
  thumbnailSha256: string;
  thumbnailData: Buffer;
}

export interface MediaMutationContext {
  actorUserId: string;
  requestId: string;
  origin: 'PRODUCTS' | 'CALCULATION';
}

export interface StoredMediaVariant {
  data: Buffer;
  mimeType: string;
  etag: string;
}

export interface MediaStore {
  attach(
    entityType: MediaEntityType,
    entityId: string,
    media: ProcessedMedia,
    context: MediaMutationContext,
  ): Promise<ImageReference>;
  detach(
    entityType: MediaEntityType,
    entityId: string,
    context: MediaMutationContext,
  ): Promise<void>;
  readVariant(assetId: string, variant: MediaVariant): Promise<StoredMediaVariant | null>;
}
