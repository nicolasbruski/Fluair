import { Router, type Request, type Response } from 'express';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import { getRequestId } from '../../middleware/request-context.js';
import { requireAdministrator, requireAnyPermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import {
  createCustomerSchema,
  createCustomerPreRegistrationSchema,
  customerExportQuerySchema,
  customerIdSchema,
  customerListQuerySchema,
  updateCustomerSchema,
} from './customers.schemas.js';
import type { CustomersService } from './customers.service.js';

function context(res: Response, req: Request) {
  return {
    actor: res.locals.authenticatedUser as AuthenticatedUser,
    requestId: getRequestId(req),
  };
}

export function createCustomersRouter(auth: AuthService, customers: CustomersService): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get(
    '/',
    requireAnyPermission(auth, ['customer.view', 'customer.manage']),
    async (req, res) => {
      const query = customerListQuerySchema.parse(req.query);
      res.status(200).json(await customers.list(query));
    },
  );

  router.get(
    '/classifications',
    requireAnyPermission(auth, ['customer.view', 'customer.manage']),
    async (_req, res) => {
      res.status(200).json(await customers.classifications());
    },
  );

  router.get(
    '/export',
    requireAnyPermission(auth, ['customer.view', 'customer.manage']),
    async (req, res) => {
      const query = customerExportQuerySchema.parse(req.query);
      res.status(200).json(await customers.export(query));
    },
  );

  router.get(
    '/:id/calculation-links',
    requireAnyPermission(auth, ['customer.view', 'customer.manage']),
    async (req, res) => {
      const { id } = customerIdSchema.parse(req.params);
      res.status(200).json(await customers.calculationLinks(id));
    },
  );

  router.get(
    '/:id',
    requireAnyPermission(auth, ['customer.view', 'customer.manage']),
    async (req, res) => {
      const { id } = customerIdSchema.parse(req.params);
      res.status(200).json(await customers.get(id));
    },
  );

  router.post('/', requireAdministrator(auth), async (req, res) => {
    const input = createCustomerSchema.parse(req.body);
    res.status(201).json(await customers.create(input, context(res, req)));
  });

  router.post('/pre-registration', requireAdministrator(auth), async (req, res) => {
    const input = createCustomerPreRegistrationSchema.parse(req.body);
    res.status(201).json(await customers.preRegister(input, context(res, req)));
  });

  router.patch('/:id', requireAdministrator(auth), async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    const input = updateCustomerSchema.parse(req.body);
    res.status(200).json(await customers.update(id, input, context(res, req)));
  });

  router.post('/:id/deactivate', requireAdministrator(auth), async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    res.status(200).json(await customers.setActive(id, false, context(res, req)));
  });

  router.post('/:id/activate', requireAdministrator(auth), async (req, res) => {
    const { id } = customerIdSchema.parse(req.params);
    res.status(200).json(await customers.setActive(id, true, context(res, req)));
  });

  return router;
}
