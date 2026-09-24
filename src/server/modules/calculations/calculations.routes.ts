import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import { getRequestId } from '../../middleware/request-context.js';
import { requirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { spreadsheetUpload } from '../pricing/upload.js';
import { calculationSaveUpload } from './calculation-multipart.js';
import type { CalculationsService } from './calculations.service.js';
import { calculationIdSchema, calculationListQuerySchema } from './calculations.schemas.js';

const priceListIdSchema = z.string().uuid('Lista de preÃ§o invÃ¡lida.');
const saveQuerySchema = z.object({
  recalculate: z.enum(['true', 'false']).transform((value) => value === 'true'),
  customerId: z
    .string({ required_error: 'Selecione um cliente para salvar.' })
    .uuid('Cliente invÃ¡lido.'),
  expectedPriceListVersionId: z.string().uuid('VersÃ£o da lista invÃ¡lida.'),
  expectedKitImageId: z
    .union([z.string().uuid('Imagem atual do kit invÃ¡lida.'), z.literal('')])
    .transform((value) => value || null)
    .optional(),
});

function context(res: Response, req: Request) {
  return {
    actor: res.locals.authenticatedUser as AuthenticatedUser,
    requestId: getRequestId(req),
  };
}

const rawSpreadsheet = express.raw({ type: 'application/octet-stream', limit: '10mb' });
const calculationSaveBody = express.raw({
  type: (req) => {
    const type = req.headers['content-type'] ?? '';
    return /^application\/octet-stream\b/i.test(type) || /^multipart\/form-data\b/i.test(type);
  },
  limit: '16mb',
});

export function createCalculationsRouter(
  auth: AuthService,
  calculations: CalculationsService,
): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get('/', requirePermission(auth, 'calculation.view'), async (req, res) => {
    const query = calculationListQuerySchema.parse(req.query);
    res.status(200).json(await calculations.list(query));
  });
  router.get('/:id/history', requirePermission(auth, 'calculation.history'), async (req, res) => {
    const { id } = calculationIdSchema.parse(req.params);
    res.status(200).json(await calculations.history(id));
  });
  router.get('/:id', requirePermission(auth, 'calculation.view'), async (req, res) => {
    const { id } = calculationIdSchema.parse(req.params);
    res.status(200).json(await calculations.detail(id));
  });
  router.post(
    '/preview/:priceListId',
    requirePermission(auth, 'calculation.create'),
    rawSpreadsheet,
    async (req, res) => {
      const priceListId = priceListIdSchema.parse(req.params.priceListId);
      res.status(200).json(await calculations.preview(priceListId, spreadsheetUpload(req)));
    },
  );
  router.post(
    '/save/:priceListId',
    requirePermission(auth, 'calculation.create'),
    calculationSaveBody,
    async (req, res) => {
      const priceListId = priceListIdSchema.parse(req.params.priceListId);
      const upload = calculationSaveUpload(req);
      const options = saveQuerySchema.parse({ ...req.query, ...upload.fields });
      res
        .status(200)
        .json(
          await calculations.save(
            priceListId,
            upload.spreadsheet,
            { ...options, image: upload.image },
            context(res, req),
          ),
        );
    },
  );
  return router;
}
