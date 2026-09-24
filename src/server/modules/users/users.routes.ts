import { Router, type Request, type Response } from 'express';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import { getRequestId } from '../../middleware/request-context.js';
import { requireAnyPermission, requirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { createUserSchema, updateUserSchema, userIdSchema } from './users.schemas.js';
import type { UsersService } from './users.service.js';

function context(res: Response, req: Request) {
  return {
    actor: res.locals.authenticatedUser as AuthenticatedUser,
    requestId: getRequestId(req),
  };
}

export function createUsersRouter(auth: AuthService, users: UsersService): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.get(
    '/',
    requireAnyPermission(auth, ['user.view', 'user.manage']),
    async (_req: Request, res: Response) => {
      res.status(200).json(await users.list());
    },
  );

  router.post('/', requirePermission(auth, 'user.manage'), async (req: Request, res: Response) => {
    const input = createUserSchema.parse(req.body);
    const user = await users.create(input, context(res, req));
    res.status(201).json({ data: { user } });
  });

  router.patch(
    '/:id',
    requirePermission(auth, 'user.manage'),
    async (req: Request, res: Response) => {
      const { id } = userIdSchema.parse(req.params);
      const input = updateUserSchema.parse(req.body);
      const user = await users.update(id, input, context(res, req));
      res.status(200).json({ data: { user } });
    },
  );

  router.post(
    '/:id/deactivate',
    requirePermission(auth, 'user.manage'),
    async (req: Request, res: Response) => {
      const { id } = userIdSchema.parse(req.params);
      const user = await users.setActive(id, false, context(res, req));
      res.status(200).json({ data: { user } });
    },
  );

  router.post(
    '/:id/activate',
    requirePermission(auth, 'user.manage'),
    async (req: Request, res: Response) => {
      const { id } = userIdSchema.parse(req.params);
      const user = await users.setActive(id, true, context(res, req));
      res.status(200).json({ data: { user } });
    },
  );

  return router;
}
