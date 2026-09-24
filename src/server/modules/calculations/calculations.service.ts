import { Prisma, type PrismaClient } from '@prisma/client';

import type { AuthenticatedUser } from '../../../shared/auth.js';
import { imageReference } from '../../../shared/media.js';
import type {
  CalculatedItem,
  CalculationDetailEnvelope,
  CalculationHistoryEnvelope,
  CalculationPreview,
  CalculationPreviewEnvelope,
  CalculationSearchEnvelope,
  CalculationSaveEnvelope,
  ExistingCalculationSummary,
  PriceListAudienceSummary,
  PriceListVersionDto,
  SavedCalculationSummary,
} from '../../../shared/pricing.js';
import { AppError } from '../../errors/app-error.js';
import { processImage } from '../media/image-processor.js';
import { createMediaAsset } from '../media/media-asset-writer.js';
import type { ProcessedMedia } from '../media/media.types.js';
import { parseProcessWorkbook, SpreadsheetError } from '../pricing/spreadsheet-parser.js';
import type { UploadedSpreadsheet } from '../pricing/upload.js';
import type { CalculationImageUpload } from './calculation-multipart.js';
import type { CalculationListQuery } from './calculations.schemas.js';

export interface CalculationContext {
  actor: AuthenticatedUser;
  requestId: string;
}

export interface SaveCalculationOptions {
  recalculate: boolean;
  customerId: string;
  expectedPriceListVersionId: string;
  expectedKitImageId?: string | null | undefined;
  image?: CalculationImageUpload | null | undefined;
}

interface ActivePriceList {
  id: string;
  code: string;
  name: string;
  type: 'KIT_COMPONENT' | 'STANDALONE_PRODUCT';
  active: boolean;
  activeVersionId: string | null;
  classes: Array<{ customerClass: PriceListAudienceSummary }>;
  activeVersion: {
    id: string;
    version: number;
    fileName: string;
    fileSize: number;
    fileHash: string;
    itemCount: number;
    createdAt: Date;
    importedBy: { name: string };
    items: Array<{
      productCode: string;
      minimumPrice: Prisma.Decimal | null;
      normalPrice: Prisma.Decimal | null;
    }>;
  } | null;
}

interface ComputedCalculation {
  preview: CalculationPreview;
  process: ReturnType<typeof parseProcessWorkbook>;
}

interface CalculationImageRecord {
  id: string;
  width: number;
  height: number;
  createdAt: Date;
}

function latestCalculationImage(
  calculationImage: CalculationImageRecord | null | undefined,
  catalogImage: CalculationImageRecord | null | undefined,
) {
  if (!calculationImage) return catalogImage ? imageReference(catalogImage) : null;
  if (!catalogImage) return imageReference(calculationImage);
  return imageReference(
    catalogImage.createdAt.getTime() >= calculationImage.createdAt.getTime()
      ? catalogImage
      : calculationImage,
  );
}

function versionSummary(
  version: NonNullable<ActivePriceList['activeVersion']>,
): PriceListVersionDto {
  return {
    id: version.id,
    version: version.version,
    fileName: version.fileName,
    fileSize: version.fileSize,
    fileHash: version.fileHash,
    itemCount: version.itemCount,
    importedBy: version.importedBy.name,
    createdAt: version.createdAt.toISOString(),
  };
}

function existingSummary(calculation: {
  id: string;
  version: number;
  sourceFileHash: string;
  minimumTotal: Prisma.Decimal;
  normalTotal: Prisma.Decimal;
  createdAt: Date;
  priceListVersion: { id: string; version: number };
  createdBy: { name: string };
  kitImage?: { id: string; width: number; height: number; createdAt: Date } | null;
}): ExistingCalculationSummary {
  return {
    id: calculation.id,
    version: calculation.version,
    priceListVersion: calculation.priceListVersion.version,
    priceListVersionId: calculation.priceListVersion.id,
    sourceFileHash: calculation.sourceFileHash,
    minimumTotal: calculation.minimumTotal.toNumber(),
    normalTotal: calculation.normalTotal.toNumber(),
    createdAt: calculation.createdAt.toISOString(),
    createdBy: calculation.createdBy.name,
    image: calculation.kitImage ? imageReference(calculation.kitImage) : null,
  };
}

function calculationError(error: unknown): never {
  if (error instanceof SpreadsheetError) throw new AppError(422, error.code, error.message);
  throw error;
}

