import { Buffer } from 'node:buffer';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  numericValue,
  parseKitComponentWorkbook,
  parsePriceListWorkbook,
  parseProcessWorkbook,
  parseStandaloneProductWorkbook,
  SpreadsheetError,
} from '../../src/server/modules/pricing/spreadsheet-parser.js';

function workbook(rows: unknown[][]): Buffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Dados');
  const output = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
  return Buffer.from(output);
}

function workbookWithExcelPercentages(): Buffer {
  const book = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Código', 'Descrição', 'Referência', 'Valor', 'IPI', 'ICMS'],
    ['PRD_01', 'Produto', 'REF', 10, 0.0325, 0.18],
  ]);
  sheet.E2!.z = '0.00%';
  sheet.F2!.z = '0.00%';
  XLSX.utils.book_append_sheet(book, sheet, 'Dados');
  const output = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Uint8Array;
  return Buffer.from(output);
}

function expectSpreadsheetError(operation: () => unknown, code: string): void {
  try {
    operation();
    expect.fail('A planilha deveria ser rejeitada.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(SpreadsheetError);
    expect(error).toMatchObject({ code });
  }
}

describe('parser de planilhas de preço', () => {
  it('lê a folha Korp mantendo a estrutura usada pelo cálculo legado', () => {
    const result = parseProcessWorkbook(
      workbook([
        ['Cód. Interno: 130001 Descrição: KIT TESTE'],
        [],
        ['Ope.', 'Condição', 'Cód. Produto', 'Descrição Produto', '', 'Qtde.', 'UM'],
        ['001', 'P', '12345', 'COMPONENTE A', '', 2.5, 'UN'],
        ['002', 'P', '678901', 'COMPONENTE B', '', '3,5', 'PC'],
      ]),
    );

    expect(result.kitCode).toBe('130001');
    expect(result.kitDescription).toContain('KIT TESTE');
    expect(result.items).toEqual([
      expect.objectContaining({ code: '12345', quantity: 2.5, unit: 'UN' }),
      expect.objectContaining({ code: '678901', quantity: 3.5, operation: '002' }),
    ]);
  });

  it('lê preços brasileiros, preserva a linha original e rejeita códigos duplicados', () => {
    const result = parseKitComponentWorkbook(
      workbook([
        ['Código', 'Descrição', 'Tabela Diferenciada', 'Tabela Normal'],
        ['12345', 'A', '1.234,56', '2.345,67'],
        ['678901', 'B', 10.5, 12.75],
      ]),
    ).items;
    expect(result).toEqual([
      expect.objectContaining({
        code: '12345',
        minimumPrice: 1234.56,
        normalPrice: 2345.67,
        sourceRow: 2,
      }),
      expect.objectContaining({
        code: '678901',
        minimumPrice: 10.5,
        normalPrice: 12.75,
        sourceRow: 3,
      }),
    ]);

    expect(() =>
      parseKitComponentWorkbook(
        workbook([
          ['Código', 'Tabela Mínima', 'Tabela Normal'],
          ['12345', 1, 2],
          ['12345', 3, 4],
        ]),
      ),
    ).toThrowError(SpreadsheetError);
  });

  it('normaliza formatos monetários sem perder separadores de milhar', () => {
    expect(numericValue('R$ 1.234,56')).toBe(1234.56);
    expect(numericValue('1,234.56')).toBe(1234.56);
    expect(numericValue('12,5')).toBe(12.5);
  });

  it.each([
    ['Valor Mínimo', 'Valor Normal'],
    ['Tabela Mínima', 'Tabela Normal'],
    ['Tabela Diferenciada', 'Tabela Padrão'],
    ['Tab. Dif', 'Valor Máximo'],
  ])('aceita os aliases estruturados %s e %s', (minimumHeader, normalHeader) => {
    const result = parseKitComponentWorkbook(
      workbook([
        ['Código', 'Descrição', minimumHeader, normalHeader],
        ['AB-001', 'Componente sintético', 10, 20],
      ]),
    );

    expect(result).toMatchObject({
      type: 'KIT_COMPONENT',
      items: [
        {
          code: 'AB-001',
          description: 'Componente sintético',
          minimumPrice: 10,
          normalPrice: 20,
          sourceRow: 2,
        },
      ],
      warnings: [],
    });
  });

  it('aceita o cabeçalho estrutural real, ignora vazio e preserva linha, descrição e dados brutos', () => {
    const result = parseKitComponentWorkbook(
      workbook([
        ['', '', 'Valor Mínimo', 'Valor Normal'],
        [],
        ['12\n345', 'Componente\r\nsintético', '1.234,56', '2.345,67'],
      ]),
    );

    expect(result.items[0]).toMatchObject({
      code: '12345',
      description: 'Componente sintético',
      sourceRow: 3,
      rawData: ['12\n345', 'Componente\r\nsintético', '1.234,56', '2.345,67'],
    });
  });

  it('lê produto sem estrutura e mantém os impostos da lista', () => {
    const result = parseStandaloneProductWorkbook(
      workbook([
        ['Código', 'Descrição', 'Referência', 'Valor', 'IPI', 'ICMS'],
        [],
        ['PRD_01', 'Produto\nde teste', 'REF\n01', 'R$ 1.234,56', '3,25%', '12%'],
      ]),
    );

    expect(result).toEqual({
      type: 'STANDALONE_PRODUCT',
      warnings: [],
      items: [
        expect.objectContaining({
          code: 'PRD_01',
          description: 'Produto de teste',
          reference: 'REF 01',
          unitPrice: 1234.56,
          ipiRate: 3.25,
          ipiIncluded: true,
          icmsRate: 12,
          sourceRow: 3,
        }),
      ],
    });
  });

  it('mantém compatibilidade com listas anteriores sem a coluna ICMS', () => {
    const result = parseStandaloneProductWorkbook(
      workbook([
        ['Código', 'Descrição', 'Referência', 'Valor', 'IPI'],
        ['PRD_01', 'Produto', 'REF', 10, '3,25%'],
      ]),
    );

    expect(result.items[0]?.icmsRate).toBe(0);
  });

  it('preserva a escala de percentuais nativos do Excel', () => {
    const result = parseStandaloneProductWorkbook(workbookWithExcelPercentages());

    expect(result.items[0]).toMatchObject({ ipiRate: 3.25, icmsRate: 18 });
  });

  it('despacha pelo tipo informado, sem inferir pelo arquivo', () => {
    const structured = workbook([
      ['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'],
      ['12345', 'Componente', 1, 2],
    ]);

    expect(parsePriceListWorkbook('KIT_COMPONENT', structured).type).toBe('KIT_COMPONENT');
    expectSpreadsheetError(
      () => parsePriceListWorkbook('STANDALONE_PRODUCT', structured),
      'STANDALONE_PRODUCT_HEADER_NOT_FOUND',
    );
  });

  it('separa aviso confirmável de mínimo maior que normal', () => {
    const result = parseKitComponentWorkbook(
      workbook([
        ['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'],
        ['12345', 'Componente', 20, 10],
      ]),
    );

    expect(result.items).toHaveLength(1);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        severity: 'WARNING',
        code: 'MINIMUM_PRICE_ABOVE_NORMAL',
        row: 2,
        column: 3,
        field: 'minimumPrice',
      }),
    ]);
  });

  it.each([
    {
      name: 'código vazio em linha preenchida',
      rows: [['', 'Produto', 1, 2]],
      code: 'INVALID_PRODUCT_CODE',
      row: 2,
      column: 1,
    },
    {
      name: 'código inválido',
      rows: [['inválido com espaço', 'Produto', 1, 2]],
      code: 'INVALID_PRODUCT_CODE',
      row: 2,
      column: 1,
    },
    {
      name: 'código duplicado',
      rows: [
        ['12345', 'Produto A', 1, 2],
        ['12345', 'Produto B', 3, 4],
      ],
      code: 'DUPLICATE_PRODUCT_CODE',
      row: 3,
      column: 1,
    },
    {
      name: 'preço não numérico',
      rows: [['12345', 'Produto', 'não numérico', 2]],
      code: 'INVALID_PRICE',
      row: 2,
      column: 3,
    },
    {
      name: 'preço negativo',
      rows: [['12345', 'Produto', -1, 2]],
      code: 'NEGATIVE_PRICE',
      row: 2,
      column: 3,
    },
  ])('rejeita $name indicando linha e coluna', ({ rows, code, row, column }) => {
    try {
      parseKitComponentWorkbook(
        workbook([['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal'], ...rows]),
      );
      expect.fail('A planilha inválida deveria ser rejeitada.');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(SpreadsheetError);
      expect(error).toMatchObject({
        code,
        diagnostics: [expect.objectContaining({ severity: 'ERROR', code, row, column })],
      });
    }
  });

  it('rejeita arquivo vazio e IPI inválido como erro bloqueador', () => {
    expectSpreadsheetError(
      () =>
        parseKitComponentWorkbook(
          workbook([['Código', 'Descrição', 'Valor Mínimo', 'Valor Normal']]),
        ),
      'PRICE_LIST_ITEMS_NOT_FOUND',
    );
    expectSpreadsheetError(
      () =>
        parseStandaloneProductWorkbook(
          workbook([
            ['Código', 'Descrição', 'Referência', 'Valor', 'IPI'],
            ['12345', 'Produto', 'REF', 10, 'inválido'],
          ]),
        ),
      'INVALID_PRICE',
    );
  });

  it('valida localmente os quatro arquivos estruturados e os cinco avulsos sem fixar preços', () => {
    const directory = resolve(process.cwd(), 'infos-calcular');
    const files = readdirSync(directory).filter((file) => file.endsWith('.xlsx'));
    const structured = files.filter((file) => file.includes('com Estrutura'));
    const standalone = files.filter((file) => file.includes('sem estrutura'));

    expect(structured).toHaveLength(4);
    expect(standalone).toHaveLength(5);
    for (const file of structured) {
      expect(parseKitComponentWorkbook(readFileSync(resolve(directory, file))).items.length).toBe(
        66,
      );
    }
    for (const file of standalone) {
      expect(
        parseStandaloneProductWorkbook(readFileSync(resolve(directory, file))).items.length,
      ).toBe(3);
    }
  });
});
