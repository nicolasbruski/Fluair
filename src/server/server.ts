import { randomBytes } from 'node:crypto';

import { createApp } from './app.js';
import { config } from './config/env.js';
import { createLogger } from './config/logger.js';
import { prisma } from './database/prisma.js';
import { AuthService, authServiceConfig } from './modules/auth/auth.service.js';
import { passwordService } from './modules/auth/password.service.js';
import { PrismaAuthRepository } from './modules/auth/prisma-auth.repository.js';
import { CatalogService } from './modules/catalog/catalog.service.js';
import { CalculationsService } from './modules/calculations/calculations.service.js';
import { CustomersService } from './modules/customers/customers.service.js';
import { PrismaCustomersRepository } from './modules/customers/prisma-customers.repository.js';
import { OrdersService } from './modules/orders/orders.service.js';
import { MediaService } from './modules/media/media.service.js';
import { PrismaMediaStore } from './modules/media/prisma-media.store.js';
import { PrismaPriceListsRepository } from './modules/price-lists/prisma-price-lists.repository.js';
import { PriceListsService } from './modules/price-lists/price-lists.service.js';
import { StandaloneProductsService } from './modules/price-lists/standalone-products.service.js';
import { PrismaUsersRepository } from './modules/users/prisma-users.repository.js';
import { UsersService } from './modules/users/users.service.js';

const logger = createLogger(config);

async function start(): Promise<void> {
  const dummyPasswordHash = await passwordService.hash(randomBytes(32).toString('base64url'));
  const authService = new AuthService(
    new PrismaAuthRepository(prisma),
    passwordService,
    authServiceConfig(config, dummyPasswordHash),
  );
  const customersService = new CustomersService(new PrismaCustomersRepository(prisma));
  const catalogService = new CatalogService(prisma);
  const ordersService = new OrdersService(prisma);
  const priceListsService = new PriceListsService(new PrismaPriceListsRepository(prisma));
  const standaloneProductsService = new StandaloneProductsService(prisma);
  const calculationsService = new CalculationsService(prisma);
  const usersService = new UsersService(new PrismaUsersRepository(prisma), passwordService);
  const mediaService = new MediaService(new PrismaMediaStore(prisma));
  const app = createApp({
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
    serveWeb: config.NODE_ENV === 'production',
  });
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'Servidor Fluair iniciado.');
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Encerrando servidor.');
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Falha ao iniciar o servidor.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
