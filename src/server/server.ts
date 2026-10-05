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
import {
  AllowlistEmailProvider,
  ResendEmailProvider,
  type EmailProvider,
} from './modules/email/email-provider.js';
import { PrismaOrderEmailDeliveryRepository } from './modules/email/order-email-delivery.repository.js';
import { OrderEmailRenderer } from './modules/email/order-email-renderer.js';
import { OrderEmailWorker } from './modules/email/order-email-worker.js';
import { OrdersService } from './modules/orders/orders.service.js';
import { PrismaOrderPriceApprovalsRepository } from './modules/order-price-approvals/order-price-approvals.repository.js';
import { OrderPriceApprovalsService } from './modules/order-price-approvals/order-price-approvals.service.js';
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
  const ordersService = new OrdersService(prisma, {
    quoteTokenSecret: config.SESSION_SECRET,
    ...(config.ORDER_NOTIFICATION_RECIPIENTS
      ? { notificationRecipients: config.ORDER_NOTIFICATION_RECIPIENTS }
      : {}),
    ...(config.EMAIL_FROM ? { emailFrom: config.EMAIL_FROM } : {}),
    ...(config.EMAIL_FROM_NAME ? { emailFromName: config.EMAIL_FROM_NAME } : {}),
    ...(config.EMAIL_REPLY_TO ? { emailReplyTo: config.EMAIL_REPLY_TO } : {}),
  });
  const orderPriceApprovalsService = new OrderPriceApprovalsService(
    new PrismaOrderPriceApprovalsRepository(prisma),
    ordersService,
    {
      approvalValidityDays: config.ORDER_PRICE_APPROVAL_VALIDITY_DAYS ?? 7,
      logger,
    },
  );
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
    orderPriceApprovalsService,
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
  let emailWorker: OrderEmailWorker | null = null;
  if (config.EMAIL_DELIVERY_ENABLED && config.EMAIL_API_KEY) {
    let emailProvider: EmailProvider = new ResendEmailProvider(config.EMAIL_API_KEY);
    if (config.NODE_ENV !== 'production' && config.EMAIL_ALLOWLIST) {
      emailProvider = new AllowlistEmailProvider(config.EMAIL_ALLOWLIST, emailProvider);
    }
    emailWorker = new OrderEmailWorker(
      new PrismaOrderEmailDeliveryRepository(prisma),
      emailProvider,
      new OrderEmailRenderer(),
      logger,
      {
        ...(config.EMAIL_POLL_INTERVAL_MS ? { pollIntervalMs: config.EMAIL_POLL_INTERVAL_MS } : {}),
      },
    );
    emailWorker.start();
    logger.info({ provider: config.EMAIL_PROVIDER }, 'Worker de e-mail iniciado.');
  } else {
    logger.info('Entrega de e-mail desabilitada; pedidos permanecerao pendentes.');
  }

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Encerrando servidor.');
    await emailWorker?.stop();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await prisma.$disconnect();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Falha ao iniciar o servidor.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
