import { Router, type Request, type Response } from 'express';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import { getRequestId } from '../../middleware/request-context.js';
import { requirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { createCustomerSchema, customerIdSchema } from '../customers/customers.schemas.js';
import type { CustomersService } from '../customers/customers.service.js';

function context(res: Response, req: Request) {
  return {
    actor: res.locals.authenticatedUser as AuthenticatedUser,
    requestId: getRequestId(req),
  };
}

export function createCommissionsRouter(auth: AuthService, customers: CustomersService): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.use(requirePermission(auth, 'commission.access'));

  router.get('/customers', async (_req, res) => {
    res.status(200).json(await customers.export({ status: 'active' }));
  });

  router.post('/customers', async (req, res) => {
    const input = createCustomerSchema.parse(req.body);
    res.status(201).json(await customers.create(input, context(res, req)));
  });

  router.post('/customers/:id/deactivate', async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    res.status(200).json(await customers.setActive(id, false, context(res, req)));
  });

  return router;
}
