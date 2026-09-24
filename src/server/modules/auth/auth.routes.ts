import { Router, type Request, type Response } from 'express';

import type { AppConfig } from '../../config/env.js';
import { getRequestId } from '../../middleware/request-context.js';
import type { AuthService } from './auth.service.js';
import { loginSchema } from './auth.schemas.js';

export const SESSION_COOKIE_NAME = 'fluair_session';

function sessionCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SESSION_COOKIE_NAME];
  return typeof value === 'string' && value.length <= 200 ? value : undefined;
}

function cookieOptions(config: Pick<AppConfig, 'NODE_ENV' | 'SESSION_TTL_HOURS'>) {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: config.SESSION_TTL_HOURS * 60 * 60 * 1_000,
  };
}

export function createAuthRouter(
  auth: AuthService,
  config: Pick<AppConfig, 'NODE_ENV' | 'SESSION_TTL_HOURS'>,
): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  router.post('/login', async (req: Request, res: Response) => {
    const credentials = loginSchema.parse(req.body);
    const result = await auth.login(credentials.email, credentials.password, {
      ipAddress: req.ip ?? req.socket.remoteAddress ?? 'unknown',
      userAgent: req.header('user-agent') ?? null,
      requestId: getRequestId(req),
    });
    res.cookie(SESSION_COOKIE_NAME, result.sessionToken, cookieOptions(config));
    res.status(200).json({
      data: { user: result.user, session: { expiresAt: result.expiresAt.toISOString() } },
    });
  });

  router.post('/logout', async (req: Request, res: Response) => {
    await auth.logout(sessionCookie(req), getRequestId(req));
    res.clearCookie(SESSION_COOKIE_NAME, cookieOptions(config));
    res.status(200).json({ data: { loggedOut: true } });
  });

  router.get('/me', async (req: Request, res: Response) => {
    const session = await auth.getCurrentSession(sessionCookie(req));
    res.status(200).json({
      data: { user: session.user, session: { expiresAt: session.expiresAt.toISOString() } },
    });
  });

  return router;
}
