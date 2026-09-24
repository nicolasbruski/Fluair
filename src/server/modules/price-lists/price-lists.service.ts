import type {
  CreatePriceListInput,
  PriceListDto,
  PriceListEnvelope,
  PriceListImportEnvelope,
  PriceListImportPreviewEnvelope,
  PriceListStructureEnvelope,
  PriceListsEnvelope,
  PriceListTypeCode,
  SpreadsheetDiagnostic,
  UpdatePriceListInput,
} from '../../../shared/pricing.js';
import { isOrderQuantityInRange } from '../../../shared/order-quantity.js';
import { AppError } from '../../errors/app-error.js';
import { parsePriceListWorkbook, SpreadsheetError } from '../pricing/spreadsheet-parser.js';
import type { UploadedSpreadsheet } from '../pricing/upload.js';
import type {
  PriceListMutationContext,
  PriceListRecord,
  PriceListsRepository,
} from './price-lists.types.js';

export interface PriceListAudienceInput {
  customerClassIds: readonly string[];
  customerSegmentIds: readonly string[];
}

export interface PriceListPolicyInput {
  id?: string;
  type: PriceListTypeCode;
  active: boolean;
  minimumOrderQuantity: number | null;
  maximumOrderQuantity: number | null;
  activeVersionId: string | null;
  customerClassIds: readonly string[];
  customerSegmentIds: readonly string[];
}

