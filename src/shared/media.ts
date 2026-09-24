export const MEDIA_VARIANTS = ['thumb', 'display'] as const;

export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

export interface ImageReference {
  id: string;
  thumbnailUrl: string;
  displayUrl: string;
  width: number;
  height: number;
  updatedAt: string;
}

export type NullableImageReference = ImageReference | null;

export function imageReference(input: {
  id: string;
  width: number;
  height: number;
  createdAt: Date | string;
}): ImageReference {
  const baseUrl = `/api/v1/media/${encodeURIComponent(input.id)}`;
  return {
    id: input.id,
    thumbnailUrl: `${baseUrl}/thumb`,
    displayUrl: `${baseUrl}/display`,
    width: input.width,
    height: input.height,
    updatedAt: input.createdAt instanceof Date ? input.createdAt.toISOString() : input.createdAt,
  };
}
