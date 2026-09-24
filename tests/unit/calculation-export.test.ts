import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  createCalculationPdf,
  createCalculationWorkbook,
  type CalculationExportData,
  type PreparedExportImage,
} from '../../src/web/calculation-export.js';

const data: CalculationExportData = {
  kitCode: '00130001',
  kitDescription: 'KIT CONDENSADOR',
  calculationVersion: 2,
  priceListName: 'Implementador',
  priceListVersion: 7,
  createdAt: '2026-09-15T17:32:00.000Z',
  createdBy: 'Samara',
  minimumTotal: 4287.5,
  normalTotal: 5130,
  itemCount: 1,
  missingPriceCount: 0,
  items: [
    {
      code: '000704001',
      description: 'PARAFUSO REAL',
      quantity: 2.5,
      unit: 'UN',
      minimumUnitPrice: 1715,
      minimumTotal: 4287.5,
      normalUnitPrice: 2052,
      normalTotal: 5130,
      hasPrice: true,
    },
  ],
};

const image: PreparedExportImage = {
  dataUrl:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  extension: 'png',
  width: 1200,
  height: 900,
};

describe('exportações de cálculo', () => {
  it('gera um workbook xlsx real com imagem e valores numéricos', async () => {
    const bytes = await createCalculationWorkbook(data, image);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const sheet = workbook.getWorksheet('Cálculo');

    expect(sheet).toBeDefined();
    expect(sheet!.getCell('C4').value).toBeInstanceOf(Date);
    expect(sheet!.getCell('C8').value).toBe(2.5);
    expect(sheet!.getCell('F8').value).toBe(4287.5);
    expect(sheet!.getCell('H8').value).toBe(5130);
    expect(sheet!.views[0]).toMatchObject({ state: 'frozen', ySplit: 7 });
    expect(sheet!.pageSetup.printArea).toBe('A1:H9');

    const archive = await JSZip.loadAsync(bytes);
    expect(archive.file('xl/media/image1.png')).not.toBeNull();
    expect(archive.file('xl/drawings/_rels/drawing1.xml.rels')).not.toBeNull();
  });

  it('continua gerando workbook e PDF sem foto e pagina o documento extenso', async () => {
    const workbookBytes = await createCalculationWorkbook(data, null);
    const workbook = new ExcelJS.Workbook();
    await expect(workbook.xlsx.load(workbookBytes)).resolves.toBeDefined();

    const manyItems = Array.from({ length: 70 }, (_, index) => ({
      ...data.items[0]!,
      code: String(index + 1).padStart(9, '0'),
    }));
    const pdf = createCalculationPdf(
      { ...data, itemCount: manyItems.length, items: manyItems },
      null,
    );
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1);
    expect(pdf.output('arraybuffer').byteLength).toBeGreaterThan(1_000);
    if (process.env.PDF_QA_MULTIPAGE_OUTPUT)
      await writeFile(process.env.PDF_QA_MULTIPAGE_OUTPUT, Buffer.from(pdf.output('arraybuffer')));
  });
});