function unique(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

function toDto(record: PriceListRecord): PriceListDto {
  const versions = record.versions.map(versionToDto);
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    type: record.type,
    active: record.active,
    minimumOrderQuantity: record.minimumOrderQuantity,
    maximumOrderQuantity: record.maximumOrderQuantity,
    customerClasses: record.classes,
    customerSegments: record.segments,
    activeVersion: versions.find(({ id }) => id === record.activeVersionId) ?? null,
    versions,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function versionToDto(version: PriceListRecord['versions'][number]) {
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

function spreadsheetFieldErrors(diagnostics: SpreadsheetDiagnostic[]): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const diagnostic of diagnostics) {
    const location = diagnostic.row ? `row${diagnostic.row}` : 'file';
    const field = diagnostic.field ? `${location}.${diagnostic.field}` : location;
    (fields[field] ??= []).push(diagnostic.message);
  }
  return fields;
}

export class PriceListsService {
  constructor(private readonly repository?: PriceListsRepository) {}

  validateAudience(type: PriceListTypeCode, audience: PriceListAudienceInput): void {
    if (type === 'KIT_COMPONENT' && audience.customerSegmentIds.length > 0) {
      throw new AppError(
        422,
        'PRICE_LIST_SEGMENTS_NOT_ALLOWED',
        'Listas de componentes podem ser associadas somente a classes de clientes.',
        { customerSegmentIds: ['Remova os segmentos da lista de componentes.'] },
      );
    }

    if (type === 'STANDALONE_PRODUCT' && audience.customerClassIds.length > 0) {
      throw new AppError(
        422,
        'PRICE_LIST_CLASSES_NOT_ALLOWED',
        'Listas de produtos avulsos podem ser associadas somente a segmentos de clientes.',
        { customerClassIds: ['Remova as classes da lista de produtos avulsos.'] },
      );
    }
  }

  validateRange(minimum: number | null, maximum: number | null): void {
    if ((minimum !== null && minimum < 0) || (maximum !== null && maximum < 0)) {
      throw new AppError(422, 'PRICE_LIST_RANGE_NEGATIVE', 'A faixa não pode ser negativa.');
    }
    if (minimum !== null && maximum !== null && minimum > maximum) {
      throw new AppError(
        422,
        'PRICE_LIST_RANGE_INVERTED',
        'A quantidade mínima não pode superar a máxima.',
      );
    }
  }

  assertUsable(
    list: PriceListPolicyInput | null,
    options: { expectedType?: PriceListTypeCode; requireActiveVersion?: boolean } = {},
  ): asserts list is PriceListPolicyInput {
    if (!list) throw new AppError(404, 'PRICE_LIST_NOT_FOUND', 'Lista de preço não encontrada.');
    if (options.expectedType && list.type !== options.expectedType) {
      throw new AppError(422, 'PRICE_LIST_TYPE_MISMATCH', 'A lista não possui o tipo exigido.');
    }
    if (!list.active) {
      throw new AppError(422, 'PRICE_LIST_INACTIVE', 'A lista de preço está inativa.');
    }
    if (options.requireActiveVersion && !list.activeVersionId) {
      throw new AppError(
        422,
        'PRICE_LIST_ACTIVE_VERSION_REQUIRED',
        'A lista não possui versão ativa.',
      );
    }
  }

  assertQuantityAllowed(list: PriceListPolicyInput, totalQuantity: number): void {
    if (!Number.isInteger(totalQuantity) || totalQuantity < 0) {
      throw new AppError(
        422,
        'PRICE_LIST_QUANTITY_INVALID',
        'A quantidade total deve ser um inteiro não negativo.',
      );
    }
    if (
      !isOrderQuantityInRange(totalQuantity, list.minimumOrderQuantity, list.maximumOrderQuantity)
    ) {
      throw new AppError(
        422,
        'PRICE_LIST_QUANTITY_OUT_OF_RANGE',
        'A quantidade total não pertence à faixa da lista selecionada.',
      );
    }
  }

  assertClassAllowed(list: PriceListPolicyInput, customerClassId: string | null): void {
    if (!customerClassId) {
      throw new AppError(422, 'CUSTOMER_CLASS_REQUIRED', 'O cliente não possui classe definida.');
    }
    if (!list.customerClassIds.includes(customerClassId)) {
      throw new AppError(
        422,
        'PRICE_LIST_CLASS_NOT_ALLOWED',
        'A classe do cliente não está autorizada para esta lista.',
      );
    }
  }

  assertSegmentAllowed(list: PriceListPolicyInput, customerSegmentId: string | null): void {
    if (!customerSegmentId) {
      throw new AppError(
        422,
        'CUSTOMER_SEGMENT_REQUIRED',
        'O cliente não possui segmento definido.',
      );
    }
    if (!list.customerSegmentIds.includes(customerSegmentId)) {
      throw new AppError(
        422,
        'PRICE_LIST_SEGMENT_NOT_ALLOWED',
        'O segmento do cliente não está autorizado para esta lista.',
      );
    }
  }

  async list(): Promise<PriceListsEnvelope> {
    return { data: { priceLists: (await this.requireRepository().list()).map(toDto) } };
  }

  async structure(
    id: string,
    query: { search: string; page: number; pageSize: number },
  ): Promise<PriceListStructureEnvelope> {
    const list = await this.requireList(id);
    if (!list.activeVersionId) {
      throw new AppError(
        422,
        'PRICE_LIST_ACTIVE_VERSION_REQUIRED',
        'A lista não possui versão ativa para visualizar.',
      );
    }
    const version = list.versions.find(({ id: versionId }) => versionId === list.activeVersionId);
    if (!version) {
      throw new AppError(404, 'PRICE_LIST_VERSION_NOT_FOUND', 'Versão ativa não encontrada.');
    }
    const result = await this.requireRepository().listVersionItems(list.activeVersionId, query);
    return {
      data: {
        priceList: { id: list.id, code: list.code, name: list.name, type: list.type },
        version: versionToDto(version),
        items: result.items.map((item) => ({
          code: item.productCode,
          description: item.description ?? '',
          minimumPrice: item.minimumPrice?.toString() ?? null,
          normalPrice: item.normalPrice?.toString() ?? null,
          reference: item.reference,
          unitPrice: item.unitPrice?.toString() ?? null,
          ipiRate: item.ipiRate?.toString() ?? null,
          ipiIncluded: item.ipiIncluded,
          icmsRate: item.icmsRate.toString(),
          sourceRow: item.sourceRow,
        })),
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
      },
    };
  }

  async create(
    input: CreatePriceListInput,
    context: PriceListMutationContext,
  ): Promise<PriceListEnvelope> {
    const repository = this.requireRepository();
    const customerClassIds = unique(input.customerClassIds ?? []);
    const customerSegmentIds = unique(input.customerSegmentIds ?? []);
    this.validateAudience(input.type, { customerClassIds, customerSegmentIds });
    this.validateRange(input.minimumOrderQuantity ?? null, input.maximumOrderQuantity ?? null);
    await this.validateClassifications(customerClassIds, customerSegmentIds);
    const id = await repository.create(
      {
        code: input.code,
        name: input.name,
        type: input.type,
        active: input.active ?? true,
        minimumOrderQuantity: input.minimumOrderQuantity ?? null,
        maximumOrderQuantity: input.maximumOrderQuantity ?? null,
        customerClassIds,
        customerSegmentIds,
      },
      context,
    );
    return { data: { priceList: toDto(await this.requireList(id)) } };
  }

  async update(
    id: string,
    input: UpdatePriceListInput,
    context: PriceListMutationContext,
  ): Promise<PriceListEnvelope> {
    const current = await this.requireList(id);
    const customerClassIds = input.customerClassIds
      ? unique(input.customerClassIds)
      : current.classes.map(({ id: classId }) => classId);
    const customerSegmentIds = input.customerSegmentIds
      ? unique(input.customerSegmentIds)
      : current.segments.map(({ id: segmentId }) => segmentId);
    const minimum =
      input.minimumOrderQuantity === undefined
        ? current.minimumOrderQuantity
        : input.minimumOrderQuantity;
    const maximum =
      input.maximumOrderQuantity === undefined
        ? current.maximumOrderQuantity
        : input.maximumOrderQuantity;
    this.validateAudience(current.type, { customerClassIds, customerSegmentIds });
    this.validateRange(minimum, maximum);
    await this.validateClassifications(
      input.customerClassIds ? customerClassIds : [],
      input.customerSegmentIds ? customerSegmentIds : [],
    );
    await this.requireRepository().update(id, input, context);
    return { data: { priceList: toDto(await this.requireList(id)) } };
  }

  async setActive(
    id: string,
    active: boolean,
    context: PriceListMutationContext,
  ): Promise<PriceListEnvelope> {
    await this.requireList(id);
    await this.requireRepository().setActive(id, active, context);
    return { data: { priceList: toDto(await this.requireList(id)) } };
  }

  async setActiveVersion(
    id: string,
    versionId: string | null,
    context: PriceListMutationContext,
  ): Promise<PriceListEnvelope> {
    await this.requireList(id);
    if (versionId) {
      const version = await this.requireRepository().findVersion(versionId);
      if (!version) {
        throw new AppError(422, 'PRICE_LIST_VERSION_NOT_FOUND', 'Versão da lista não encontrada.');
      }
      if (version.priceListId !== id) {
        throw new AppError(
          422,
          'PRICE_LIST_VERSION_MISMATCH',
          'A versão informada pertence a outra lista.',
        );
      }
    }
    await this.requireRepository().setActiveVersion(id, versionId, context);
    return { data: { priceList: toDto(await this.requireList(id)) } };
  }

  async previewImport(
    id: string,
    upload: UploadedSpreadsheet,
  ): Promise<PriceListImportPreviewEnvelope> {
    const list = await this.requireList(id);
    let itemCount = 0;
    let warnings: SpreadsheetDiagnostic[] = [];
    let errors: SpreadsheetDiagnostic[] = [];
    try {
      const parsed = parsePriceListWorkbook(list.type, upload.buffer);
      itemCount = parsed.items.length;
      warnings = parsed.warnings;
    } catch (error) {
      if (!(error instanceof SpreadsheetError)) throw error;
      errors = error.diagnostics;
    }
    if (errors.length === 0) {
      const duplicate = await this.requireRepository().findVersionByHash(id, upload.fileHash);
      if (duplicate) {
        errors.push({
          severity: 'ERROR',
          code: 'PRICE_LIST_FILE_ALREADY_IMPORTED',
          message: `Este arquivo já foi importado como versão ${duplicate.version}.`,
        });
      }
    }
    return {
      data: {
        preview: {
          priceList: { id: list.id, code: list.code, name: list.name, type: list.type },
          fileName: upload.fileName,
          fileSize: upload.buffer.length,
          fileHash: upload.fileHash,
          valid: errors.length === 0,
          itemCount,
          errors,
          warnings,
        },
      },
    };
  }

  async confirmImport(
    id: string,
    expectedFileHash: string,
    upload: UploadedSpreadsheet,
    context: PriceListMutationContext,
  ): Promise<PriceListImportEnvelope> {
    const list = await this.requireList(id);
    let parsed;
    try {
      parsed = parsePriceListWorkbook(list.type, upload.buffer);
    } catch (error) {
      if (!(error instanceof SpreadsheetError)) throw error;
      throw new AppError(422, error.code, error.message, spreadsheetFieldErrors(error.diagnostics));
    }
    if (upload.fileHash !== expectedFileHash) {
      throw new AppError(
        409,
        'PRICE_LIST_PREVIEW_HASH_MISMATCH',
        'O arquivo mudou desde a prévia. Gere uma nova prévia antes de confirmar.',
      );
    }
    if (await this.requireRepository().findVersionByHash(id, upload.fileHash)) {
      throw new AppError(
        409,
        'PRICE_LIST_FILE_ALREADY_IMPORTED',
        'Este arquivo já foi importado para a lista.',
      );
    }
    const version = await this.requireRepository().importVersion(
      { list, upload, items: parsed.items, warnings: parsed.warnings },
      context,
    );
    return {
      data: {
        imported: {
          priceListId: id,
          version: versionToDto(version),
          warnings: parsed.warnings,
        },
      },
    };
  }

  private requireRepository(): PriceListsRepository {
    if (!this.repository) throw new Error('Repositório de listas de preço não configurado.');
    return this.repository;
  }

  private async requireList(id: string): Promise<PriceListRecord> {
    const list = await this.requireRepository().findById(id);
    if (!list) throw new AppError(404, 'PRICE_LIST_NOT_FOUND', 'Lista de preço não encontrada.');
    return list;
  }

  private async validateClassifications(classIds: string[], segmentIds: string[]): Promise<void> {
    const repository = this.requireRepository();
    const [classes, segments] = await Promise.all([
      repository.findClasses(classIds),
      repository.findSegments(segmentIds),
    ]);
    if (classes.length !== classIds.length) {
      throw new AppError(422, 'PRICE_LIST_CLASS_NOT_FOUND', 'Uma classe informada não existe.');
    }
    if (classes.some(({ active }) => !active)) {
      throw new AppError(422, 'PRICE_LIST_CLASS_INACTIVE', 'Uma classe informada está inativa.');
    }
    if (segments.length !== segmentIds.length) {
      throw new AppError(422, 'PRICE_LIST_SEGMENT_NOT_FOUND', 'Um segmento informado não existe.');
    }
    if (segments.some(({ active }) => !active)) {
      throw new AppError(422, 'PRICE_LIST_SEGMENT_INACTIVE', 'Um segmento informado está inativo.');
    }
  }
}
