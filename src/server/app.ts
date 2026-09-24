import path from 'node:path';

import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';

import type { AppConfig } from './config/env.js';
import { AppError } from './errors/app-error.js';
import { errorHandler, notFound } from './middleware/error-handler.js';
import { createOriginGuard } from './middleware/origin-guard.js';
import { getRequestId, requestContext } from './middleware/request-context.js';
import type { AuthService } from './modules/auth/auth.service.js';
import { createCatalogRouter } from './modules/catalog/catalog.routes.js';
import type { CatalogService } from './modules/catalog/catalog.service.js';
import { createAuthRouter, SESSION_COOKIE_NAME } from './modules/auth/auth.routes.js';
import { createCalculationsRouter } from './modules/calculations/calculations.routes.js';
import type { CalculationsService } from './modules/calculations/calculations.service.js';
import { createCommissionsRouter } from './modules/commissions/commissions.routes.js';
import { createCustomersRouter } from './modules/customers/customers.routes.js';
import type { CustomersService } from './modules/customers/customers.service.js';
import { createOrdersRouter } from './modules/orders/orders.routes.js';
import type { OrdersService } from './modules/orders/orders.service.js';
import { createMediaRouter } from './modules/media/media.routes.js';
import type { MediaService } from './modules/media/media.service.js';
import { createPriceListsRouter } from './modules/price-lists/price-lists.routes.js';
import type { PriceListsService } from './modules/price-lists/price-lists.service.js';
import type { StandaloneProductsService } from './modules/price-lists/standalone-products.service.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import type { UsersService } from './modules/users/users.service.js';

export interface AppDependencies {
  config: AppConfig;
  logger: Logger;
  authService: AuthService;
  catalogService?: CatalogService;
  customersService?: CustomersService;
  ordersService?: OrdersService;
  priceListsService?: PriceListsService;
  standaloneProductsService?: StandaloneProductsService;
  calculationsService?: CalculationsService;
  mediaService?: MediaService;
  usersService?: UsersService;
  serveWeb?: boolean;
}

export function createApp({
  config,
  logger,
  authService,
  catalogService,
  customersService,
  ordersService,
  priceListsService,
  standaloneProductsService,
  calculationsService,
  mediaService,
  usersService,
  serveWeb = false,
}: AppDependencies): Express {
  const app = express();
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => getRequestId(req),
      redact: ['req.headers.cookie', 'req.body', 'res.headers.set-cookie'],
    }),
  );
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      hsts: config.NODE_ENV === 'production',
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdnjs.cloudflare.com',
            'https://cdn.jsdelivr.net',
          ],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          connectSrc: ["'self'"],
          // A SPA usa blob: somente para a prévia local da foto antes do upload.
          imgSrc: ["'self'", 'data:', 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null,
        },
      },
    }),
  );
  app.use(createOriginGuard(config));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());

  const commissionsDirectory = path.resolve(
    process.cwd(),
    serveWeb ? 'dist/private/comissoes' : 'Comissoes',
  );
  const requireCommissionPageAccess = async (req: express.Request, res: express.Response) => {
    const cookie: unknown = req.cookies?.[SESSION_COOKIE_NAME];
    const sessionToken = typeof cookie === 'string' && cookie.length <= 200 ? cookie : undefined;
    try {
      await authService.requirePermission(sessionToken, 'commission.access', getRequestId(req));
    } catch (error) {
      if (error instanceof AppError && error.status === 401) {
        res.redirect(302, `/login?returnTo=${encodeURIComponent('/comissoes')}`);
        return false;
      }
      if (error instanceof AppError && error.status === 403) {
        res.redirect(302, '/sem-acesso');
        return false;
      }
      throw error;
    }
    return true;
  };

  app.get(['/comissoes', '/comissoes/'], async (req, res) => {
    if (!(await requireCommissionPageAccess(req, res))) return;
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(commissionsDirectory, 'sistema_comissao_v3.html'));
  });
  app.get('/comissoes/imagem/Logo.jpg', async (req, res) => {
    if (!(await requireCommissionPageAccess(req, res))) return;
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(path.join(commissionsDirectory, 'imagem', 'Logo.jpg'));
  });

  app.use('/api/v1/auth', createAuthRouter(authService, config));
  if (catalogService) app.use('/api/v1/catalog', createCatalogRouter(authService, catalogService));
  if (customersService) {
    app.use('/api/v1/customers', createCustomersRouter(authService, customersService));
    app.use('/api/v1/commissions', createCommissionsRouter(authService, customersService));
  }
  if (usersService) app.use('/api/v1/users', createUsersRouter(authService, usersService));
  if (ordersService) app.use('/api/v1/orders', createOrdersRouter(authService, ordersService));
  if (priceListsService)
    app.use(
      '/api/v1/price-lists',
      createPriceListsRouter(authService, priceListsService, standaloneProductsService),
    );
  if (calculationsService) {
    app.use('/api/v1/calculations', createCalculationsRouter(authService, calculationsService));
  }
  if (mediaService) app.use('/api/v1/media', createMediaRouter(authService, mediaService));
  app.use('/api/v1', notFound());

  if (serveWeb) {
    const webDirectory = path.resolve(process.cwd(), 'dist/web');
    app.use(express.static(webDirectory, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || !req.accepts('html')) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(webDirectory, 'index.html'));
    });
  } else {
    app.use(notFound());
  }

  app.use(errorHandler(logger));
  return app;
}
