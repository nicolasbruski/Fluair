import { Resend } from 'resend';

export interface EmailMessage {
  to: string[];
  from: { address: string; name: string | null };
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

export interface EmailProviderResult {
  provider: string;
  messageId: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailProviderResult>;
}

export class EmailProviderError extends Error {
  constructor(
    public readonly kind: 'TRANSIENT' | 'PERMANENT',
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'EmailProviderError';
  }
}

function resendErrorKind(statusCode: number | null, name: string): 'TRANSIENT' | 'PERMANENT' {
  if (name === 'invalid_idempotent_request' || name === 'invalid_idempotency_key') {
    return 'PERMANENT';
  }
  if (
    statusCode === null ||
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 429 ||
    statusCode >= 500
  ) {
    return 'TRANSIENT';
  }
  if (name === 'application_error' || name === 'internal_server_error') return 'TRANSIENT';
  return 'PERMANENT';
}

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;

  constructor(apiKey: string, client?: Resend) {
    this.client = client ?? new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<EmailProviderResult> {
    try {
      const response = await this.client.emails.send(
        {
          from: message.from.name
            ? `${message.from.name.replace(/[\r\n<>]/g, '').trim()} <${message.from.address}>`
            : message.from.address,
          to: message.to,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          subject: message.subject,
          html: message.html,
          text: message.text,
        },
        { idempotencyKey: message.idempotencyKey },
      );
      if (response.error) {
        throw new EmailProviderError(
          resendErrorKind(response.error.statusCode, response.error.name),
          response.error.name,
          response.error.message,
        );
      }
      return { provider: 'resend', messageId: response.data.id };
    } catch (error) {
      if (error instanceof EmailProviderError) throw error;
      throw new EmailProviderError(
        'TRANSIENT',
        'network_error',
        error instanceof Error ? error.message : 'Falha de rede no provedor.',
      );
    }
  }
}

export class DisabledEmailProvider implements EmailProvider {
  send(): Promise<EmailProviderResult> {
    return Promise.reject(
      new EmailProviderError(
        'PERMANENT',
        'delivery_disabled',
        'A entrega de e-mail esta desabilitada.',
      ),
    );
  }
}

export class InMemoryEmailProvider implements EmailProvider {
  readonly messages: EmailMessage[] = [];
  failure: EmailProviderError | null = null;

  send(message: EmailMessage): Promise<EmailProviderResult> {
    if (this.failure) return Promise.reject(this.failure);
    this.messages.push(structuredClone(message));
    return Promise.resolve({ provider: 'memory', messageId: `memory-${this.messages.length}` });
  }
}

export class AllowlistEmailProvider implements EmailProvider {
  private readonly emails = new Set<string>();
  private readonly domains = new Set<string>();

  constructor(
    allowlist: string,
    private readonly provider: EmailProvider,
  ) {
    for (const entry of allowlist
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)) {
      if (entry.startsWith('@')) this.domains.add(entry.slice(1));
      else this.emails.add(entry);
    }
  }

  async send(message: EmailMessage): Promise<EmailProviderResult> {
    const blocked = message.to.find((address) => {
      const normalized = address.toLowerCase();
      const domain = normalized.split('@')[1] ?? '';
      return !this.emails.has(normalized) && !this.domains.has(domain);
    });
    if (blocked) {
      throw new EmailProviderError(
        'PERMANENT',
        'recipient_not_allowed',
        'Um destinatario nao pertence a allowlist deste ambiente.',
      );
    }
    return this.provider.send(message);
  }
}