function assertUsableList(list: ActivePriceList | null): asserts list is ActivePriceList & {
  activeVersion: NonNullable<ActivePriceList['activeVersion']>;
} {
  if (!list) throw new AppError(404, 'PRICE_LIST_NOT_FOUND', 'Lista de preÃ§o nÃ£o encontrada.');
  if (list.type !== 'KIT_COMPONENT') {
    throw new AppError(
      422,
      'PRICE_LIST_TYPE_MISMATCH',
      'Somente uma lista de componentes pode ser usada no cÃ¡lculo de kits.',
    );
  }
  if (!list.active)
    throw new AppError(422, 'PRICE_LIST_INACTIVE', 'A lista de preÃ§o estÃ¡ inativa.');
  if (!list.activeVersion) {
    throw new AppError(
      422,
      'PRICE_LIST_ACTIVE_VERSION_REQUIRED',
      'A lista nÃ£o possui versÃ£o ativa.',
    );
  }
}

const calculationListInclude = {
  classes: { include: { customerClass: true } },
  activeVersion: {
    include: {
      importedBy: { select: { name: true } },
      items: { select: { productCode: true, minimumPrice: true, normalPrice: true } },
    },
  },
} satisfies Prisma.PriceListInclude;

export class CalculationsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query: CalculationListQuery): Promise<CalculationSearchEnvelope> {
    const where: Prisma.CalculationVersionWhereInput = {
      current: true,
      ...(query.priceListId ? { series: { priceListId: query.priceListId } } : {}),
      ...(query.search
        ? {
            OR: [
              { series: { kit: { code: { contains: query.search } } } },
              { series: { kit: { reference: { contains: query.search } } } },
              { kitDescription: { contains: query.search } },
            ],
          }
        : {}),
    };
    const direction = query.direction;
    const orderBy: Prisma.CalculationVersionOrderByWithRelationInput =
      query.sort === 'code'
        ? { series: { kit: { code: direction } } }
        : query.sort === 'description'
          ? { kitDescription: direction }
          : query.sort === 'reference'
            ? { series: { kit: { reference: direction } } }
            : query.sort === 'priceList'
              ? { series: { priceList: { name: direction } } }
              : query.sort === 'minimumTotal'
                ? { minimumTotal: direction }
                : query.sort === 'normalTotal'
                  ? { normalTotal: direction }
                  : { createdAt: direction };

