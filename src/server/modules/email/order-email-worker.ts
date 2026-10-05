import type { Logger } from 'pino';

import { EmailProviderError, type EmailProvider } from './email-provider.js';
import type { OrderEmailDeliveryRepository } from './order-email-delivery.repository.js';
import { ORDER_EMAIL_TEMPLATE_VERSION } from './order-email-renderer.js';
import type { OrderEmailRenderer } from './order-email-renderer.js';

export interface OrderEmailWorkerOptions {
  pollIntervalMs?: number;
  reservationDurationMs?: number;
  maxAttempts?: number;
  clock?: { now(): Date };
  random?: () => number;
}

export class OrderEmailWorker {
  private readonly pollIntervalMs: number;
  private readonly reservationDurationMs: number;
  private readonly maxAttempts: number;
  private readonly clock: { now(): Date };
  private readonly random: () => number;
  private timer: NodeJS.Timeout | null = null;
  private currentRun: Promise<void> | null = null;
  private stopping = false;

  constructor(
    private readonly repository: OrderEmailDeliveryRepository,
    private readonly provider: EmailProvider,
    private readonly renderer: OrderEmailRenderer,
    private readonly logger: Logger,
    options: OrderEmailWorkerOptions = {},
  ) {
    this.pollIntervalMs = options.pollIntervalMs ?? 10_000;
    this.reservationDurationMs = options.reservationDurationMs ?? 5 * 60_000;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.clock = options.clock ?? { now: () => new Date() };
    this.random = options.random ?? Math.random;
  }

  start(): void {
    if (this.timer || this.stopping) return;
    const tick = (): void => {
      if (this.stopping || this.currentRun) return;
      this.currentRun = this.processOnce()
        .then(() => undefined)
        .catch((error: unknown) =>
          this.logger.error({ err: error }, 'Falha inesperada no worker de e-mail.'),
        )
        .finally(() => {
          this.currentRun = null;
        });
    };
    tick();
    this.timer = setInterval(tick, this.pollIntervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.currentRun;
  }

  async processOnce(): Promise<boolean> {
    const delivery = await this.repository.reserveNext(
      this.clock.now(),
      this.reservationDurationMs,
    );
    if (!delivery) return false;
    try {
      if (delivery.templateVersion !== ORDER_EMAIL_TEMPLATE_VERSION) {
        throw new EmailProviderError(
          'PERMANENT',
          'unsupported_template',
          'Versao de template nao suportada.',
        );
      }
      const rendered = this.renderer.render(delivery.order);
      const result = await this.provider.send({
        to: delivery.recipients,
        from: { address: delivery.fromAddress, name: delivery.fromName },
        replyTo: delivery.replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: delivery.idempotencyKey,
      });
      await this.repository.markAccepted(
        delivery,
        result.provider,
        result.messageId,
        this.clock.now(),
      );
      this.logger.info(
        {
          orderId: delivery.orderId,
          deliveryId: delivery.id,
          attemptCount: delivery.attemptCount,
          provider: result.provider,
        },
        'E-mail do pedido aceito pelo provedor.',
      );
    } catch (error) {
      const providerError =
        error instanceof EmailProviderError
          ? error
          : new EmailProviderError(
              'TRANSIENT',
              'unexpected_provider_error',
              'Falha inesperada no provedor.',
            );
      const terminal =
        providerError.kind === 'PERMANENT' || delivery.attemptCount >= this.maxAttempts;
      const now = this.clock.now();
      await this.repository.markFailure(
        delivery,
        {
          kind: providerError.kind,
          code: providerError.code,
          publicMessage: terminal
            ? 'Nao foi possivel enviar o e-mail. O pedido permanece registrado.'
            : 'Envio temporariamente indisponivel; nova tentativa agendada.',
          nextAttemptAt: terminal
            ? null
            : new Date(now.getTime() + this.backoffMs(delivery.attemptCount)),
        },
        now,
      );
      this.logger[terminal ? 'error' : 'warn'](
        {
          orderId: delivery.orderId,
          deliveryId: delivery.id,
          attemptCount: delivery.attemptCount,
          errorCode: providerError.code,
        },
        terminal ? 'Entrega de e-mail encerrada com falha.' : 'Entrega de e-mail reagendada.',
      );
    }
    return true;
  }

  private backoffMs(attempt: number): number {
    const baseMinutes = [1, 5, 30, 180][Math.min(Math.max(attempt - 1, 0), 3)] ?? 180;
    const jitter = 0.8 + this.random() * 0.4;
    return Math.round(baseMinutes * 60_000 * jitter);
  }
}
