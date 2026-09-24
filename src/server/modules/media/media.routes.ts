import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { AuthenticatedUser, PermissionCode } from '../../../shared/auth.js';
import { MEDIA_VARIANTS } from '../../../shared/media.js';
import { AppError } from '../../errors/app-error.js';
import { getRequestId } from '../../middleware/request-context.js';
import { requireAnyPermission, requirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { MEDIA_LIMITS } from './image-processor.js';
import type { MediaService } from './media.service.js';
import type { MediaEntityType } from './media.types.js';

const idSchema = z.string().uuid();
const variantSchema = z.enum(MEDIA_VARIANTS);
const readPermissions: PermissionCode[] = [
  'calculation.view',
  'calculation.create',
  'order.access',
  'price.view',
  'catalog.manage',
];

function upload(req: Request): { data: Buffer; fileName: string; contentType: string } {
  if (!Buffer.isBuffer(req.body)) {
    throw new AppError(400, 'EMPTY_IMAGE', 'Selecione uma imagem válida.');
  }
  let fileName: string;
  try {
    fileName = decodeURIComponent(req.header('x-file-name')?.trim() ?? '');
  } catch {
    throw new AppError(400, 'INVALID_UPLOAD_METADATA', 'O nome do arquivo é inválido.');
  }
  if (!fileName || fileName.length > 500) {
    throw new AppError(400, 'INVALID_UPLOAD_METADATA', 'O nome do arquivo é inválido.');
  }
  return {
    data: req.body,
    fileName,
    contentType: req.header('content-type') ?? 'application/octet-stream',
  };
}

function mutationContext(res: Response, req: Request) {
  const actor = res.locals.authenticatedUser as AuthenticatedUser;
  return { actorUserId: actor.id, requestId: getRequestId(req), origin: 'PRODUCTS' as const };
}

function entityRoutes(
  router: Router,
  auth: AuthService,
  media: MediaService,
  path: string,
  entityType: MediaEntityType,
): void {
  router.put(
    path,
    requirePermission(auth, 'catalog.manage'),
    express.raw({
      // Todo Content-Type é lido sob o mesmo limite; a assinatura real decide o formato aceito.
      type: () => true,
      limit: MEDIA_LIMITS.maximumBytes,
    }),
    async (req, res) => {
      const entityId = idSchema.parse(req.params.id);
      const image = await media.upload(
        entityType,
        entityId,
        upload(req),
        mutationContext(res, req),
      );
      res.status(200).json({ data: { image } });
    },
  );
  router.delete(path, requirePermission(auth, 'catalog.manage'), async (req, res) => {
    const entityId = idSchema.parse(req.params.id);
    await media.remove(entityType, entityId, mutationContext(res, req));
    res.status(204).end();
  });
}

function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  const opaqueTag = (value: string) => value.trim().replace(/^W\//, '');
  return header
    .split(',')
    .some((value) => value.trim() === '*' || opaqueTag(value) === opaqueTag(etag));
}

export function createMediaRouter(auth: AuthService, media: MediaService): Router {
  const router = Router();
  entityRoutes(router, auth, media, '/products/:id', 'product');
  entityRoutes(router, auth, media, '/kits/:id', 'kit');

  router.get(
    '/:id/:variant',
    requireAnyPermission(auth, readPermissions),
    async (req: Request, res: Response) => {
      const assetId = idSchema.parse(req.params.id);
      const variant = variantSchema.parse(req.params.variant);
      const result = await media.read(assetId, variant);
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('ETag', result.etag);
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (etagMatches(req.header('if-none-match'), result.etag)) {
        res.status(304).end();
        return;
      }
      res.status(200).send(result.data);
    },
  );
  return router;
}
