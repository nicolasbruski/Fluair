import { randomUUID } from 'node:crypto';

import { Prisma, type PrismaClient } from '@prisma/client';

import { AppError } from '../../errors/app-error.js';
import type {
  CreatePriceListRecordInput,
  ImportPriceListVersionInput,
  PriceListMutationContext,
  PriceListRecord,
  PriceListsRepository,
  PriceListVersionRecord,
  UpdatePriceListRecordInput,
} from './price-lists.types.js';

const priceListInclude = {
  classes: { include: { customerClass: true } },
  segments: { include: { customerSegment: true } },
  versions: {
    orderBy: { version: 'desc' as const },
    include: { importedBy: { select: { name: true } } },
  },
} satisfies Prisma.PriceListInclude;

type PrismaPriceListRecord = Prisma.PriceListGetPayload<{ include: typeof priceListInclude }>;

function mapPriceList(record: PrismaPriceListRecord): PriceListRecord {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    type: record.type,
    active: record.active,
    minimumOrderQuantity: record.minimumOrderQuantity,
    maximumOrderQuantity: record.maximumOrderQuantity,
    activeVersionId: record.activeVersionId,
    classes: record.classes.map(({ customerClass }) => customerClass),
    segments: record.segments.map(({ customerSegment }) => customerSegment),
    versions: record.versions,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function audit(
  context: PriceListMutationContext,
  action: string,
  entityId: string,
  metadata: Prisma.InputJsonObject,
) {
  return {
    actorUserId: context.actor.id,
    action,
    entityType: 'price_list',
    entityId,
    metadata,
    requestId: context.requestId,
  };
}

function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(409, 'PRICE_LIST_CODE_ALREADY_USED', 'O código da lista já está em uso.', {
      code: ['Escolha outro código.'],
    });
  }
  throw error;
}

