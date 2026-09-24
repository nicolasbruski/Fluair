import * as XLSX from 'xlsx';

import type { PriceListTypeCode, SpreadsheetDiagnostic } from '../../../shared/pricing.js';

export type SpreadsheetRow = unknown[];

export interface ProcessItem {
  lineNumber: number;
  operation: string;
  condition: string;
  code: string;
  description: string;
  quantity: number;
  unit: string;
}

export interface ProcessSheet {
  kitCode: string;
  kitDescription: string;
  items: ProcessItem[];
}

export interface KitComponentListItemInput {
  code: string;
  description: string;
  minimumPrice: number;
  normalPrice: number;
  sourceRow: number;
  rawData: Array<string | number | boolean | null>;
}

export type MatrixItemInput = KitComponentListItemInput;

export interface StandaloneProductListItemInput {
  code: string;
  description: string;
  reference: string;
  unitPrice: number;
  ipiRate: number;
  ipiIncluded: true;
  icmsRate: number;
  sourceRow: number;
  rawData: Array<string | number | boolean | null>;
}

export type PriceListItemInput = KitComponentListItemInput | StandaloneProductListItemInput;

export interface ParsedPriceListWorkbook<TItem extends PriceListItemInput = PriceListItemInput> {
  type: PriceListTypeCode;
  items: TItem[];
  warnings: SpreadsheetDiagnostic[];
}

export class SpreadsheetError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly diagnostics: SpreadsheetDiagnostic[] = [{ severity: 'ERROR', code, message }],
  ) {
    super(message);
    this.name = 'SpreadsheetError';
  }
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return '';
}

