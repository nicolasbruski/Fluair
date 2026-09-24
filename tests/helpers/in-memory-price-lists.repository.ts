import type {
  CreatePriceListRecordInput,
  ImportPriceListVersionInput,
  PriceListMutationContext,
  PriceListRecord,
  PriceListsRepository,
  PriceListVersionRecord,
  UpdatePriceListRecordInput,
} from '../../src/server/modules/price-lists/price-lists.types.js';
import { AppError } from '../../src/server/errors/app-error.js';

export const listClass = {
  id: '30000000-0000-4000-8000-000000000001',
  code: 'IMPLEMENTER',
  name: 'Implementador',
  active: true,
};
export const listSegment = {
  id: '40000000-0000-4000-8000-000000000001',
  code: 'AUTO_PARTS',
  name: 'Autopeças',
  active: true,
};
export const inactiveListSegment = {
  id: '40000000-0000-4000-8000-000000000002',
  code: 'INACTIVE',
  name: 'Inativo',
  active: false,
};
export const firstListVersion: PriceListVersionRecord = {
  id: '70000000-0000-4000-8000-000000000001',
  priceListId: '60000000-0000-4000-8000-000000000001',
  version: 1,
  fileName: 'matriz.xlsx',
  fileSize: 123,
  fileHash: 'a'.repeat(64),
  itemCount: 2,
  importedBy: { name: 'Administradora' },
  createdAt: new Date('2026-09-13T12:00:00.000Z'),
};
export const secondListVersion: PriceListVersionRecord = {
  ...firstListVersion,
  id: '70000000-0000-4000-8000-000000000002',
  priceListId: '60000000-0000-4000-8000-000000000002',
};

const initialList: PriceListRecord = {
  id: firstListVersion.priceListId,
  code: 'IMPLEMENTER',
  name: 'Implementador',
  type: 'KIT_COMPONENT',
  active: true,
  minimumOrderQuantity: null,
  maximumOrderQuantity: null,
  activeVersionId: firstListVersion.id,
  classes: [listClass],
  segments: [],
  versions: [firstListVersion],
  createdAt: new Date('2026-09-13T10:00:00.000Z'),
  updatedAt: new Date('2026-09-13T12:00:00.000Z'),
};

export class InMemoryPriceListsRepository implements PriceListsRepository {
  readonly lists: PriceListRecord[] = [structuredClone(initialList)];
  readonly classes = [listClass];
  readonly segments = [listSegment, inactiveListSegment];
  readonly versions = [firstListVersion, secondListVersion];
  readonly audits: Array<{ action: string; entityId: string; requestId: string }> = [];
  readonly versionItems = new Map<string, ImportPriceListVersionInput['items']>();
  readonly products = new Map<
    string,
    { code: string; description: string; reference: string | null; unit: string | null }
  >();
  failNextImportAfterWrite = false;

  async list(): Promise<PriceListRecord[]> {
    return [...this.lists].sort(
      (left, right) => left.name.localeCompare(right.name) || left.code.localeCompare(right.code),
    );
  }

  async findById(id: string): Promise<PriceListRecord | null> {
    return this.lists.find((list) => list.id === id) ?? null;
  }

  async findClasses(ids: string[]) {
    return this.classes.filter(({ id }) => ids.includes(id));
  }

  async findSegments(ids: string[]) {
    return this.segments.filter(({ id }) => ids.includes(id));
  }

  async findVersion(id: string): Promise<PriceListVersionRecord | null> {
    return this.versions.find((version) => version.id === id) ?? null;
  }

  async findVersionByHash(
    priceListId: string,
    fileHash: string,
  ): Promise<PriceListVersionRecord | null> {
    return (
      this.versions.find(
        (version) => version.priceListId === priceListId && version.fileHash === fileHash,
      ) ?? null
    );
  }

  async listVersionItems(
    versionId: string,
    query: { search: string; page: number; pageSize: number },
  ) {
    const search = query.search.toLocaleLowerCase('pt-BR');
    const source = (this.versionItems.get(versionId) ?? []).filter(
      (item) =>
        !search ||
        item.code.toLocaleLowerCase('pt-BR').includes(search) ||
        item.description.toLocaleLowerCase('pt-BR').includes(search) ||
        ('reference' in item && item.reference.toLocaleLowerCase('pt-BR').includes(search)),
    );
    const start = (query.page - 1) * query.pageSize;
    return {
      total: source.length,
      items: source.slice(start, start + query.pageSize).map((item) => ({
        productCode: item.code,
        description: item.description,
        minimumPrice: 'minimumPrice' in item ? { toString: () => String(item.minimumPrice) } : null,
        normalPrice: 'normalPrice' in item ? { toString: () => String(item.normalPrice) } : null,
        reference: 'reference' in item ? item.reference : null,
        unitPrice: 'unitPrice' in item ? { toString: () => String(item.unitPrice) } : null,
        ipiRate: 'ipiRate' in item ? { toString: () => String(item.ipiRate) } : null,
        ipiIncluded: 'ipiIncluded' in item ? item.ipiIncluded : null,
        icmsRate: { toString: () => String('icmsRate' in item ? item.icmsRate : 0) },
        sourceRow: item.sourceRow,
      })),
    };
  }

