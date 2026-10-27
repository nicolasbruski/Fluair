import { config } from '../config/env.js';
import { createLogger } from '../config/logger.js';
import { prisma } from '../database/prisma.js';
import { ResendEmailProvider } from '../modules/email/email-provider.js';
import { PrismaOrderEmailDeliveryRepository } from '../modules/email/order-email-delivery.repository.js';
import { OrderEmailRenderer } from '../modules/email/order-email-renderer.js';
import { OrderEmailWorker } from '../modules/email/order-email-worker.js';

const MAX_DELIVERIES_PER_RUN = 100;

async function main(): Promise<void> {
  if (!config.EMAIL_DELIVERY_ENABLED || !config.EMAIL_API_KEY) {
    throw new Error(
      'Entrega de e-mail desabilitada. Configure EMAIL_DELIVERY_ENABLED=true e EMAIL_API_KEY.',
    );
  }

  const logger = createLogger(config);
  const worker = new OrderEmailWorker(
    new PrismaOrderEmailDeliveryRepository(prisma),
    new ResendEmailProvider(config.EMAIL_API_KEY),
    new OrderEmailRenderer(),
    logger,
  );

  let processed = 0;
  while (processed < MAX_DELIVERIES_PER_RUN && (await worker.processOnce())) processed += 1;

  logger.info({ processed, limit: MAX_DELIVERIES_PER_RUN }, 'Processamento da fila concluido.');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
