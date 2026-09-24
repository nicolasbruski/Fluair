import type { AuthenticatedUser } from '../../../shared/auth.js';
import type { PriceListTypeCode } from '../../../shared/pricing.js';
import type { SpreadsheetDiagnostic } from '../../../shared/pricing.js';
import type { PriceListItemInput } from '../pricing/spreadsheet-parser.js';
import type { UploadedSpreadsheet } from '../pricing/upload.js';

export interface PriceListClassificationRecord {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface PriceListVersionRecord {
  id: string;
  priceListId: string;
  version: number;
  fileName: string;
  fileSize: number;
  fileHash: string;
  itemCount: number;
  importedBy: { name: string };
  createdAt: Date;
}

export interface PriceListRecord {
  id: string;
  code: string;
  name: string;
  type: PriceListTypeCode;
  active: boolean;
  minimumOrderQuantity: number | null;
  maximumOrderQuantity: number | null;
  activeVersionId: string | null;
  classes: PriceListClassificationRecord[];
  segments: PriceListClassificationRecord[];
  versions: PriceListVersionRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PriceListMutationContext {
  actor: AuthenticatedUser;
  requestId: string;
}

export interface PriceListStructureItemRecord {
  productCode: string;
  description: string | null;
  minimumPrice: { toString(): string } | null;
  normalPrice: { toString(): string } | null;
  reference: string | null;
  unitPrice: { toString(): string } | null;
  ipiRate: { toString(): string } | null;
  ipiIncluded: boolean | null;
  icmsRate: { toString(): string };
  sourceRow: number;
}

export interface CreatePriceListRecordInput {
  code: string;
  name: string;
  type: PriceListTypeCode;
  active: boolean;
  minimumOrderQuantity: number | null;
  maximumOrderQuantity: number | null;
  customerClassIds: string[];
  customerSegmentIds: string[];
}

export interface UpdatePriceListRecordInput {
  name?: string | undefined;
  minimumOrderQuantity?: number | null | undefined;
  maximumOrderQuantity?: number | null | undefined;
  customerClassIds?: string[] | undefined;
  customerSegmentIds?: string[] | undefined;
}

export interface ImportPriceListVersionInput {
  list: PriceListRecord;
  upload: UploadedSpreadsheet;
  items: PriceListItemInput[];
  warnings: SpreadsheetDiagnostic[];
}

export interface PriceListsRepository {
  list(): Promise<PriceListRecord[]>;
  findById(id: string): Promise<PriceListRecord | null>;
  findClasses(ids: string[]): Promise<PriceListClassificationRecord[]>;
  findSegments(ids: string[]): Promise<PriceListClassificationRecord[]>;
  findVersion(id: string): Promise<PriceListVersionRecord | null>;
  findVersionByHash(priceListId: string, fileHash: string): Promise<PriceListVersionRecord | null>;
  listVersionItems(
    versionId: string,
    query: { search: string; page: number; pageSize: number },
  ): Promise<{ items: PriceListStructureItemRecord[]; total: number }>;
  create(input: CreatePriceListRecordInput, context: PriceListMutationContext): Promise<string>;
  update(
    id: string,
    input: UpdatePriceListRecordInput,
    context: PriceListMutationContext,
  ): Promise<void>;
  setActive(id: string, active: boolean, context: PriceListMutationContext): Promise<void>;
  setActiveVersion(
    id: string,
    versionId: string | null,
    context: PriceListMutationContext,
  ): Promise<void>;
  importVersion(
    input: ImportPriceListVersionInput,
    context: PriceListMutationContext,
  ): Promise<PriceListVersionRecord>;
}
