import { Router } from 'express';

import { requireAdministrator, requirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import {
  eligibleOrderPriceListsQuerySchema,
  orderCatalogQuerySchema,
  orderQuoteSchema,
  orderSavedCatalogQuerySchema,
  savedCatalogItemParamsSchema,
  updateSavedCatalogItemSchema,
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
  router.post(
    '/quote',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      res.status(200).json(await orders.quote(orderQuoteSchema.parse(req.body)));
    },
  );
  return router;
}
