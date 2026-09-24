import express, { Router, type Request, type Response } from 'express';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import { getRequestId } from '../../middleware/request-context.js';
import { requireAnyPermission, requirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { spreadsheetUpload } from '../pricing/upload.js';
import {
  activeVersionSchema,
  createPriceListSchema,
  expectedFileHashSchema,
  priceListIdSchema,
  priceListStructureQuerySchema,
  standaloneProductParamsSchema,
  standaloneProductsQuerySchema,
  updatePriceListSchema,
} from './price-lists.schemas.js';
import type { PriceListsService } from './price-lists.service.js';
import type { StandaloneProductsService } from './standalone-products.service.js';

function context(res: Response, req: Request) {
  return {
    actor: res.locals.authenticatedUser as AuthenticatedUser,
    requestId: getRequestId(req),
  };
}

export function createPriceListsRouter(
  auth: AuthService,
  priceLists: PriceListsService,
  standaloneProducts?: StandaloneProductsService,
): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get('/', requireAnyPermission(auth, ['matrix.view', 'matrix.manage']), async (_req, res) =>
    res.status(200).json(await priceLists.list()),
  );
  router.post('/', requirePermission(auth, 'matrix.manage'), async (req, res) => {
    res
      .status(201)
      .json(await priceLists.create(createPriceListSchema.parse(req.body), context(res, req)));
  });
  router.post(
    '/:id/import/preview',
    requirePermission(auth, 'matrix.manage'),
    express.raw({ type: 'application/octet-stream', limit: '10mb' }),
    async (req, res) => {
      const { id } = priceListIdSchema.parse(req.params);
      res.status(200).json(await priceLists.previewImport(id, spreadsheetUpload(req)));
    },
  );
  router.get(
    '/:id/active-version/structure',
    requirePermission(auth, 'matrix.manage'),
    async (req, res) => {
      const { id } = priceListIdSchema.parse(req.params);
      const query = priceListStructureQuerySchema.parse(req.query);
      res.status(200).json(await priceLists.structure(id, query));
    },
  );
  router.post(
    '/:id/import/confirm',
    requirePermission(auth, 'matrix.manage'),
    express.raw({ type: 'application/octet-stream', limit: '10mb' }),
    async (req, res) => {
      const { id } = priceListIdSchema.parse(req.params);
      const expectedFileHash = expectedFileHashSchema.parse(req.header('x-expected-file-hash'));
      res
        .status(201)
        .json(
          await priceLists.confirmImport(
            id,
            expectedFileHash,
            spreadsheetUpload(req),
            context(res, req),
          ),
        );
    },
  );
  if (standaloneProducts) {
    router.get('/:id/products', requirePermission(auth, 'price.view'), async (req, res) => {
      const { id } = priceListIdSchema.parse(req.params);
      const query = standaloneProductsQuerySchema.parse(req.query);
      res.status(200).json(await standaloneProducts.list(id, query));
    });
    router.get(
      '/:id/products/:code/price',
      requirePermission(auth, 'price.view'),
      async (req, res) => {
        const { id, code } = standaloneProductParamsSchema.parse(req.params);
        res.status(200).json(await standaloneProducts.price(id, code));
      },
    );
  }
  router.patch('/:id', requirePermission(auth, 'matrix.manage'), async (req, res) => {
    const { id } = priceListIdSchema.parse(req.params);
    res
      .status(200)
      .json(await priceLists.update(id, updatePriceListSchema.parse(req.body), context(res, req)));
  });
  router.post('/:id/activate', requirePermission(auth, 'matrix.manage'), async (req, res) => {
    const { id } = priceListIdSchema.parse(req.params);
    res.status(200).json(await priceLists.setActive(id, true, context(res, req)));
  });
  router.post('/:id/deactivate', requirePermission(auth, 'matrix.manage'), async (req, res) => {
    const { id } = priceListIdSchema.parse(req.params);
    res.status(200).json(await priceLists.setActive(id, false, context(res, req)));
  });
  router.put('/:id/active-version', requirePermission(auth, 'matrix.manage'), async (req, res) => {
    const { id } = priceListIdSchema.parse(req.params);
    const { versionId } = activeVersionSchema.parse(req.body);
    res.status(200).json(await priceLists.setActiveVersion(id, versionId, context(res, req)));
  });

  return router;
}