export class PrismaPriceListsRepository implements PriceListsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<PriceListRecord[]> {
    const records = await this.prisma.priceList.findMany({
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      include: priceListInclude,
    });
    return records.map(mapPriceList);
  }

  async findById(id: string): Promise<PriceListRecord | null> {
    const record = await this.prisma.priceList.findUnique({
      where: { id },
      include: priceListInclude,
    });
    return record ? mapPriceList(record) : null;
  }

  findClasses(ids: string[]) {
    return this.prisma.customerClass.findMany({ where: { id: { in: ids } } });
  }

  findSegments(ids: string[]) {
    return this.prisma.customerSegment.findMany({ where: { id: { in: ids } } });
  }

  async findVersion(id: string): Promise<PriceListVersionRecord | null> {
    return this.prisma.priceListVersion.findUnique({
      where: { id },
      include: { importedBy: { select: { name: true } } },
    });
  }

  async findVersionByHash(
    priceListId: string,
    fileHash: string,
  ): Promise<PriceListVersionRecord | null> {
    return this.prisma.priceListVersion.findUnique({
      where: { priceListId_fileHash: { priceListId, fileHash } },
      include: { importedBy: { select: { name: true } } },
    });
  }

  async listVersionItems(
    versionId: string,
    query: { search: string; page: number; pageSize: number },
  ) {
    const search = query.search.trim();
    const where: Prisma.PriceListItemWhereInput = {
      priceListVersionId: versionId,
      ...(search
        ? {
            OR: [
              { productCode: { contains: search } },
              { description: { contains: search } },
              { reference: { contains: search } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.priceListItem.count({ where }),
      this.prisma.priceListItem.findMany({
        where,
        orderBy: [{ sourceRow: 'asc' }, { productCode: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          productCode: true,
          description: true,
          minimumPrice: true,
          normalPrice: true,
          reference: true,
          unitPrice: true,
          ipiRate: true,
          ipiIncluded: true,
          icmsRate: true,
          sourceRow: true,
        },
      }),
    ]);
    return { items, total };
  }

  async importVersion(
    input: ImportPriceListVersionInput,
    context: PriceListMutationContext,
  ): Promise<PriceListVersionRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT \`id\` FROM \`price_lists\` WHERE \`id\` = ${input.list.id} FOR UPDATE`,
        );
        const duplicate = await transaction.priceListVersion.findUnique({
          where: {
            priceListId_fileHash: {
              priceListId: input.list.id,
              fileHash: input.upload.fileHash,
            },
          },
          select: { version: true },
        });
        if (duplicate) {
          throw new AppError(
            409,
            'PRICE_LIST_FILE_ALREADY_IMPORTED',
            `Este arquivo já foi importado como versão ${duplicate.version}.`,
          );
        }

        const latest = await transaction.priceListVersion.aggregate({
          where: { priceListId: input.list.id },
          _max: { version: true },
        });
        const version = (latest._max.version ?? 0) + 1;
        const id = randomUUID();
        const itemRows = input.items.map((item) => ({
          id: randomUUID(),
          productCode: item.code,
          description: item.description,
          minimumPrice: 'minimumPrice' in item ? new Prisma.Decimal(item.minimumPrice) : null,
          normalPrice: 'normalPrice' in item ? new Prisma.Decimal(item.normalPrice) : null,
          reference: 'reference' in item ? item.reference : null,
          unitPrice: 'unitPrice' in item ? new Prisma.Decimal(item.unitPrice) : null,
          ipiRate: 'ipiRate' in item ? new Prisma.Decimal(item.ipiRate) : null,
          ipiIncluded: 'ipiIncluded' in item ? item.ipiIncluded : null,
          icmsRate: 'icmsRate' in item ? new Prisma.Decimal(item.icmsRate) : new Prisma.Decimal(0),
          sourceRow: item.sourceRow,
          rawData: item.rawData,
        }));

        if (input.list.type === 'STANDALONE_PRODUCT') {
          for (const item of input.items) {
            if (!('unitPrice' in item)) {
              throw new AppError(
                422,
                'PRICE_LIST_ITEM_TYPE_MISMATCH',
                'Um item não corresponde ao tipo da lista.',
              );
            }
            await transaction.product.upsert({
              where: { code: item.code },
              update: {
                description: item.description || item.code,
                reference: item.reference || null,
                lastSeenAt: new Date(),
              },
              create: {
                code: item.code,
                description: item.description || item.code,
                reference: item.reference || null,
                unit: null,
              },
            });
          }
        }

        const created = await transaction.priceListVersion.create({
          data: {
            id,
            priceListId: input.list.id,
            version,
            fileName: input.upload.fileName,
            mimeType: input.upload.mimeType,
            fileSize: input.upload.buffer.length,
            fileHash: input.upload.fileHash,
            sourceFile: Uint8Array.from(input.upload.buffer),
            itemCount: input.items.length,
            importedByUserId: context.actor.id,
            items: { createMany: { data: itemRows } },
          },
          include: { importedBy: { select: { name: true } } },
        });

        // Listas migradas continuam legíveis pela aplicação anterior durante o rollback.
        if (input.list.type === 'KIT_COMPONENT') {
          const legacyProfile = await transaction.priceProfile.findUnique({
            where: { id: input.list.id },
            select: { id: true },
          });
          if (legacyProfile) {
            const legacyItems = input.items.map((item, index) => {
              if (!('minimumPrice' in item)) {
                throw new AppError(
                  422,
                  'PRICE_LIST_ITEM_TYPE_MISMATCH',
                  'Um item não corresponde ao tipo da lista.',
                );
              }
              return {
                id: itemRows[index]!.id,
                productCode: item.code,
                minimumPrice: new Prisma.Decimal(item.minimumPrice),
                normalPrice: new Prisma.Decimal(item.normalPrice),
                sourceRow: item.sourceRow,
                rawData: item.rawData,
              };
            });
            await transaction.priceMatrixVersion.create({
              data: {
                id,
                profileId: input.list.id,
                version,
                fileName: input.upload.fileName,
                mimeType: input.upload.mimeType,
                fileSize: input.upload.buffer.length,
                fileHash: input.upload.fileHash,
                sourceFile: Uint8Array.from(input.upload.buffer),
                itemCount: input.items.length,
                importedByUserId: context.actor.id,
                items: { createMany: { data: legacyItems } },
              },
            });
            await transaction.priceProfile.update({
              where: { id: legacyProfile.id },
              data: { activeMatrixVersionId: id },
            });
          }
        }

        await transaction.priceList.update({
          where: { id: input.list.id },
          data: { activeVersionId: id },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId: context.actor.id,
            action: 'PRICE_LIST_VERSION_IMPORTED',
            entityType: 'price_list_version',
            entityId: id,
            metadata: {
              priceListId: input.list.id,
              version,
              fileHash: input.upload.fileHash,
              itemCount: input.items.length,
              warningCodes: input.warnings.map(({ code }) => code),
            },
            requestId: context.requestId,
          },
        });
        return created;
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          409,
          'PRICE_LIST_IMPORT_CONFLICT',
          'O arquivo já foi importado ou outra importação ocorreu ao mesmo tempo.',
        );
      }
      throw error;
    }
  }

  async create(
    input: CreatePriceListRecordInput,
    context: PriceListMutationContext,
  ): Promise<string> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.priceList.create({
          data: {
            code: input.code,
            name: input.name,
            type: input.type,
            active: input.active,
            minimumOrderQuantity: input.minimumOrderQuantity,
            maximumOrderQuantity: input.maximumOrderQuantity,
            ...(input.customerClassIds.length > 0
              ? {
                  classes: {
                    createMany: {
                      data: input.customerClassIds.map((customerClassId) => ({ customerClassId })),
                    },
                  },
                }
              : {}),
            ...(input.customerSegmentIds.length > 0
              ? {
                  segments: {
                    createMany: {
                      data: input.customerSegmentIds.map((customerSegmentId) => ({
                        customerSegmentId,
                      })),
                    },
                  },
                }
              : {}),
          },
          select: { id: true },
        });
        await transaction.auditLog.create({
          data: audit(context, 'PRICE_LIST_CREATED', created.id, {
            code: input.code,
            type: input.type,
          }),
        });
        return created.id;
      });
    } catch (error) {
      translateUnique(error);
    }
  }

  async update(
    id: string,
    input: UpdatePriceListRecordInput,
    context: PriceListMutationContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const data: Prisma.PriceListUpdateInput = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.minimumOrderQuantity !== undefined)
        data.minimumOrderQuantity = input.minimumOrderQuantity;
      if (input.maximumOrderQuantity !== undefined)
        data.maximumOrderQuantity = input.maximumOrderQuantity;
      await transaction.priceList.update({ where: { id }, data });
      if (input.customerClassIds) {
        await transaction.priceListClass.deleteMany({ where: { priceListId: id } });
        if (input.customerClassIds.length > 0)
          await transaction.priceListClass.createMany({
            data: input.customerClassIds.map((customerClassId) => ({
              priceListId: id,
              customerClassId,
            })),
          });
      }
      if (input.customerSegmentIds) {
        await transaction.priceListSegment.deleteMany({ where: { priceListId: id } });
        if (input.customerSegmentIds.length > 0)
          await transaction.priceListSegment.createMany({
            data: input.customerSegmentIds.map((customerSegmentId) => ({
              priceListId: id,
              customerSegmentId,
            })),
          });
      }
      await transaction.auditLog.create({
        data: audit(context, 'PRICE_LIST_UPDATED', id, {
          fields: Object.keys(input),
        }),
      });
    });
  }

  async setActive(id: string, active: boolean, context: PriceListMutationContext): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.priceList.update({ where: { id }, data: { active } }),
      this.prisma.auditLog.create({
        data: audit(context, active ? 'PRICE_LIST_ACTIVATED' : 'PRICE_LIST_DEACTIVATED', id, {
          active,
        }),
      }),
    ]);
  }

  async setActiveVersion(
    id: string,
    versionId: string | null,
    context: PriceListMutationContext,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.priceList.update({ where: { id }, data: { activeVersionId: versionId } }),
      this.prisma.auditLog.create({
        data: audit(context, 'PRICE_LIST_ACTIVE_VERSION_CHANGED', id, { versionId }),
      }),
    ]);
  }
}
