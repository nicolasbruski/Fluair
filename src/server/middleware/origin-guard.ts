import type { NextFunction, Request, Response } from 'express';

import type { AppConfig } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function createOriginGuard(config: Pick<AppConfig, 'APP_URL' | 'NODE_ENV'>) {
  const allowedUrl = new URL(config.APP_URL);
  const allowedOrigin = allowedUrl.origin;

  const isAllowedDevelopmentOrigin = (origin: string): boolean => {
    if (config.NODE_ENV !== 'development') return false;
    try {
      const originUrl = new URL(origin);
      return (
        originUrl.protocol === allowedUrl.protocol && originUrl.hostname === allowedUrl.hostname
      );
    } catch {
      return false;
    }
  };

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (safeMethods.has(req.method)) {
      next();
      return;
    }

    const origin = req.header('origin');
    const fetchSite = req.header('sec-fetch-site');
    const hasAllowedOrigin =
      origin === allowedOrigin || Boolean(origin && isAllowedDevelopmentOrigin(origin));
    const isOriginlessSameOriginFetch = !origin && fetchSite === 'same-origin';

    if (fetchSite === 'cross-site' || (!hasAllowedOrigin && !isOriginlessSameOriginFetch)) {
      next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'A origem da requisição não é permitida.'));
      return;
    }

    next();
  };
}
