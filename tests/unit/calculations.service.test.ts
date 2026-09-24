import { Buffer } from 'node:buffer';

import { Prisma, type PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { describe, expect, it, vi } from 'vitest';

import type { AppError } from '../../src/server/errors/app-error.js';
import { CalculationsService } from '../../src/server/modules/calculations/calculations.service.js';
import type { UploadedSpreadsheet } from '../../src/server/modules/pricing/upload.js';

const listId = '20000000-0000-4000-8000-000000000001';
const versionId = '30000000-0000-4000-8000-000000000001';
const classId = '60000000-0000-4000-8000-000000000001';

function workbook(rows: unknown[][]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Dados');
  return Buffer.from(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array);
}

function upload(): UploadedSpreadsheet {
  return {
    buffer: workbook([
      ['Cód. Interno: 130001 Descrição: KIT TESTE'],
      [],
      ['Ope.', 'Condição', 'Cód. Produto', 'Descrição Produto', '', 'Qtde.', 'UM'],
      ['001', 'P', '12345', 'COMPONENTE A', '', 2.5, 'UN'],
      ['002', 'P', '67890', 'COMPONENTE B', '', 3, 'UN'],
    ]),
    fileName: 'folha.xlsx',
    mimeType: 'application/octet-stream',
    fileHash: 'a'.repeat(64),
  };
}

function activeList(overrides: Record<string, unknown> = {}) {
  return {
    id: listId,
    code: 'DYNAMIC_LIST',
    name: 'Lista dinâmica',
    type: 'KIT_COMPONENT',
    active: true,
    activeVersionId: versionId,
    classes: [
      {
        customerClass: {
          id: classId,
          code: 'IMPLEMENTER',
          name: 'Implementador',
          active: true,
        },
      },
    ],
    activeVersion: {
      id: versionId,
      version: 7,
      fileName: 'lista.xlsx',
      fileSize: 100,
      fileHash: 'b'.repeat(64),
      itemCount: 1,
      createdAt: new Date('2026-09-13T12:00:00.000Z'),
      importedBy: { name: 'Admin' },
      items: [
        {
          productCode: '12345',
          minimumPrice: new Prisma.Decimal('0.10'),
          normalPrice: new Prisma.Decimal('0.20'),
        },
      ],
    },
    ...overrides,
  };
}

function prismaForPreview(list: ReturnType<typeof activeList>) {
  return {
    priceList: { findUnique: vi.fn().mockResolvedValue(list) },
    calculationVersion: { findFirst: vi.fn().mockResolvedValue(null) },
    kit: { findUnique: vi.fn().mockResolvedValue(null) },
  } as unknown as PrismaClient;
}

function expectCode(operation: Promise<unknown>, code: string): Promise<void> {
  return expect(operation).rejects.toMatchObject({ code } satisfies Partial<AppError>);
}

describe('cálculo com lista dinâmica', () => {
  it('retorna o detalhe e o histórico usando as fotografias persistidas', async () => {
    const stored = {
      id: '50000000-0000-4000-8000-000000000001',
      kitCalculationSeriesId: 'series-1',
      version: 2,
      current: true,
      kitDescription: 'KIT REAL',
      sourceFileName: 'folha.xlsx',
      sourceFileHash: 'a'.repeat(64),
      minimumTotal: new Prisma.Decimal('10.5000'),
      normalTotal: new Prisma.Decimal('12.7500'),
      itemCount: 1,
      missingPriceCount: 0,
      origin: 'MANUAL_RECALCULATION',
      createdAt: new Date('2026-09-15T12:00:00.000Z'),
      series: {
        kit: { code: '00130001' },
        priceList: { id: listId, code: 'LIST', name: 'Implementador' },
      },
      priceListVersion: { id: versionId, version: 7 },
      createdBy: { name: 'Admin' },
      kitImage: {
        id: 'image-version-2',
        width: 1200,
        height: 900,
        createdAt: new Date('2026-09-15T11:00:00.000Z'),
      },
      customers: [
        {
          customerId: '40000000-0000-4000-8000-000000000001',
          customerCodeSnapshot: 'C01619',
          customerNameSnapshot: 'Expresso Figueiredo',
          classNameSnapshot: 'Implementador',
          createdAt: new Date('2026-09-15T12:10:00.000Z'),
          linkedBy: { name: 'Admin' },
        },
      ],
      items: [
        {
          lineNumber: 1,
          productCode: '000123',
          description: 'COMPONENTE REAL',
          quantity: new Prisma.Decimal('2.5000'),
          unit: 'UN',
          minimumUnitPrice: new Prisma.Decimal('4.2000'),
          normalUnitPrice: new Prisma.Decimal('5.1000'),
          minimumTotal: new Prisma.Decimal('10.5000'),
          normalTotal: new Prisma.Decimal('12.7500'),
          hasPrice: true,
        },
      ],
    };
    const historical = {
      ...stored,
      id: '50000000-0000-4000-8000-000000000002',
      version: 1,
      current: false,
      kitImage: {
        id: 'image-version-1',
        width: 640,
        height: 480,
        createdAt: new Date('2026-09-14T11:00:00.000Z'),
      },
    };
    const prisma = {
      calculationVersion: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(stored)
          .mockResolvedValueOnce({ kitCalculationSeriesId: 'series-1' }),
        findMany: vi.fn().mockResolvedValue([stored, historical]),
      },
    } as unknown as PrismaClient;
    const service = new CalculationsService(prisma);

    const detail = await service.detail(stored.id);
    const history = await service.history(stored.id);

    expect(detail.data.calculation).toMatchObject({
      kitCode: '00130001',
      minimumTotal: '10.5000',
      customers: [{ code: 'C01619', legalName: 'Expresso Figueiredo' }],
      items: [{ code: '000123', quantity: '2.5', minimumTotal: '10.5000' }],
      image: { id: 'image-version-2' },
    });
    expect(detail.data.calculation.items[0]).not.toHaveProperty('operation');
    expect(detail.data.calculation.items[0]).not.toHaveProperty('condition');
    expect(history.data).toMatchObject({
      priceList: { id: listId },
      versions: [
        { id: stored.id, version: 2, priceListVersion: 7 },
        { id: historical.id, version: 1, priceListVersion: 7 },
      ],
    });
    expect(history.data.versions[0]?.image?.id).toBe('image-version-2');
    expect(history.data.versions[1]?.image?.id).toBe('image-version-1');
    expect(JSON.stringify(detail)).not.toContain('displayData');
  });

  it('lista somente cálculos atuais com valores persistidos e paginação', async () => {
    const catalogImage = {
      id: 'image-from-products',
      width: 1020,
      height: 851,
      createdAt: new Date('2026-09-16T12:00:00.000Z'),
    };
    const calculation = {
      id: '50000000-0000-4000-8000-000000000001',
      version: 3,
      current: true,
      kitDescription: 'KIT TESTE SALVO',
      minimumTotal: new Prisma.Decimal('1234.5000'),
      normalTotal: new Prisma.Decimal('1500.7500'),
      createdAt: new Date('2026-09-15T15:30:00.000Z'),
      createdBy: { name: 'Samara' },
      kitImage: null,
      series: {
        kit: { code: '00130001', reference: 'REF-KIT-01', currentImage: catalogImage },
        priceList: { id: listId, code: 'DYNAMIC_LIST', name: 'Lista dinâmica' },
      },
    };
    const findMany = vi.fn().mockResolvedValue([calculation]);
    const count = vi.fn().mockResolvedValue(31);
    const listPriceLists = vi
      .fn()
      .mockResolvedValue([{ id: listId, code: 'DYNAMIC_LIST', name: 'Lista dinâmica' }]);
    const prisma = {
      calculationVersion: { findMany, count },
      priceList: { findMany: listPriceLists },
    } as unknown as PrismaClient;

    const result = await new CalculationsService(prisma).list({
      search: 'teste',
      priceListId: listId,
      sort: 'createdAt',
      direction: 'desc',
      page: 2,
      pageSize: 30,
    });

    expect(result.data.calculations[0]).toMatchObject({
      id: calculation.id,
      kitCode: '00130001',
      reference: 'REF-KIT-01',
      minimumTotal: '1234.5000',
      normalTotal: '1500.7500',
      createdBy: 'Samara',
      current: true,
      image: { id: catalogImage.id },
    });
    expect(result.data.pagination).toEqual({ page: 2, pageSize: 30, total: 31, totalPages: 2 });
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          current: true,
          series: { priceListId: listId },
          OR: [
            { series: { kit: { code: { contains: 'teste' } } } },
            { series: { kit: { reference: { contains: 'teste' } } } },
            { kitDescription: { contains: 'teste' } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: 30,
        take: 30,
      }),
    );
  });

  it('exibe entre cálculo e Produtos a foto adicionada mais recentemente', async () => {
    const calculationImage = {
      id: 'image-from-calculation',
      width: 800,
      height: 600,
      createdAt: new Date('2026-09-17T12:00:00.000Z'),
    };
    const catalogImage = {
      id: 'older-image-from-products',
      width: 1020,
      height: 851,
      createdAt: new Date('2026-09-16T12:00:00.000Z'),
    };
    const stored = {
      id: '50000000-0000-4000-8000-000000000003',
      version: 3,
      current: true,
      kitDescription: 'KIT COM DUAS FOTOS',
      sourceFileName: 'folha.xlsx',
      sourceFileHash: 'c'.repeat(64),
      minimumTotal: new Prisma.Decimal('10.0000'),
      normalTotal: new Prisma.Decimal('12.0000'),
      itemCount: 0,
      missingPriceCount: 0,
      origin: 'MANUAL_RECALCULATION',
      createdAt: new Date('2026-09-17T12:10:00.000Z'),
      series: {
        kit: { code: '00130002', currentImage: catalogImage },
        priceList: { id: listId, code: 'LIST', name: 'Implementador' },
      },
      priceListVersion: { id: versionId, version: 7 },
      createdBy: { name: 'Admin' },
      kitImage: calculationImage,
      customers: [],
      items: [],
    };
    const prisma = {
      calculationVersion: { findUnique: vi.fn().mockResolvedValue(stored) },
    } as unknown as PrismaClient;

    const detail = await new CalculationsService(prisma).detail(stored.id);

    expect(detail.data.calculation.image?.id).toBe(calculationImage.id);
  });

  it('usa a versão ativa exata, mantém decimal e marca item sem preço', async () => {
    const result = await new CalculationsService(prismaForPreview(activeList())).preview(
      listId,
      upload(),
    );

    expect(result.data.preview).toMatchObject({
      priceList: {
        id: listId,
        code: 'DYNAMIC_LIST',
        customerClasses: [{ id: classId, code: 'IMPLEMENTER' }],
      },
      priceListVersion: { id: versionId, version: 7 },
      minimumTotal: 0.25,
      normalTotal: 0.5,
      itemCount: 2,
      missingPriceCount: 1,
    });
    expect(result.data.preview.items[1]).toMatchObject({
      code: '67890',
      hasPrice: false,
      minimumTotal: 0,
      normalTotal: 0,
    });
  });

  it('rejeita lista de tipo incorreto e lista sem versão ativa', async () => {
    await expectCode(
      new CalculationsService(prismaForPreview(activeList({ type: 'STANDALONE_PRODUCT' }))).preview(
        listId,
        upload(),
      ),
      'PRICE_LIST_TYPE_MISMATCH',
    );
    await expectCode(
      new CalculationsService(
        prismaForPreview(activeList({ activeVersionId: null, activeVersion: null })),
      ).preview(listId, upload()),
      'PRICE_LIST_ACTIVE_VERSION_REQUIRED',
    );
  });

  it('bloqueia salvamento quando a versão ativa muda após a prévia', async () => {
    const outer = prismaForPreview(activeList()) as unknown as Record<string, unknown>;
    const changed = activeList({
      activeVersionId: '30000000-0000-4000-8000-000000000002',
      activeVersion: {
        ...activeList().activeVersion,
        id: '30000000-0000-4000-8000-000000000002',
        version: 8,
      },
    });
    const transaction = {
      $queryRaw: vi.fn(),
      priceList: { findUnique: vi.fn().mockResolvedValue(changed) },
    };
    outer.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(transaction));
    const service = new CalculationsService(outer as unknown as PrismaClient);

    await expectCode(
      service.save(
        listId,
        upload(),
        {
          recalculate: false,
          customerId: '40000000-0000-4000-8000-000000000001',
          expectedPriceListVersionId: versionId,
        },
        {
          actor: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Admin',
            email: 'admin@test',
            permissions: [],
          },
          requestId: 'request-1',
        },
      ),
      'ACTIVE_PRICE_LIST_VERSION_CHANGED',
    );
  });

  it('recarrega e rejeita cliente inativo, sem classe ou incompatível', async () => {
    async function saveWith(customer: unknown) {
      const outer = prismaForPreview(activeList()) as unknown as Record<string, unknown>;
      const transaction = {
        $queryRaw: vi.fn(),
        priceList: { findUnique: vi.fn().mockResolvedValue(activeList()) },
        customer: { findFirst: vi.fn().mockResolvedValue(customer) },
      };
      outer.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback(transaction),
      );
      return new CalculationsService(outer as unknown as PrismaClient).save(
        listId,
        upload(),
        {
          recalculate: false,
          customerId: '40000000-0000-4000-8000-000000000001',
          expectedPriceListVersionId: versionId,
        },
        {
          actor: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Admin',
            email: 'admin@test',
            permissions: [],
          },
          requestId: 'request-2',
        },
      );
    }

    await expectCode(saveWith(null), 'ACTIVE_CUSTOMER_NOT_FOUND');
    await expectCode(
      saveWith({
        id: '40000000-0000-4000-8000-000000000001',
        code: 'C1',
        legalName: 'Sem classe',
        customerClass: null,
      }),
      'CUSTOMER_CLASS_REQUIRED',
    );
    await expectCode(
      saveWith({
        id: '40000000-0000-4000-8000-000000000001',
        code: 'C1',
        legalName: 'Outra classe',
        customerClass: {
          id: '60000000-0000-4000-8000-000000000009',
          code: 'OTHER',
          name: 'Outra',
          active: true,
        },
      }),
      'PRICE_LIST_CLASS_NOT_ALLOWED',
    );
  });

  it('exige nova versão quando uma foto é enviada para cálculo atual', async () => {
    const current = {
      id: '50000000-0000-4000-8000-000000000001',
      version: 2,
      sourceFileHash: 'a'.repeat(64),
      minimumTotal: new Prisma.Decimal('1'),
      normalTotal: new Prisma.Decimal('2'),
      createdAt: new Date('2026-09-20T12:00:00.000Z'),
      priceListVersion: { id: versionId, version: 7 },
      createdBy: { name: 'Admin' },
      kitImage: null,
    };
    const outer = prismaForPreview(activeList()) as unknown as {
      calculationVersion: { findFirst: ReturnType<typeof vi.fn> };
      kit: { findUnique: ReturnType<typeof vi.fn> };
      $transaction: ReturnType<typeof vi.fn>;
    };
    outer.calculationVersion.findFirst.mockResolvedValue(current);
    outer.kit.findUnique.mockResolvedValue({ currentImage: null });
    const transaction = {
      $queryRaw: vi.fn(),
      priceList: { findUnique: vi.fn().mockResolvedValue(activeList()) },
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: '40000000-0000-4000-8000-000000000001',
          code: 'C1',
          legalName: 'Cliente',
          customerClass: {
            id: classId,
            code: 'IMPLEMENTER',
            name: 'Implementador',
            active: true,
          },
        }),
      },
      kit: {
        upsert: vi.fn().mockResolvedValue({
          id: 'kit-1',
          code: '130001',
          currentImageId: null,
        }),
      },
      kitCalculationSeries: { upsert: vi.fn().mockResolvedValue({ id: 'series-1' }) },
      calculationVersion: { findFirst: vi.fn().mockResolvedValue(current) },
    };
    outer.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(transaction));
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    await expectCode(
      new CalculationsService(outer as unknown as PrismaClient).save(
        listId,
        upload(),
        {
          recalculate: false,
          customerId: '40000000-0000-4000-8000-000000000001',
          expectedPriceListVersionId: versionId,
          expectedKitImageId: null,
          image: { data: png, fileName: 'kit.png', contentType: 'image/png' },
        },
        {
          actor: {
            id: '00000000-0000-4000-8000-000000000001',
            name: 'Admin',
            email: 'admin@test',
            permissions: ['calculation.create'],
          },
          requestId: 'request-photo',
        },
      ),
      'CALCULATION_RECALCULATION_REQUIRED',
    );
  });

  it('salva primeiro cálculo com foto e fotografa cliente e classe sem FKs legadas', async () => {
    const outer = prismaForPreview(activeList()) as unknown as Record<string, unknown>;
    let capturedCreate: unknown;
    const createdCalculation = {
      id: '50000000-0000-4000-8000-000000000001',
      version: 1,
      sourceFileHash: 'a'.repeat(64),
      minimumTotal: new Prisma.Decimal('0.25'),
      normalTotal: new Prisma.Decimal('0.50'),
      createdAt: new Date('2026-09-13T13:00:00.000Z'),
      priceListVersion: { id: versionId, version: 7 },
      createdBy: { name: 'Admin' },
      kitDescription: 'KIT TESTE',
      kitImage: {
        id: '70000000-0000-4000-8000-000000000001',
        width: 1,
        height: 1,
        createdAt: new Date('2026-09-13T13:00:00.000Z'),
      },
    };
    const createCalculation = vi.fn((input: unknown) => {
      capturedCreate = input;
      return Promise.resolve(createdCalculation);
    });
    const transaction = {
      $queryRaw: vi.fn(),
      priceList: { findUnique: vi.fn().mockResolvedValue(activeList()) },
      customer: {
        findFirst: vi.fn().mockResolvedValue({
          id: '40000000-0000-4000-8000-000000000001',
          code: 'C1',
          legalName: 'Cliente compatível',
          customerClass: {
            id: classId,
            code: 'IMPLEMENTER',
            name: 'Implementador',
            active: true,
          },
        }),
      },
      kit: {
        upsert: vi.fn().mockResolvedValue({
          id: 'kit-1',
          code: '130001',
          currentImageId: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      mediaAsset: {
        create: vi.fn().mockResolvedValue({ id: '70000000-0000-4000-8000-000000000001' }),
      },
      kitCalculationSeries: { upsert: vi.fn().mockResolvedValue({ id: 'series-1' }) },
      calculationVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
        aggregate: vi.fn().mockResolvedValue({ _max: { version: null } }),
        updateMany: vi.fn(),
        create: createCalculation,
      },
      product: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: 'product-1' })
          .mockResolvedValueOnce({ id: 'product-2' }),
      },
      kitPriceList: { findUnique: vi.fn().mockResolvedValue(null) },
      priceMatrixVersion: { findUnique: vi.fn().mockResolvedValue(null) },
      auditLog: { create: vi.fn() },
    };
    outer.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback(transaction));

    const result = await new CalculationsService(outer as unknown as PrismaClient).save(
      listId,
      upload(),
      {
        recalculate: false,
        customerId: '40000000-0000-4000-8000-000000000001',
        expectedPriceListVersionId: versionId,
        expectedKitImageId: null,
        image: {
          data: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
            'base64',
          ),
          fileName: 'kit.png',
          contentType: 'image/png',
        },
      },
      {
        actor: {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Admin',
          email: 'admin@test',
          permissions: [],
        },
        requestId: 'request-3',
      },
    );

    expect(result.data).toMatchObject({
      createdVersion: true,
      customerLinked: true,
      calculation: {
        priceListName: 'Lista dinâmica',
        customerName: 'Cliente compatível',
        customerClass: { code: 'IMPLEMENTER' },
        image: { id: '70000000-0000-4000-8000-000000000001' },
      },
    });
    expect(capturedCreate).toMatchObject({
      data: {
        priceListId: null,
        matrixVersionId: null,
        kitCalculationSeriesId: 'series-1',
        priceListVersionId: versionId,
        kitImageId: '70000000-0000-4000-8000-000000000001',
        customers: {
          create: {
            customerCodeSnapshot: 'C1',
            customerNameSnapshot: 'Cliente compatível',
            classCodeSnapshot: 'IMPLEMENTER',
            classNameSnapshot: 'Implementador',
          },
        },
      },
    });
    expect(transaction.kit.updateMany).toHaveBeenCalledWith({
      where: { id: 'kit-1', currentImageId: null },
      data: { currentImageId: '70000000-0000-4000-8000-000000000001' },
    });
  });
});
