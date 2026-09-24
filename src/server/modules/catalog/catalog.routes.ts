import { Router } from 'express';

import { requireAnyPermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { catalogQuerySchema } from './catalog.schemas.js';
import type { CatalogService } from './catalog.service.js';

export function createCatalogRouter(auth: AuthService, catalog: CatalogService): Router {
  const router = Router();
  router.get(
    '/',
    requireAnyPermission(auth, ['price.view', 'catalog.manage']),
    async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(await catalog.list(catalogQuerySchema.parse(req.query)));
    },
  );
  return router;
}