  async importVersion(
    input: ImportPriceListVersionInput,
    context: PriceListMutationContext,
  ): Promise<PriceListVersionRecord> {
    if (await this.findVersionByHash(input.list.id, input.upload.fileHash)) {
      throw new AppError(
        409,
        'PRICE_LIST_FILE_ALREADY_IMPORTED',
        'Este arquivo já foi importado para a lista.',
      );
    }
    const list = this.lists.find(({ id }) => id === input.list.id)!;
    const previousActiveVersionId = list.activeVersionId;
    const previousAuditCount = this.audits.length;
    const previousProducts = structuredClone(this.products);
    const version: PriceListVersionRecord = {
      id: `70000000-0000-4000-8000-${String(this.versions.length + 1).padStart(12, '0')}`,
      priceListId: list.id,
      version:
        Math.max(
          0,
          ...this.versions
            .filter(({ priceListId }) => priceListId === list.id)
            .map(({ version }) => version),
        ) + 1,
      fileName: input.upload.fileName,
      fileSize: input.upload.buffer.length,
      fileHash: input.upload.fileHash,
      itemCount: input.items.length,
      importedBy: { name: context.actor.name },
      createdAt: new Date(),
    };
    try {
      this.versions.push(version);
      list.versions.unshift(version);
      list.activeVersionId = version.id;
      this.versionItems.set(version.id, structuredClone(input.items));
      if (input.list.type === 'STANDALONE_PRODUCT') {
        for (const item of input.items) {
          if (!('unitPrice' in item)) continue;
          const current = this.products.get(item.code);
          this.products.set(item.code, {
            code: item.code,
            description: item.description || item.code,
            reference: item.reference || null,
            unit: current?.unit ?? null,
          });
        }
      }
      this.record('PRICE_LIST_VERSION_IMPORTED', version.id, context);
      if (this.failNextImportAfterWrite) {
        this.failNextImportAfterWrite = false;
        throw new Error('Falha simulada durante a transação.');
      }
      return version;
    } catch (error) {
      this.versions.splice(this.versions.indexOf(version), 1);
      list.versions.splice(list.versions.indexOf(version), 1);
      list.activeVersionId = previousActiveVersionId;
      this.versionItems.delete(version.id);
      this.audits.splice(previousAuditCount);
      this.products.clear();
      for (const [code, product] of previousProducts) this.products.set(code, product);
      throw error;
    }
  }

  async create(
    input: CreatePriceListRecordInput,
    context: PriceListMutationContext,
  ): Promise<string> {
    const normalizedId = `60000000-0000-4000-8000-${String(this.lists.length + 1).padStart(12, '0')}`;
    this.lists.push({
      id: normalizedId,
      code: input.code,
      name: input.name,
      type: input.type,
      active: input.active,
      minimumOrderQuantity: input.minimumOrderQuantity,
      maximumOrderQuantity: input.maximumOrderQuantity,
      activeVersionId: null,
      classes: this.classes.filter(({ id: classId }) => input.customerClassIds.includes(classId)),
      segments: this.segments.filter(({ id: segmentId }) =>
        input.customerSegmentIds.includes(segmentId),
      ),
      versions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.record('PRICE_LIST_CREATED', normalizedId, context);
    return normalizedId;
  }

  async update(
    id: string,
    input: UpdatePriceListRecordInput,
    context: PriceListMutationContext,
  ): Promise<void> {
    const list = this.lists.find((candidate) => candidate.id === id)!;
    if (input.name !== undefined) list.name = input.name;
    if (input.minimumOrderQuantity !== undefined)
      list.minimumOrderQuantity = input.minimumOrderQuantity;
    if (input.maximumOrderQuantity !== undefined)
      list.maximumOrderQuantity = input.maximumOrderQuantity;
    if (input.customerClassIds)
      list.classes = this.classes.filter(({ id: classId }) =>
        input.customerClassIds!.includes(classId),
      );
    if (input.customerSegmentIds)
      list.segments = this.segments.filter(({ id: segmentId }) =>
        input.customerSegmentIds!.includes(segmentId),
      );
    list.updatedAt = new Date();
    this.record('PRICE_LIST_UPDATED', id, context);
  }

  async setActive(id: string, active: boolean, context: PriceListMutationContext): Promise<void> {
    this.lists.find((list) => list.id === id)!.active = active;
    this.record(active ? 'PRICE_LIST_ACTIVATED' : 'PRICE_LIST_DEACTIVATED', id, context);
  }

  async setActiveVersion(
    id: string,
    versionId: string | null,
    context: PriceListMutationContext,
  ): Promise<void> {
    const list = this.lists.find((candidate) => candidate.id === id)!;
    list.activeVersionId = versionId;
    this.record('PRICE_LIST_ACTIVE_VERSION_CHANGED', id, context);
  }

  private record(action: string, entityId: string, context: PriceListMutationContext): void {
    this.audits.push({ action, entityId, requestId: context.requestId });
  }
}
