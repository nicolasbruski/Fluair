import { Router } from 'express';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import { getRequestId } from '../../middleware/request-context.js';
import { requirePermission } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import {
  cancelOrderPriceApprovalSchema,
  createOrderPriceApprovalSchema,
  adminOrderPriceApprovalsQuerySchema,
  approveOrderPriceApprovalSchema,
  idempotencyKeySchema,
  myOrderPriceApprovalsQuerySchema,
  orderPriceApprovalIdParamsSchema,
  rejectOrderPriceApprovalSchema,
} from './order-price-approvals.schemas.js';
import type { OrderPriceApprovalsService } from './order-price-approvals.service.js';

export function createOrderPriceApprovalsRouter(
  auth: AuthService,
  approvals: OrderPriceApprovalsService,
): Router {
  const router = Router();
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post(
    '/',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    requirePermission(auth, 'price.override'),
    async (req, res) => {
      const result = await approvals.create(
        createOrderPriceApprovalSchema.parse(req.body),
        idempotencyKeySchema.parse(req.header('Idempotency-Key')),
        res.locals.authenticatedUser as AuthenticatedUser,
        getRequestId(req),
      );
      res.status(result.data.replayed ? 200 : 201).json(result);
    },
  );

  router.get(
    '/mine',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      res
        .status(200)
        .json(
          await approvals.mine(
            myOrderPriceApprovalsQuerySchema.parse(req.query),
            res.locals.authenticatedUser as AuthenticatedUser,
            getRequestId(req),
          ),
        );
    },
  );

  router.get(
    '/admin/count',
    requirePermission(auth, 'order.price-approval.manage'),
    async (_req, res) => {
      res.status(200).json(await approvals.adminCount());
    },
  );

  router.get('/admin', requirePermission(auth, 'order.price-approval.manage'), async (req, res) => {
    res
      .status(200)
      .json(
        await approvals.adminList(
          adminOrderPriceApprovalsQuerySchema.parse(req.query),
          getRequestId(req),
        ),
      );
  });

  router.get(
    '/admin/:id',
    requirePermission(auth, 'order.price-approval.manage'),
    async (req, res) => {
      const { id } = orderPriceApprovalIdParamsSchema.parse(req.params);
      res.status(200).json(await approvals.adminDetails(id, getRequestId(req)));
    },
  );

  router.post(
    '/admin/:id/approve',
    requirePermission(auth, 'order.price-approval.manage'),
    async (req, res) => {
      const { id } = orderPriceApprovalIdParamsSchema.parse(req.params);
      res
        .status(200)
        .json(
          await approvals.approve(
            id,
            approveOrderPriceApprovalSchema.parse(req.body),
            res.locals.authenticatedUser as AuthenticatedUser,
            getRequestId(req),
          ),
        );
    },
  );

  router.post(
    '/admin/:id/reject',
    requirePermission(auth, 'order.price-approval.manage'),
    async (req, res) => {
      const { id } = orderPriceApprovalIdParamsSchema.parse(req.params);
      res
        .status(200)
        .json(
          await approvals.reject(
            id,
            rejectOrderPriceApprovalSchema.parse(req.body),
            res.locals.authenticatedUser as AuthenticatedUser,
            getRequestId(req),
          ),
        );
    },
  );

  router.get(
    '/:id',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      const { id } = orderPriceApprovalIdParamsSchema.parse(req.params);
      res
        .status(200)
        .json(
          await approvals.ownDetails(
            id,
            res.locals.authenticatedUser as AuthenticatedUser,
            getRequestId(req),
          ),
        );
    },
  );

  router.post(
    '/:id/cancel',
    requirePermission(auth, 'order.access'),
    requirePermission(auth, 'price.view'),
    async (req, res) => {
      const { id } = orderPriceApprovalIdParamsSchema.parse(req.params);
      res
        .status(200)
        .json(
          await approvals.cancel(
            id,
            cancelOrderPriceApprovalSchema.parse(req.body),
            res.locals.authenticatedUser as AuthenticatedUser,
            getRequestId(req),
          ),
        );
    },
  );

  return router;
}