    const [calculations, total, priceLists] = await Promise.all([
      this.prisma.calculationVersion.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          series: {
            include: {
              kit: {
                include: {
                  currentImage: {
                    select: { id: true, width: true, height: true, createdAt: true },
                  },
                },
              },
              priceList: true,
            },
          },
          createdBy: { select: { name: true } },
          kitImage: { select: { id: true, width: true, height: true, createdAt: true } },
        },
      }),
      this.prisma.calculationVersion.count({ where }),
      this.prisma.priceList.findMany({
        where: {
          type: 'KIT_COMPONENT',
          calculationSeries: { some: { calculations: { some: { current: true } } } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: { id: true, code: true, name: true },
      }),
    ]);

    return {
      data: {
        calculations: calculations.map((calculation) => ({
          id: calculation.id,
          kitCode: calculation.series.kit.code,
          kitDescription: calculation.kitDescription,
          reference: calculation.series.kit.reference,
          priceList: {
            id: calculation.series.priceList.id,
            code: calculation.series.priceList.code,
            name: calculation.series.priceList.name,
          },
          minimumTotal: calculation.minimumTotal.toFixed(4),
          normalTotal: calculation.normalTotal.toFixed(4),
          version: calculation.version,
          createdAt: calculation.createdAt.toISOString(),
          createdBy: calculation.createdBy.name,
          current: true,
          image: latestCalculationImage(calculation.kitImage, calculation.series.kit.currentImage),
        })),
        filters: { priceLists },
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
        },
      },
    };
  }

  async detail(id: string): Promise<CalculationDetailEnvelope> {
    const calculation = await this.prisma.calculationVersion.findUnique({
      where: { id },
      include: {
        series: {
          include: {
            kit: {
              include: {
                currentImage: {
                  select: { id: true, width: true, height: true, createdAt: true },
                },
              },
            },
            priceList: true,
          },
        },
        priceListVersion: { select: { id: true, version: true } },
        createdBy: { select: { name: true } },
        customers: {
          include: { linkedBy: { select: { name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        items: { orderBy: { lineNumber: 'asc' } },
        kitImage: { select: { id: true, width: true, height: true, createdAt: true } },
      },
    });
    if (!calculation) throw new AppError(404, 'CALCULATION_NOT_FOUND', 'Cálculo não encontrado.');

    return {
      data: {
        calculation: {
          id: calculation.id,
          version: calculation.version,
          current: calculation.current,
          kitCode: calculation.series.kit.code,
          kitDescription: calculation.kitDescription,
          priceList: {
            id: calculation.series.priceList.id,
            code: calculation.series.priceList.code,
            name: calculation.series.priceList.name,
          },
          priceListVersion: calculation.priceListVersion,
          sourceFileName: calculation.sourceFileName,
          sourceFileHash: calculation.sourceFileHash,
          minimumTotal: calculation.minimumTotal.toFixed(4),
          normalTotal: calculation.normalTotal.toFixed(4),
          itemCount: calculation.itemCount,
          missingPriceCount: calculation.missingPriceCount,
          origin: calculation.origin,
          createdAt: calculation.createdAt.toISOString(),
          createdBy: calculation.createdBy.name,
          image: latestCalculationImage(calculation.kitImage, calculation.series.kit.currentImage),
          customers: calculation.customers.map((link) => ({
            id: link.customerId,
            code: link.customerCodeSnapshot ?? '—',
            legalName: link.customerNameSnapshot ?? 'Cliente sem fotografia',
            className: link.classNameSnapshot,
            linkedAt: link.createdAt.toISOString(),
            linkedBy: link.linkedBy.name,
          })),
          items: calculation.items.map((item) => ({
            lineNumber: item.lineNumber,
            code: item.productCode,
            description: item.description,
            quantity: item.quantity.toString(),
            unit: item.unit,
            minimumUnitPrice: item.minimumUnitPrice.toFixed(4),
            normalUnitPrice: item.normalUnitPrice.toFixed(4),
            minimumTotal: item.minimumTotal.toFixed(4),
            normalTotal: item.normalTotal.toFixed(4),
            hasPrice: item.hasPrice,
          })),
        },
      },
    };
  }

  async history(id: string): Promise<CalculationHistoryEnvelope> {
    const selected = await this.prisma.calculationVersion.findUnique({
      where: { id },
      select: { kitCalculationSeriesId: true },
    });
    if (!selected) throw new AppError(404, 'CALCULATION_NOT_FOUND', 'Cálculo não encontrado.');
    const versions = await this.prisma.calculationVersion.findMany({
      where: { kitCalculationSeriesId: selected.kitCalculationSeriesId },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      include: {
        series: {
          include: {
            kit: {
              include: {
                currentImage: {
                  select: { id: true, width: true, height: true, createdAt: true },
                },
              },
            },
            priceList: true,
          },
        },
        priceListVersion: { select: { version: true } },
        createdBy: { select: { name: true } },
        kitImage: { select: { id: true, width: true, height: true, createdAt: true } },
      },
    });
    const first = versions[0];
    if (!first) throw new AppError(404, 'CALCULATION_NOT_FOUND', 'Cálculo não encontrado.');
    return {
      data: {
        kit: { code: first.series.kit.code, description: first.kitDescription },
        priceList: {
          id: first.series.priceList.id,
          code: first.series.priceList.code,
          name: first.series.priceList.name,
        },
        versions: versions.map((version) => ({
          id: version.id,
          version: version.version,
          current: version.current,
          priceListVersion: version.priceListVersion.version,
          sourceFileName: version.sourceFileName,
          sourceFileHash: version.sourceFileHash,
          minimumTotal: version.minimumTotal.toFixed(4),
          normalTotal: version.normalTotal.toFixed(4),
          itemCount: version.itemCount,
          missingPriceCount: version.missingPriceCount,
          origin: version.origin,
          createdAt: version.createdAt.toISOString(),
          createdBy: version.createdBy.name,
          image: latestCalculationImage(version.kitImage, version.series.kit.currentImage),
        })),
      },
    };
  }

  private async activePriceList(priceListId: string): Promise<ActivePriceList> {
    const list = (await this.prisma.priceList.findUnique({
      where: { id: priceListId },
      include: calculationListInclude,
    })) as ActivePriceList | null;
    assertUsableList(list);
    return list;
  }

  private async compute(
    priceListId: string,
    upload: UploadedSpreadsheet,
  ): Promise<ComputedCalculation> {
    let process;
    try {
      process = parseProcessWorkbook(upload.buffer);
    } catch (error) {
      calculationError(error);
    }
    const list = await this.activePriceList(priceListId);
    const activeVersion = list.activeVersion!;
    const prices = new Map(
      activeVersion.items.map((item) => [
        item.productCode,
        {
          minimum: item.minimumPrice ?? new Prisma.Decimal(0),
          normal: item.normalPrice ?? new Prisma.Decimal(0),
        },
      ]),
    );
    let minimumTotal = new Prisma.Decimal(0);
    let normalTotal = new Prisma.Decimal(0);
    const items: CalculatedItem[] = process.items.map((item) => {
      const price = prices.get(item.code);
      const minimumUnitPrice = price?.minimum ?? new Prisma.Decimal(0);
      const normalUnitPrice = price?.normal ?? new Prisma.Decimal(0);
      const quantity = new Prisma.Decimal(item.quantity);
      const itemMinimumTotal = minimumUnitPrice.mul(quantity);
      const itemNormalTotal = normalUnitPrice.mul(quantity);
      minimumTotal = minimumTotal.add(itemMinimumTotal);
      normalTotal = normalTotal.add(itemNormalTotal);
      return {
        lineNumber: item.lineNumber,
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        minimumUnitPrice: minimumUnitPrice.toNumber(),
        normalUnitPrice: normalUnitPrice.toNumber(),
        minimumTotal: itemMinimumTotal.toNumber(),
        normalTotal: itemNormalTotal.toNumber(),
        hasPrice: Boolean(price && (minimumUnitPrice.gt(0) || normalUnitPrice.gt(0))),
      };
    });
    const [current, kit] = await Promise.all([
      this.prisma.calculationVersion.findFirst({
        where: { current: true, series: { kit: { code: process.kitCode }, priceListId: list.id } },
        include: {
          priceListVersion: { select: { id: true, version: true } },
          createdBy: { select: { name: true } },
          kitImage: { select: { id: true, width: true, height: true, createdAt: true } },
        },
      }),
      this.prisma.kit.findUnique({
        where: { code: process.kitCode },
        select: {
          currentImage: { select: { id: true, width: true, height: true, createdAt: true } },
        },
      }),
    ]);
    const currentKitImage = kit?.currentImage ? imageReference(kit.currentImage) : null;
    const existing = current ? existingSummary(current) : null;
    return {
      process,
      preview: {
        kitCode: process.kitCode,
        kitDescription: process.kitDescription,
        priceList: {
          id: list.id,
          code: list.code,
          name: list.name,
          customerClasses: list.classes.map(({ customerClass }) => customerClass),
        },
        priceListVersion: versionSummary(activeVersion),
        sourceFileHash: upload.fileHash,
        sourceFileName: upload.fileName,
        minimumTotal: minimumTotal.toNumber(),
        normalTotal: normalTotal.toNumber(),
        itemCount: items.length,
        missingPriceCount: items.filter((item) => !item.hasPrice).length,
        items,
        existing,
        currentKitImage,
        image:
          current &&
          current.priceListVersion.id === activeVersion.id &&
          current.sourceFileHash === upload.fileHash
            ? existing!.image
            : currentKitImage,
      },
    };
  }

  async preview(
    priceListId: string,
    upload: UploadedSpreadsheet,
  ): Promise<CalculationPreviewEnvelope> {
    return { data: { preview: (await this.compute(priceListId, upload)).preview } };
  }

  async save(
    priceListId: string,
    upload: UploadedSpreadsheet,
    options: SaveCalculationOptions,
    context: CalculationContext,
  ): Promise<CalculationSaveEnvelope> {
    const computed = await this.compute(priceListId, upload);
    const processedImage: ProcessedMedia | null = options.image
      ? await processImage(options.image)
      : null;
    if (computed.preview.priceListVersion.id !== options.expectedPriceListVersionId) {
      throw new AppError(
        409,
        'ACTIVE_PRICE_LIST_VERSION_CHANGED',
        'A versÃ£o ativa da lista mudou depois da prÃ©via. Calcule novamente antes de salvar.',
      );
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT \`id\` FROM \`price_lists\` WHERE \`id\` = ${priceListId} FOR UPDATE`,
        );
        const list = (await transaction.priceList.findUnique({
          where: { id: priceListId },
          include: calculationListInclude,
        })) as ActivePriceList | null;
        assertUsableList(list);
        if (list.activeVersionId !== options.expectedPriceListVersionId) {
          throw new AppError(
            409,
            'ACTIVE_PRICE_LIST_VERSION_CHANGED',
            'A versÃ£o ativa da lista mudou depois da prÃ©via. Calcule novamente antes de salvar.',
          );
        }

        const customer = await transaction.customer.findFirst({
          where: { id: options.customerId, active: true },
          include: { customerClass: true },
        });
        if (!customer) {
          throw new AppError(
            409,
            'ACTIVE_CUSTOMER_NOT_FOUND',
            'O cliente selecionado nÃ£o existe ou estÃ¡ desativado.',
          );
        }
        if (!customer.customerClass || !customer.customerClass.active) {
          throw new AppError(
            422,
            'CUSTOMER_CLASS_REQUIRED',
            'O cliente nÃ£o possui uma classe ativa definida.',
          );
        }
        if (
          !list.classes.some(({ customerClass }) => customerClass.id === customer.customerClass!.id)
        ) {
          throw new AppError(
            422,
            'PRICE_LIST_CLASS_NOT_ALLOWED',
            'A classe do cliente nÃ£o Ã© compatÃ­vel com a lista da prÃ©via. Escolha outra lista e calcule novamente.',
          );
        }

        const kit = await transaction.kit.upsert({
          where: { code: computed.process.kitCode },
          update: { description: computed.process.kitDescription },
          create: { code: computed.process.kitCode, description: computed.process.kitDescription },
        });
        if (
          options.expectedKitImageId !== undefined &&
          kit.currentImageId !== options.expectedKitImageId
        ) {
          throw new AppError(
            409,
            'KIT_IMAGE_CHANGED',
            'A foto atual do kit mudou depois da prÃ©via. Calcule novamente antes de salvar.',
          );
        }
        const series = await transaction.kitCalculationSeries.upsert({
          where: { kitId_priceListId: { kitId: kit.id, priceListId: list.id } },
          update: {},
          create: { kitId: kit.id, priceListId: list.id },
        });
        const current = await transaction.calculationVersion.findFirst({
          where: { kitCalculationSeriesId: series.id, current: true },
          include: {
            priceListVersion: { select: { id: true, version: true } },
            createdBy: { select: { name: true } },
            kitImage: { select: { id: true, width: true, height: true, createdAt: true } },
          },
        });
        const customerSnapshot = {
          customerId: customer.id,
          linkedByUserId: context.actor.id,
          customerCodeSnapshot: customer.code,
          customerNameSnapshot: customer.legalName,
          classIdSnapshot: customer.customerClass.id,
          classCodeSnapshot: customer.customerClass.code,
          classNameSnapshot: customer.customerClass.name,
        };

        if (current && !options.recalculate) {
          if (processedImage) {
            throw new AppError(
              409,
              'CALCULATION_RECALCULATION_REQUIRED',
              'Uma nova foto exige a criaÃ§Ã£o de uma nova versÃ£o do cÃ¡lculo.',
            );
          }
          if (
            current.priceListVersion.id !== options.expectedPriceListVersionId ||
            current.sourceFileHash !== upload.fileHash
          ) {
            throw new AppError(
              409,
              'CALCULATION_RECALCULATION_REQUIRED',
              'A lista ou a folha mudou desde o cÃ¡lculo atual. Crie uma nova versÃ£o para preservar o histÃ³rico.',
            );
          }
          const link = await transaction.calculationCustomer.createMany({
            data: [{ calculationVersionId: current.id, ...customerSnapshot }],
            skipDuplicates: true,
          });
          await transaction.auditLog.create({
            data: {
              actorUserId: context.actor.id,
              action: 'CALCULATION_CUSTOMER_LINKED',
              entityType: 'calculation_version',
              entityId: current.id,
              metadata: {
                customerId: customer.id,
                customerClassCode: customer.customerClass.code,
                created: link.count > 0,
              },
              requestId: context.requestId,
            },
          });
          return {
            data: {
              calculation: {
                ...existingSummary(current),
                kitCode: kit.code,
                kitDescription: current.kitDescription,
                priceListName: list.name,
                customerId: customer.id,
                customerName: customer.legalName,
                customerClass: customer.customerClass,
              },
              createdVersion: false,
              customerLinked: link.count > 0,
            },
          };
        }

        const latest = await transaction.calculationVersion.aggregate({
          where: { kitCalculationSeriesId: series.id },
          _max: { version: true },
        });
        if (current) {
          await transaction.calculationVersion.updateMany({
            where: { kitCalculationSeriesId: series.id, current: true },
            data: { current: false },
          });
        }

        let kitImageId = kit.currentImageId;
        if (processedImage) {
          const assetId = await createMediaAsset(transaction, processedImage, context.actor.id);
          const updatedKit = await transaction.kit.updateMany({
            where: { id: kit.id, currentImageId: kit.currentImageId },
            data: { currentImageId: assetId },
          });
          if (updatedKit.count !== 1) {
            throw new AppError(
              409,
              'KIT_IMAGE_CHANGED',
              'A foto atual do kit mudou durante o salvamento. Tente novamente.',
            );
          }
          await transaction.auditLog.create({
            data: {
              actorUserId: context.actor.id,
              action: kit.currentImageId ? 'MEDIA_REPLACED' : 'MEDIA_ADDED',
              entityType: 'KIT',
              entityId: kit.id,
              requestId: context.requestId,
              metadata: {
                previousAssetId: kit.currentImageId,
                newAssetId: assetId,
                origin: 'CALCULATION',
              },
            },
          });
          kitImageId = assetId;
        }

        const products = new Map<string, string>();
        for (const item of computed.process.items) {
          const product = await transaction.product.upsert({
            where: { code: item.code },
            update: { description: item.description, unit: item.unit, lastSeenAt: new Date() },
            create: { code: item.code, description: item.description, unit: item.unit },
          });
          products.set(item.code, product.id);
        }
        const [legacySeries, legacyVersion] = await Promise.all([
          transaction.kitPriceList.findUnique({ where: { id: series.id }, select: { id: true } }),
          transaction.priceMatrixVersion.findUnique({
            where: { id: options.expectedPriceListVersionId },
            select: { id: true },
          }),
        ]);
        const calculation = await transaction.calculationVersion.create({
          data: {
            priceListId: legacySeries?.id ?? null,
            matrixVersionId: legacyVersion?.id ?? null,
            kitCalculationSeriesId: series.id,
            priceListVersionId: options.expectedPriceListVersionId,
            version: (latest._max.version ?? 0) + 1,
            current: true,
            kitDescription: computed.preview.kitDescription,
            sourceFileName: upload.fileName,
            sourceFileSize: upload.buffer.length,
            sourceFileHash: upload.fileHash,
            minimumTotal: new Prisma.Decimal(String(computed.preview.minimumTotal)),
            normalTotal: new Prisma.Decimal(String(computed.preview.normalTotal)),
            itemCount: computed.preview.itemCount,
            missingPriceCount: computed.preview.missingPriceCount,
            origin: current ? 'MANUAL_RECALCULATION' : 'FIRST_CALCULATION',
            kitImageId,
            createdByUserId: context.actor.id,
            items: {
              createMany: {
                data: computed.preview.items.map((item) => ({
                  productId: products.get(item.code)!,
                  lineNumber: item.lineNumber,
                  productCode: item.code,
                  description: item.description,
                  quantity: new Prisma.Decimal(String(item.quantity)),
                  unit: item.unit,
                  minimumUnitPrice: new Prisma.Decimal(String(item.minimumUnitPrice)),
                  normalUnitPrice: new Prisma.Decimal(String(item.normalUnitPrice)),
                  minimumTotal: new Prisma.Decimal(String(item.minimumTotal)),
                  normalTotal: new Prisma.Decimal(String(item.normalTotal)),
                  hasPrice: item.hasPrice,
                })),
              },
            },
            customers: { create: customerSnapshot },
          },
          include: {
            priceListVersion: { select: { id: true, version: true } },
            createdBy: { select: { name: true } },
            kitImage: { select: { id: true, width: true, height: true, createdAt: true } },
          },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: context.actor.id,
            action: current ? 'CALCULATION_RECALCULATED' : 'CALCULATION_CREATED',
            entityType: 'calculation_version',
            entityId: calculation.id,
            metadata: {
              kitCode: kit.code,
              priceListId: list.id,
              priceListCode: list.code,
              version: calculation.version,
              priceListVersion: calculation.priceListVersion.version,
              customerId: customer.id,
              customerClassCode: customer.customerClass.code,
              previousKitImageId: kit.currentImageId,
              kitImageId,
            },
            requestId: context.requestId,
          },
        });
        const summary: SavedCalculationSummary = {
          ...existingSummary(calculation),
          kitCode: kit.code,
          kitDescription: calculation.kitDescription,
          priceListName: list.name,
          customerId: customer.id,
          customerName: customer.legalName,
          customerClass: customer.customerClass,
        };
        return { data: { calculation: summary, createdVersion: true, customerLinked: true } };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          409,
          'CALCULATION_SAVE_CONFLICT',
          'Outro cÃ¡lculo foi salvo ao mesmo tempo. Atualize a prÃ©via e tente novamente.',
        );
      }
      throw error;
    }
  }
}
