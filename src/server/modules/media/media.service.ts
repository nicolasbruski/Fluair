import type { MediaVariant } from '../../../shared/media.js';
import { AppError } from '../../errors/app-error.js';
import { processImage } from './image-processor.js';
import type {
  MediaEntityType,
  MediaMutationContext,
  MediaStore,
  StoredMediaVariant,
} from './media.types.js';

export class MediaService {
  constructor(private readonly store: MediaStore) {}

  async upload(
    entityType: MediaEntityType,
    entityId: string,
    upload: { data: Buffer; fileName: string; contentType: string },
    context: MediaMutationContext,
  ) {
    const media = await processImage(upload);
    return this.store.attach(entityType, entityId, media, context);
  }

  async remove(
    entityType: MediaEntityType,
    entityId: string,
    context: MediaMutationContext,
  ): Promise<void> {
    await this.store.detach(entityType, entityId, context);
  }

  async read(assetId: string, variant: MediaVariant): Promise<StoredMediaVariant> {
    const media = await this.store.readVariant(assetId, variant);
    if (!media) throw new AppError(404, 'MEDIA_NOT_FOUND', 'Imagem não encontrada.');
    return media;
  }
}
