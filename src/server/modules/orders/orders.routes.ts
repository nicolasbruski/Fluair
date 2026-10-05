import { Router } from 'express';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import { getRequestId } from '../../middleware/request-context.js';
import { requireAdministrator, requirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import {
  eligibleOrderPriceListsQuerySchema,
  createOrderSchema,
  idempotencyKeySchema,
  orderCatalogQuerySchema,
  orderQuoteSchema,
  orderIdParamsSchema,
  orderSavedCatalogQuerySchema,
  savedCatalogItemParamsSchema,
  updateSavedCatalogItemSchema,
  orderDraftSwapSchema,
  orderDraftSaveSchema,
  deleteOrderDraftQuerySchema,
  orderLastSalePricesSchema,
} from './orders.schemas.js';
import type { OrdersService } from './orders.service.js';

export function createOrdersRouter(auth: AuthService, orders: OrdersService): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get('/price-lists', requirePermission(auth, 'order.access'), async (req, res) => {
    const query = eligibleOrderPriceListsQuerySchema.parse({
      ...req.query,
      quantities: req.query.quantity,
    });
    res.status(200).json(await orders.eligiblePriceLists(query));
  });
  router.get('/saved-catalog', requirePermission(auth, 'price.view'), async (req, res) => {
    res.status(200).json(await orders.savedCatalog(orderSavedCatalogQuerySchema.parse(req.query)));
  });
  router.get(
    '/saved-catalog/kits/:id/composition',
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      const { id } = savedCatalogItemParamsSchema.parse({ kind: 'kits', id: req.params.id });
      res.status(200).json(await orders.savedKitComposition(id));
    },
  );
  router.patch('/saved-catalog/:kind/:id', requireAdministrator(auth), async (req, res) => {
    const params = savedCatalogItemParamsSchema.parse(req.params);
    const input = updateSavedCatalogItemSchema.parse(req.body);
    res.status(200).json(await orders.updateSavedCatalogItem(params, input));
  });
  router.delete('/saved-catalog/:kind/:id', requireAdministrator(auth), async (req, res) => {
    const params = savedCatalogItemParamsSchema.parse(req.params);
    await orders.deleteSavedCatalogItem(params);
    res.status(204).end();
  });
  router.get(
    '/catalog',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      const query = orderCatalogQuerySchema.parse({
        ...req.query,
        quantities: req.query.quantity,
      });
      res.status(200).json(await orders.catalog(query));
    },
  );
  router.get(
    '/draft',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (_req, res) => {
      res.status(200).json(await orders.draft(res.locals.authenticatedUser as AuthenticatedUser));
    },
  );
  router.post(
    '/draft/swap',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      res
        .status(200)
        .json(
          await orders.swapDraft(
            orderDraftSwapSchema.parse(req.body),
            res.locals.authenticatedUser as AuthenticatedUser,
          ),
        );
    },
  );
  router.put(
    '/draft',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      res
        .status(200)
        .json(
          await orders.saveDraft(
            orderDraftSaveSchema.parse(req.body),
            res.locals.authenticatedUser as AuthenticatedUser,
          ),
        );
    },
  );
  router.delete(
    '/draft',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      const { customerId } = deleteOrderDraftQuerySchema.parse(req.query);
      await orders.deleteDraft(customerId, res.locals.authenticatedUser as AuthenticatedUser);
      res.status(204).end();
    },
  );
  router.post(
    '/last-sale-prices',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      res.status(200).json(await orders.lastSalePrices(orderLastSalePricesSchema.parse(req.body)));
    },
  );
  router.post(
    '/quote',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      res
        .status(200)
        .json(
          await orders.quote(
            orderQuoteSchema.parse(req.body),
            res.locals.authenticatedUser as AuthenticatedUser,
          ),
        );
    },
  );
  router.post(
    '/',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      const result = await orders.create(
        createOrderSchema.parse(req.body),
        idempotencyKeySchema.parse(req.header('Idempotency-Key')),
        res.locals.authenticatedUser as AuthenticatedUser,
        getRequestId(req),
      );
      res.status(result.data.replayed ? 200 : 201).json(result);
    },
  );
  router.get(
    '/:id',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      const { id } = orderIdParamsSchema.parse(req.params);
      res
        .status(200)
        .json(await orders.details(id, res.locals.authenticatedUser as AuthenticatedUser));
    },
  );
  return router;
}
