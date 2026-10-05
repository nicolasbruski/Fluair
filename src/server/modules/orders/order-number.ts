import { Prisma } from '@prisma/client';

export interface OrderNumberTransaction {
  $executeRaw(query: Prisma.Sql): Promise<number>;
  $queryRaw<T>(query: Prisma.Sql): Promise<T>;
}

export interface OrderNumberGenerator {
  next(transaction: OrderNumberTransaction, now: Date): Promise<string>;
}

export function formatOrderNumber(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new RangeError('Ano inválido para o número do pedido.');
  }
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999) {
    throw new RangeError('A sequência anual de pedidos foi esgotada.');
  }
  return `PED-${year}-${String(sequence).padStart(6, '0')}`;
}

export class PrismaOrderNumberGenerator implements OrderNumberGenerator {
  async next(transaction: OrderNumberTransaction, now: Date): Promise<string> {
    const year = now.getUTCFullYear();
    await transaction.$executeRaw(
      Prisma.sql`
        INSERT INTO \`order_number_sequences\` (\`year\`, \`last_number\`, \`updated_at\`)
        VALUES (${year}, LAST_INSERT_ID(1), ${now})
        ON DUPLICATE KEY UPDATE
          \`last_number\` = LAST_INSERT_ID(\`last_number\` + 1),
          \`updated_at\` = VALUES(\`updated_at\`)
      `,
    );
    const rows = await transaction.$queryRaw<Array<{ sequence: bigint | number }>>(
      Prisma.sql`SELECT LAST_INSERT_ID() AS \`sequence\``,
    );
    const sequence = Number(rows[0]?.sequence ?? 0);
    return formatOrderNumber(year, sequence);
  }
}
