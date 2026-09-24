import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { PermissionCode } from '../../../shared/auth.js';
import { getRequestId } from '../../middleware/request-context.js';
import type { AuthService } from './auth.service.js';
import { SESSION_COOKIE_NAME } from './auth.routes.js';

function token(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length <= 200 ? value : undefined;
}

export function requireAuthentication(auth: AuthService): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const session = await auth.getCurrentSession(token(req));
    res.locals.authenticatedUser = session.user;
    next();
  };
}

export function requirePermission(auth: AuthService, permission: PermissionCode): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.locals.authenticatedUser = await auth.requirePermission(
      token(req),
      permission,
      getRequestId(req),
    );
    next();
  };
}

export function requireAnyPermission(
  auth: AuthService,
  permissions: PermissionCode[],
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.locals.authenticatedUser = await auth.requireAnyPermission(
      token(req),
      permissions,
      getRequestId(req),
    );
    next();
  };
}

export function requireAdministrator(auth: AuthService): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.locals.authenticatedUser = await auth.requireAdministrator(token(req), getRequestId(req));
    next();
  };
}
