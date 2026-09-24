import { describe, expect, it, vi } from 'vitest';

import { CUSTOMER_CLASSES, seedCustomerClasses } from '../../prisma/seed/customer-classes.js';

describe('seed das classes de clientes', () => {
  it('cadastra as quatro classes iniciais por códigos estáveis', () => {
    expect(CUSTOMER_CLASSES).toEqual([
      { code: 'IMPLEMENTER', name: 'Implementador' },
      { code: 'RESELLER', name: 'Revenda' },
      { code: 'END_CONSUMER', name: 'Consumidor Final' },
      { code: 'EXPORT', name: 'Exportação' },
    ]);
  });

  it('pode ser executado duas vezes sem duplicar registros nem atribuir classes a clientes', async () => {
    const storedClasses = new Map<string, { code: string; name: string; active: true }>();
    const customerClassUpsert = vi.fn(
      async (args: {
        where: { code: string };
        update: { name: string; active: true };
        create: { code: string; name: string; active: true };
      }) => {
        const current = storedClasses.get(args.where.code);
        storedClasses.set(args.where.code, current ? { ...current, ...args.update } : args.create);
      },
    );
    const prisma = { customerClass: { upsert: customerClassUpsert } };

    await seedCustomerClasses(prisma);
    await seedCustomerClasses(prisma);

    expect(customerClassUpsert).toHaveBeenCalledTimes(8);
    expect([...storedClasses.values()]).toEqual(
      CUSTOMER_CLASSES.map((customerClass) => ({ ...customerClass, active: true })),
    );
    expect(storedClasses).toHaveLength(4);
    expect(prisma).not.toHaveProperty('customer');
  });
});
