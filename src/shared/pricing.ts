import type { NullableImageReference } from './media.js';

export const PRICE_LIST_TYPES = ['KIT_COMPONENT', 'STANDALONE_PRODUCT'] as const;
export type PriceListTypeCode = (typeof PRICE_LIST_TYPES)[number];

export interface SpreadsheetDiagnostic {
  severity: 'ERROR' | 'WARNING';
  code: string;
  message: string;
  row?: number;
  column?: number;
  field?: string;
}

export interface PriceListAudienceSummary {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface PriceListVersionDto {
  id: string;
  version: number;
  fileName: string;
  fileSize: number;
  fileHash: string;
  itemCount: number;
  importedBy: string;
  createdAt: string;
}

export interface PriceListDto {
  id: string;
  code: string;
  name: string;
  type: PriceListTypeCode;
  active: boolean;
  minimumOrderQuantity: number | null;
  maximumOrderQuantity: number | null;
  customerClasses: PriceListAudienceSummary[];
  customerSegments: PriceListAudienceSummary[];
  activeVersion: PriceListVersionDto | null;
  versions: PriceListVersionDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PriceListsEnvelope {
  data: { priceLists: PriceListDto[] };
}

export interface PriceListEnvelope {
  data: { priceList: PriceListDto };
}

export interface PriceListImportSummary {
  priceListId: string;
  version: PriceListVersionDto;
  warnings: SpreadsheetDiagnostic[];
}

export interface PriceListImportPreview {
  priceList: Pick<PriceListDto, 'id' | 'code' | 'name' | 'type'>;
  fileName: string;
  fileSize: number;
  fileHash: string;
  valid: boolean;
  itemCount: number;
  errors: SpreadsheetDiagnostic[];
  warnings: SpreadsheetDiagnostic[];
}

export interface PriceListImportPreviewEnvelope {
  data: { preview: PriceListImportPreview };
}

export interface PriceListImportEnvelope {
  data: { imported: PriceListImportSummary };
}

export interface PriceListStructureItem {
  code: string;
  description: string;
  minimumPrice: string | null;
  normalPrice: string | null;
  reference: string | null;
  unitPrice: string | null;
  ipiRate: string | null;
  ipiIncluded: boolean | null;
  icmsRate: string;
  sourceRow: number;
}

export interface PriceListStructureEnvelope {
  data: {
    priceList: Pick<PriceListDto, 'id' | 'code' | 'name' | 'type'>;
    version: PriceListVersionDto;
    items: PriceListStructureItem[];
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreatePriceListInput {
  code: string;
  name: string;
  type: PriceListTypeCode;
  active?: boolean | undefined;
  minimumOrderQuantity?: number | null | undefined;
  maximumOrderQuantity?: number | null | undefined;
  customerClassIds?: string[] | undefined;
  customerSegmentIds?: string[] | undefined;
}

export interface UpdatePriceListInput {
  name?: string | undefined;
  minimumOrderQuantity?: number | null | undefined;
  maximumOrderQuantity?: number | null | undefined;
  customerClassIds?: string[] | undefined;
  customerSegmentIds?: string[] | undefined;
}

export interface CalculatedItem {
  lineNumber: number;
  code: string;
  description: string;
  quantity: number;
  unit: string;
  minimumUnitPrice: number;
  normalUnitPrice: number;
  minimumTotal: number;
  normalTotal: number;
  hasPrice: boolean;
}

export interface ExistingCalculationSummary {
  id: string;
  version: number;
  priceListVersion: number;
  priceListVersionId: string;
  sourceFileHash: string;
  minimumTotal: number;
  normalTotal: number;
  createdAt: string;
  createdBy: string;
  image: NullableImageReference;
}

export interface CalculationPreview {
  kitCode: string;
  kitDescription: string;
  priceList: {
    id: string;
    code: string;
    name: string;
    customerClasses: PriceListAudienceSummary[];
  };
  priceListVersion: PriceListVersionDto;
  sourceFileHash: string;
  sourceFileName: string;
  minimumTotal: number;
  normalTotal: number;
  itemCount: number;
  missingPriceCount: number;
  items: CalculatedItem[];
  existing: ExistingCalculationSummary | null;
  currentKitImage: NullableImageReference;
  image: NullableImageReference;
}

export interface CalculationPreviewEnvelope {
  data: { preview: CalculationPreview };
}

export interface SavedCalculationSummary extends ExistingCalculationSummary {
  kitCode: string;
  kitDescription: string;
  priceListName: string;
  customerId: string | null;
  customerName: string | null;
  customerClass: PriceListAudienceSummary | null;
}

export interface CalculationSaveEnvelope {
  data: {
    calculation: SavedCalculationSummary;
    createdVersion: boolean;
    customerLinked: boolean;
  };
}

export type CalculationSearchSort =
  'code' | 'description' | 'reference' | 'priceList' | 'minimumTotal' | 'normalTotal' | 'createdAt';

export interface CalculationSearchItem {
  id: string;
  kitCode: string;
  kitDescription: string;
  reference: string | null;
  priceList: { id: string; code: string; name: string };
  minimumTotal: string;
  normalTotal: string;
  version: number;
  createdAt: string;
  createdBy: string;
  current: true;
  image: NullableImageReference;
}

export interface CalculationSearchEnvelope {
  data: {
    calculations: CalculationSearchItem[];
    filters: {
      priceLists: Array<{ id: string; code: string; name: string }>;
    };
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface CalculationDetailItem {
  lineNumber: number;
  code: string;
  description: string;
  quantity: string;
  unit: string;
  minimumUnitPrice: string;
  normalUnitPrice: string;
  minimumTotal: string;
  normalTotal: string;
  hasPrice: boolean;
}

export interface CalculationLinkedCustomer {
  id: string;
  code: string;
  legalName: string;
  className: string | null;
  linkedAt: string;
  linkedBy: string;
}

export interface CalculationDetail {
  id: string;
  version: number;
  current: boolean;
  kitCode: string;
  kitDescription: string;
  priceList: { id: string; code: string; name: string };
  priceListVersion: { id: string; version: number };
  sourceFileName: string;
  sourceFileHash: string;
  minimumTotal: string;
  normalTotal: string;
  itemCount: number;
  missingPriceCount: number;
  origin: string;
  createdAt: string;
  createdBy: string;
  image: NullableImageReference;
  customers: CalculationLinkedCustomer[];
  items: CalculationDetailItem[];
}

export interface CalculationDetailEnvelope {
  data: { calculation: CalculationDetail };
}

export interface CalculationHistoryItem {
  id: string;
  version: number;
  current: boolean;
  priceListVersion: number;
  sourceFileName: string;
  sourceFileHash: string;
  minimumTotal: string;
  normalTotal: string;
  itemCount: number;
  missingPriceCount: number;
  origin: string;
  createdAt: string;
  createdBy: string;
  image: NullableImageReference;
}

export interface CalculationHistoryEnvelope {
  data: {
    kit: { code: string; description: string };
    priceList: { id: string; code: string; name: string };
    versions: CalculationHistoryItem[];
  };
}

export interface StandaloneProductCatalogItem {
  productId: string | null;
  code: string;
  description: string;
  reference: string;
  unitPrice: string;
  ipiRate: string;
  ipiIncluded: true;
  icmsRate: string;
  sourceRow: number;
  image: NullableImageReference;
}

export interface StandaloneProductCatalogEnvelope {
  data: {
    priceList: Pick<PriceListDto, 'id' | 'code' | 'name' | 'type'>;
    version: Pick<PriceListVersionDto, 'id' | 'version'>;
    products: StandaloneProductCatalogItem[];
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface StandaloneProductPriceEnvelope {
  data: {
    priceList: Pick<PriceListDto, 'id' | 'code' | 'name' | 'type'>;
    version: Pick<PriceListVersionDto, 'id' | 'version'>;
    product: StandaloneProductCatalogItem;
  };
}
