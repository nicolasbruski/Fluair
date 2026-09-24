export const CUSTOMER_CLASSES = [
  { code: 'IMPLEMENTER', name: 'Implementador' },
  { code: 'RESELLER', name: 'Revenda' },
  { code: 'END_CONSUMER', name: 'Consumidor Final' },
  { code: 'EXPORT', name: 'Exportação' },
] as const;

interface CustomerClassSeedClient {
  customerClass: {
    upsert(args: {
      where: { code: string };
      update: { name: string; active: true };
      create: { code: string; name: string; active: true };
    }): Promise<unknown>;
  };
}

export async function seedCustomerClasses(prisma: CustomerClassSeedClient): Promise<void> {
  for (const customerClass of CUSTOMER_CLASSES) {
    await prisma.customerClass.upsert({
      where: { code: customerClass.code },
      update: { name: customerClass.name, active: true },
      create: { ...customerClass, active: true },
    });
  }
}