function normalized(value: unknown): string {
  return cellText(value)
    .replace(/\n/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function compact(value: unknown): string {
  return normalized(value).replace(/[\s.]/g, '');
}

export function numericValue(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = cellText(value).replace(/R\$/gi, '').replace(/\s/g, '').trim();
  if (!text) return 0;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (comma >= 0) {
    text = text.replace(',', '.');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rows(buffer: Buffer, raw = true): SpreadsheetRow[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new SpreadsheetError('EMPTY_WORKBOOK', 'O arquivo não possui planilhas.');
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw new SpreadsheetError('EMPTY_WORKBOOK', 'A primeira planilha está vazia.');
    return XLSX.utils.sheet_to_json<SpreadsheetRow>(sheet, {
      header: 1,
      defval: '',
      raw,
      blankrows: true,
    });
  } catch (error) {
    if (error instanceof SpreadsheetError) throw error;
    throw new SpreadsheetError(
      'INVALID_SPREADSHEET',
      'Não foi possível ler o arquivo Excel. Verifique se ele não está corrompido ou protegido.',
    );
  }
}

function safeRawRow(row: SpreadsheetRow): Array<string | number | boolean | null> {
  return row.map((value) => {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    )
      return value;
    if (value === undefined) return null;
    return cellText(value);
  });
}

export function parseProcessWorkbook(buffer: Buffer): ProcessSheet {
  const source = rows(buffer);
  let headerRow = -1;
  let kitCode = '';
  let kitDescription = '';
  let operationColumn = 0;
  let conditionColumn = 1;
  let codeColumn = 2;
  let descriptionColumn = 3;
  let quantityColumn = 5;
  let unitColumn = 6;

  for (let index = 0; index < source.length; index += 1) {
    const row = source[index] ?? [];
    if (index < 8) {
      const joined = row.map((value) => cellText(value).replace(/\n/g, ' ').trim()).join(' ');
      const codeMatch = joined
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .match(/cod\.?\s*interno:?\s*(\d+)/i);
      if (codeMatch?.[1] && !kitCode) kitCode = codeMatch[1];
      const descriptionMatch = joined
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .match(/descricao:?\s*(.+)/i);
      if (descriptionMatch?.[1] && !kitDescription) {
        kitDescription = descriptionMatch[1].trim().replace(/\s+/g, ' ').slice(0, 255);
      }
    }

    const productHeader = row.findIndex((value) => {
      const candidate = compact(value);
      return candidate.includes('codproduto') || candidate.includes('codigoproduto');
    });
    if (productHeader < 0) continue;
    headerRow = index;
    codeColumn = productHeader;
    row.forEach((value, column) => {
      const header = normalized(value);
      if (header.includes('ope')) operationColumn = column;
      else if (header.includes('condic')) conditionColumn = column;
      else if ((header.includes('cod') || header.includes('cód')) && header.includes('prod'))
        codeColumn = column;
      else if (header.includes('desc')) descriptionColumn = column;
      else if (header.includes('qtde') || header === 'quantidade') quantityColumn = column;
      else if (header === 'um' || header === 'um.') unitColumn = column;
    });
    break;
  }

  if (headerRow < 0) {
    throw new SpreadsheetError(
      'PROCESS_HEADER_NOT_FOUND',
      'Não foi encontrado o cabeçalho de produtos da folha Korp.',
    );
  }
  if (!kitCode) {
    throw new SpreadsheetError('KIT_CODE_NOT_FOUND', 'Não foi encontrado o código interno do kit.');
  }
  if (!kitDescription) kitDescription = `Kit ${kitCode}`;

  const items: ProcessItem[] = [];
  for (let index = headerRow + 1; index < source.length; index += 1) {
    const row = source[index] ?? [];
    const code = cellText(row[codeColumn]).replace(/\n/g, '').trim();
    if (!/^\d{5,7}$/.test(code)) continue;
    const quantity = numericValue(row[quantityColumn]) || 1;
    items.push({
      lineNumber: items.length + 1,
      operation: cellText(row[operationColumn]).replace(/\n/g, '').trim() || '001',
      condition: cellText(row[conditionColumn]).replace(/\n/g, '').trim() || 'P',
      code,
      description: cellText(row[descriptionColumn]).replace(/\n/g, ' ').trim().slice(0, 255),
      quantity,
      unit: cellText(row[unitColumn]).replace(/\n/g, '').trim().slice(0, 30) || 'UNID',
    });
  }
  if (items.length === 0) {
    throw new SpreadsheetError(
      'PROCESS_ITEMS_NOT_FOUND',
      'Nenhum produto válido foi encontrado na folha Korp.',
    );
  }
  return { kitCode, kitDescription, items };
}

interface HeaderColumns {
  headerRow: number;
  code: number;
  description: number;
}

interface KitHeaderColumns extends HeaderColumns {
  minimumPrice: number;
  normalPrice: number;
}

interface StandaloneHeaderColumns extends HeaderColumns {
  reference: number;
  unitPrice: number;
  ipiRate: number;
  icmsRate: number | null;
}

function isCodeHeader(value: unknown): boolean {
  const header = compact(value);
  return ['cod', 'codigo', 'codproduto', 'codigoproduto', 'coditem', 'codigoitem'].includes(header);
}

function isDescriptionHeader(value: unknown): boolean {
  return compact(value).startsWith('desc');
}

function isMinimumHeader(value: unknown): boolean {
  const header = normalized(value);
  return (
    header.includes('minima') ||
    header.includes('minimo') ||
    header.includes('diferenciada') ||
    compact(value) === 'tabdif'
  );
}

function isNormalHeader(value: unknown): boolean {
  const header = normalized(value);
  return header.includes('normal') || header.includes('padrao') || header.includes('maximo');
}

function findColumn(row: SpreadsheetRow, predicate: (value: unknown) => boolean): number {
  return row.findIndex(predicate);
}

function findKitHeader(source: SpreadsheetRow[]): KitHeaderColumns | null {
  for (let headerRow = 0; headerRow < source.length; headerRow += 1) {
    const row = source[headerRow] ?? [];
    const minimumPrice = findColumn(row, isMinimumHeader);
    const normalPrice = findColumn(row, isNormalHeader);
    if (minimumPrice < 0 || normalPrice < 0) continue;
    const explicitCode = findColumn(row, isCodeHeader);
    const explicitDescription = findColumn(row, isDescriptionHeader);
    const code = explicitCode >= 0 ? explicitCode : minimumPrice - 2;
    const description = explicitDescription >= 0 ? explicitDescription : minimumPrice - 1;
    if (code >= 0 && description >= 0)
      return { headerRow, code, description, minimumPrice, normalPrice };
  }
  return null;
}

function findStandaloneHeader(source: SpreadsheetRow[]): StandaloneHeaderColumns | null {
  for (let headerRow = 0; headerRow < source.length; headerRow += 1) {
    const row = source[headerRow] ?? [];
    const code = findColumn(row, isCodeHeader);
    const description = findColumn(row, isDescriptionHeader);
    const reference = findColumn(row, (value) => {
      const header = compact(value);
      return header === 'referencia' || header === 'ref';
    });
    const ipiRate = findColumn(row, (value) => compact(value).includes('ipi'));
    const icmsColumn = findColumn(row, (value) => compact(value).includes('icms'));
    const unitPrice = findColumn(row, (value) => {
      const header = compact(value);
      return ['valor', 'preco', 'valorunitario', 'precounitario'].includes(header);
    });
    if ([code, description, reference, unitPrice, ipiRate].every((column) => column >= 0)) {
      return {
        headerRow,
        code,
        description,
        reference,
        unitPrice,
        ipiRate,
        icmsRate: icmsColumn >= 0 ? icmsColumn : null,
      };
    }
  }
  return null;
}

function cleanedCode(value: unknown): string {
  return cellText(value)
    .replace(/[\r\n]+/g, '')
    .trim();
}

function cleanedText(value: unknown, maximum: number): string {
  return cellText(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function rowIsEmpty(row: SpreadsheetRow): boolean {
  return row.every((value) => cellText(value).trim() === '');
}

function strictNumericValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let text = cellText(value).replace(/R\$/gi, '').replace(/%/g, '').replace(/\s/g, '').trim();
  if (!text) return null;
  const comma = text.lastIndexOf(',');
  const dot = text.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    text = comma > dot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (comma >= 0) {
    text = text.replace(',', '.');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function errorDiagnostic(
  code: string,
  message: string,
  row: number,
  column: number,
  field: string,
): SpreadsheetDiagnostic {
  return { severity: 'ERROR', code, message, row, column: column + 1, field };
}

function validateCode(
  value: unknown,
  row: number,
  column: number,
  codes: Set<string>,
  errors: SpreadsheetDiagnostic[],
): string | null {
  const code = cleanedCode(value);
  if (!code || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,31}$/.test(code)) {
    errors.push(
      errorDiagnostic(
        'INVALID_PRODUCT_CODE',
        'Informe um código de produto válido com até 32 caracteres.',
        row,
        column,
        'productCode',
      ),
    );
    return null;
  }
  if (codes.has(code)) {
    errors.push(
      errorDiagnostic(
        'DUPLICATE_PRODUCT_CODE',
        `O código ${code} aparece mais de uma vez na planilha.`,
        row,
        column,
        'productCode',
      ),
    );
    return null;
  }
  codes.add(code);
  return code;
}

function validatePrice(
  value: unknown,
  row: number,
  column: number,
  field: string,
  errors: SpreadsheetDiagnostic[],
): number | null {
  const price = strictNumericValue(value);
  if (price === null) {
    errors.push(
      errorDiagnostic('INVALID_PRICE', 'Informe um valor numérico válido.', row, column, field),
    );
    return null;
  }
  if (price < 0) {
    errors.push(
      errorDiagnostic('NEGATIVE_PRICE', 'O valor não pode ser negativo.', row, column, field),
    );
    return null;
  }
  return price;
}

function throwIfInvalid(errors: SpreadsheetDiagnostic[]): void {
  if (errors.length === 0) return;
  const first = errors[0]!;
  throw new SpreadsheetError(
    first.code,
    `${errors.length} erro(s) bloqueiam a importação. ${first.message}`,
    errors,
  );
}

export function parseKitComponentWorkbook(
  buffer: Buffer,
): ParsedPriceListWorkbook<KitComponentListItemInput> {
  const source = rows(buffer);
  const columns = findKitHeader(source);
  if (!columns) {
    throw new SpreadsheetError(
      'KIT_COMPONENT_HEADER_NOT_FOUND',
      'A lista deve possuir código, descrição, valor mínimo e valor normal.',
    );
  }

  const items: KitComponentListItemInput[] = [];
  const warnings: SpreadsheetDiagnostic[] = [];
  const errors: SpreadsheetDiagnostic[] = [];
  const codes = new Set<string>();
  for (let index = columns.headerRow + 1; index < source.length; index += 1) {
    const row = source[index] ?? [];
    if (rowIsEmpty(row)) continue;
    const sourceRow = index + 1;
    const code = validateCode(row[columns.code], sourceRow, columns.code, codes, errors);
    const minimumPrice = validatePrice(
      row[columns.minimumPrice],
      sourceRow,
      columns.minimumPrice,
      'minimumPrice',
      errors,
    );
    const normalPrice = validatePrice(
      row[columns.normalPrice],
      sourceRow,
      columns.normalPrice,
      'normalPrice',
      errors,
    );
    if (code === null || minimumPrice === null || normalPrice === null) continue;
    if (minimumPrice > normalPrice) {
      warnings.push({
        severity: 'WARNING',
        code: 'MINIMUM_PRICE_ABOVE_NORMAL',
        message: `O valor mínimo do código ${code} é maior que o valor normal.`,
        row: sourceRow,
        column: columns.minimumPrice + 1,
        field: 'minimumPrice',
      });
    }
    items.push({
      code,
      description: cleanedText(row[columns.description], 255),
      minimumPrice,
      normalPrice,
      sourceRow,
      rawData: safeRawRow(row),
    });
  }
  throwIfInvalid(errors);
  if (items.length === 0) {
    throw new SpreadsheetError(
      'PRICE_LIST_ITEMS_NOT_FOUND',
      'Nenhum item válido foi encontrado na lista de componentes.',
    );
  }
  return { type: 'KIT_COMPONENT', items, warnings };
}

export function parseStandaloneProductWorkbook(
  buffer: Buffer,
): ParsedPriceListWorkbook<StandaloneProductListItemInput> {
  const source = rows(buffer);
  // O Excel armazena 3,25% como 0,0325. As células formatadas preservam a
  // escala percentual, enquanto `source` continua alimentando o rawData.
  const formattedSource = rows(buffer, false);
  const columns = findStandaloneHeader(source);
  if (!columns) {
    throw new SpreadsheetError(
      'STANDALONE_PRODUCT_HEADER_NOT_FOUND',
      'A lista deve possuir código, descrição, referência, valor e IPI.',
    );
  }

  const items: StandaloneProductListItemInput[] = [];
  const errors: SpreadsheetDiagnostic[] = [];
  const codes = new Set<string>();
  for (let index = columns.headerRow + 1; index < source.length; index += 1) {
    const row = source[index] ?? [];
    const formattedRow = formattedSource[index] ?? [];
    if (rowIsEmpty(row)) continue;
    const sourceRow = index + 1;
    const code = validateCode(row[columns.code], sourceRow, columns.code, codes, errors);
    const unitPrice = validatePrice(
      row[columns.unitPrice],
      sourceRow,
      columns.unitPrice,
      'unitPrice',
      errors,
    );
    const ipiRate = validatePrice(
      formattedRow[columns.ipiRate],
      sourceRow,
      columns.ipiRate,
      'ipiRate',
      errors,
    );
    const icmsRate =
      columns.icmsRate === null
        ? 0
        : validatePrice(
            formattedRow[columns.icmsRate],
            sourceRow,
            columns.icmsRate,
            'icmsRate',
            errors,
          );
    if (code === null || unitPrice === null || ipiRate === null || icmsRate === null) continue;
    items.push({
      code,
      description: cleanedText(row[columns.description], 255),
      reference: cleanedText(row[columns.reference], 120),
      unitPrice,
      ipiRate,
      ipiIncluded: true,
      icmsRate,
      sourceRow,
      rawData: safeRawRow(row),
    });
  }
  throwIfInvalid(errors);
  if (items.length === 0) {
    throw new SpreadsheetError(
      'PRICE_LIST_ITEMS_NOT_FOUND',
      'Nenhum item válido foi encontrado na lista de produtos avulsos.',
    );
  }
  return { type: 'STANDALONE_PRODUCT', items, warnings: [] };
}

export function parsePriceListWorkbook(
  type: 'KIT_COMPONENT',
  buffer: Buffer,
): ParsedPriceListWorkbook<KitComponentListItemInput>;
export function parsePriceListWorkbook(
  type: 'STANDALONE_PRODUCT',
  buffer: Buffer,
): ParsedPriceListWorkbook<StandaloneProductListItemInput>;
export function parsePriceListWorkbook(
  type: PriceListTypeCode,
  buffer: Buffer,
): ParsedPriceListWorkbook;
export function parsePriceListWorkbook(
  type: PriceListTypeCode,
  buffer: Buffer,
): ParsedPriceListWorkbook {
  return type === 'KIT_COMPONENT'
    ? parseKitComponentWorkbook(buffer)
    : parseStandaloneProductWorkbook(buffer);
}
