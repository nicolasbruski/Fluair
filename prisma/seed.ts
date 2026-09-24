import { PrismaClient } from '@prisma/client';

import { PERMISSIONS, ROLE_CODES, type PermissionCode } from '../src/shared/auth.js';
import { seedCustomerClasses } from './seed/customer-classes.js';
import { seedInitialPriceLists } from './seed/initial-price-lists.js';

const prisma = new PrismaClient();

const descriptions: Record<PermissionCode, string> = {
  'calculation.view': 'Acessar a busca e o detalhe de cálculos.',
  'calculation.create': 'Importar folhas Korp e salvar novos cálculos.',
  'calculation.history': 'Visualizar versões anteriores dos cálculos.',
  'calculation.export': 'Exportar resultados de cálculo.',
  'matrix.view': 'Consultar listas de preço, versões e situação.',
  'matrix.manage': 'Administrar listas de preço, importar e ativar versões.',
  'matrix.recalculate': 'Recalcular kits com uma nova versão de lista.',
  'user.view': 'Consultar usuários e suas permissões.',
  'user.manage': 'Criar, editar, ativar e desativar usuários e acessos.',
  'order.access': 'Acessar a montagem e cotação de pedidos.',
  'price.view': 'Visualizar catálogo e valores na montagem de pedidos.',
  'price.override': 'Informar preço negociado.',
  'customer.view': 'Consultar, exportar e selecionar clientes.',
  'customer.manage': 'Criar, editar, ativar e desativar clientes.',
  'catalog.manage': 'Adicionar, substituir e remover fotos do catálogo.',
  'commission.access': 'Acessar o sistema de comissões.',
};

const roleTemplates = [
  {
    code: ROLE_CODES.administrator,
    name: 'Administrador',
    description: 'Modelo com todas as permissões do sistema.',
    permissions: PERMISSIONS.filter((code) => code !== 'commission.access'),
  },
  {
    code: ROLE_CODES.calculationOperator,
    name: 'Operador de cálculo',
    description: 'Consulta, abre histórico e exporta resultados existentes.',
    permissions: [
      'calculation.view',
      'calculation.history',
      'calculation.export',
    ] satisfies PermissionCode[],
  },
  {
    code: ROLE_CODES.readOnly,
    name: 'Consulta',
    description: 'Consulta cálculos e históricos; exportação é concessão individual opcional.',
    permissions: ['calculation.view', 'calculation.history'] satisfies PermissionCode[],
  },
] as const;

async function main(): Promise<void> {
  await seedCustomerClasses(prisma);

  for (const profile of [
    { code: 'IMPLEMENTER', name: 'Implementador' },
    { code: 'TRADE_REPLACEMENT', name: 'Comércio / Reposição' },
    { code: 'END_CONSUMER', name: 'Consumidor Final' },
  ]) {
    await prisma.priceProfile.upsert({
      where: { code: profile.code },
      update: { name: profile.name },
      create: profile,
    });
  }

  await seedInitialPriceLists(prisma);

  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: { description: descriptions[code] },
      create: { code, description: descriptions[code] },
    });
  }

  const permissions = await prisma.permission.findMany();
  const permissionIds = new Map(permissions.map((permission) => [permission.code, permission.id]));

  for (const template of roleTemplates) {
    const role = await prisma.role.upsert({
      where: { code: template.code },
      update: { name: template.name, description: template.description },
      create: { code: template.code, name: template.name, description: template.description },
    });

    const ids = template.permissions.map((code) => {
      const id = permissionIds.get(code);
      if (!id) throw new Error(`Permissão estrutural ausente: ${code}`);
      return id;
    });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      }),
    ]);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
