import { jsPDF } from 'jspdf';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MONEY_FORMAT = 'R$ #,##0.00';
const NUMBER_FORMAT = '#,##0.####';

export interface CalculationExportItem {
  code: string;
  description: string;
  quantity: number;
  unit: string;
  minimumUnitPrice: number;
  minimumTotal: number;
  normalUnitPrice: number;
  normalTotal: number;
  hasPrice: boolean;
}

export interface CalculationExportData {
  kitCode: string;
  kitDescription: string;
  calculationVersion?: number;
  priceListName: string;
  priceListVersion: number;
  createdAt?: string;
  createdBy?: string;
  minimumTotal: number;
  normalTotal: number;
  itemCount: number;
  missingPriceCount: number;
  items: CalculationExportItem[];
}

export interface ExportImageSource {
  source: Blob | string;
  width?: number;
  height?: number;
}

export interface PreparedExportImage {
  dataUrl: string;
  extension: 'jpeg' | 'png';
  width: number;
  height: number;
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Imagem inválida.'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Imagem inválida.')));
    reader.readAsDataURL(blob);
  });
}

function imageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight }),
    );
    image.addEventListener('error', () => reject(new Error('Não foi possível ler a imagem.')));
    image.src = url;
  });
}

async function convertToPng(blob: Blob): Promise<PreparedExportImage> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const dimensions = await imageDimensions(objectUrl);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas indisponível.');
    context.drawImage(image, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      extension: 'png',
      ...dimensions,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareExportImage(
  input: ExportImageSource | null,
): Promise<PreparedExportImage | null> {
  if (!input) return null;
  try {
    const blob =
      typeof input.source === 'string'
        ? await fetch(input.source, { credentials: 'same-origin' }).then((response) => {
            if (!response.ok) throw new Error('Falha ao carregar a foto.');
            return response.blob();
          })
        : input.source;
    const mimeType = blob.type.toLowerCase();
    if (mimeType !== 'image/png' && mimeType !== 'image/jpeg' && mimeType !== 'image/jpg')
      return await convertToPng(blob);
    const encoded = await dataUrl(blob);
    const dimensions =
      input.width && input.height
        ? { width: input.width, height: input.height }
        : await imageDimensions(encoded);
    return {
      dataUrl: encoded,
      extension: mimeType === 'image/png' ? 'png' : 'jpeg',
      ...dimensions,
    };
  } catch {
    return null;
  }
}

function fittedSize(
  width: number,
  height: number,
  maximumWidth: number,
  maximumHeight: number,
): { width: number; height: number } {
  const scale = Math.min(maximumWidth / width, maximumHeight / height, 1);
  return { width: width * scale, height: height * scale };
}

export async function createCalculationWorkbook(
  data: CalculationExportData,
  image: PreparedExportImage | null,
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fluair Formação de Preço';
  workbook.created = data.createdAt ? new Date(data.createdAt) : new Date();
  const sheet = workbook.addWorksheet('Cálculo', {
    views: [{ state: 'frozen', ySplit: 7 }],
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 },
    },
  });
  sheet.columns = [
    { key: 'code', width: 18 },
    { key: 'description', width: 48 },
    { key: 'quantity', width: 13 },
    { key: 'unit', width: 10 },
    { key: 'minimumUnitPrice', width: 17 },
    { key: 'minimumTotal', width: 17 },
    { key: 'normalUnitPrice', width: 17 },
    { key: 'normalTotal', width: 17 },
  ];

  sheet.mergeCells('C1:H1');
  sheet.getCell('C1').value = `Kit ${data.kitCode}`;
  sheet.getCell('C1').font = { bold: true, size: 18, color: { argb: 'FF007AFF' } };
  sheet.mergeCells('C2:H2');
  sheet.getCell('C2').value = data.kitDescription;
  sheet.getCell('C2').font = { bold: true, size: 12 };
  sheet.mergeCells('C3:D3');
  sheet.getCell('C3').value = `Lista: ${data.priceListName}`;
  sheet.mergeCells('E3:F3');
  sheet.getCell('E3').value = `Lista v${data.priceListVersion}`;
  sheet.mergeCells('G3:H3');
  sheet.getCell('G3').value = data.calculationVersion
    ? `Cálculo v${data.calculationVersion}`
    : 'Prévia não salva';
  sheet.mergeCells('C4:D4');
  sheet.getCell('C4').value = data.createdAt ? new Date(data.createdAt) : null;
  sheet.getCell('C4').numFmt = 'dd/mm/yyyy hh:mm';
  sheet.mergeCells('E4:F4');
  sheet.getCell('E4').value = data.createdBy ? `Responsável: ${data.createdBy}` : '';
  sheet.mergeCells('G4:H4');
  sheet.getCell('G4').value = `${data.itemCount} itens (${data.missingPriceCount} sem preço)`;
  sheet.mergeCells('C5:E5');
  sheet.getCell('C5').value = 'Tabela mínima';
  sheet.getCell('F5').value = data.minimumTotal;
  sheet.getCell('F5').numFmt = MONEY_FORMAT;
  sheet.getCell('G5').value = 'Valor máximo';
  sheet.getCell('H5').value = data.normalTotal;
  sheet.getCell('H5').numFmt = MONEY_FORMAT;
  sheet.getRow(1).height = 25;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 20;
  sheet.getRow(5).height = 22;

  if (image) {
    const imageId = workbook.addImage({ base64: image.dataUrl, extension: image.extension });
    const size = fittedSize(image.width, image.height, 190, 92);
    sheet.addImage(imageId, { tl: { col: 0.1, row: 0.15 }, ext: size, editAs: 'oneCell' });
  } else {
    sheet.mergeCells('A1:B5');
    sheet.getCell('A1').value = 'Sem foto';
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('A1').font = { italic: true, color: { argb: 'FF8E8E93' } };
  }

  const header = sheet.getRow(7);
  header.values = [
    'Código',
    'Descrição',
    'Qtde.',
    'UM',
    'Preço mín.',
    'Total mín.',
    'Preço máx.',
    'Total máx.',
  ];
  header.height = 23;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF007AFF' } };
  header.alignment = { vertical: 'middle' };

  for (const item of data.items) {
    const row = sheet.addRow([
      item.code,
      item.description,
      item.quantity,
      item.unit,
      item.minimumUnitPrice,
      item.minimumTotal,
      item.normalUnitPrice,
      item.normalTotal,
    ]);
    row.getCell(3).numFmt = NUMBER_FORMAT;
    for (let column = 5; column <= 8; column += 1) row.getCell(column).numFmt = MONEY_FORMAT;
    row.alignment = { vertical: 'middle' };
    if (!item.hasPrice) row.font = { color: { argb: 'FFBE2D28' }, italic: true };
  }

  const totalRow = sheet.addRow([
    'Total geral',
    '',
    '',
    '',
    '',
    data.minimumTotal,
    '',
    data.normalTotal,
  ]);
  sheet.mergeCells(totalRow.number, 1, totalRow.number, 5);
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F2FF' } };
  totalRow.getCell(6).numFmt = MONEY_FORMAT;
  totalRow.getCell(8).numFmt = MONEY_FORMAT;
  sheet.autoFilter = { from: 'A7', to: `H${Math.max(7, totalRow.number - 1)}` };
  sheet.pageSetup.printArea = `A1:H${totalRow.number}`;
  sheet.pageSetup.printTitlesRow = '1:7';
  sheet.headerFooter.oddFooter = '&LFluair Formação de Preço&C&P de &N&R&D &T';

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadCalculationWorkbook(
  data: CalculationExportData,
  imageSource: ExportImageSource | null,
  fileName: string,
): Promise<void> {
  const image = await prepareExportImage(imageSource);
  const bytes = await createCalculationWorkbook(data, image);
  triggerDownload(new Blob([bytes], { type: XLSX_MIME }), fileName);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })
    .format(new Date(value))
    .replace(',', '');
}

function pdfCell(
  document: jsPDF,
  value: string,
  x: number,
  y: number,
  width: number,
  align: 'left' | 'right' = 'left',
): void {
  const padding = 1.5;
  const clipped = (document.splitTextToSize(value, width - padding * 2) as string[])[0] ?? '';
  document.text(clipped, align === 'right' ? x + width - padding : x + padding, y, { align });
}

export function createCalculationPdf(
  data: CalculationExportData,
  image: PreparedExportImage | null,
): jsPDF {
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 10;
  const tableWidth = pageWidth - margin * 2;
  const rowHeight = 7;
  const columns = [24, 73, 17, 13, 37.5, 37.5, 37.5, 37.5];
  const headings = [
    'Código',
    'Descrição',
    'Qtde.',
    'UM',
    'Preço mín.',
    'Total mín.',
    'Preço máximo',
    'Total máximo',
  ];

  const drawHeader = (): number => {
    document.setFillColor(0, 122, 255);
    document.rect(0, 0, pageWidth, 18, 'F');
    document.setTextColor(255, 255, 255);
    document.setFont('helvetica', 'bold');
    document.setFontSize(15);
    document.text('FLUAIR  |  Formação de Preço', margin, 11.5);
    document.setFontSize(8);
    document.text(
      data.calculationVersion ? `Cálculo v${data.calculationVersion}` : 'Prévia não salva',
      pageWidth - margin,
      11.5,
      { align: 'right' },
    );

    let textX = margin;
    if (image) {
      const size = fittedSize(image.width, image.height, 34, 25);
      document.addImage(
        image.dataUrl,
        image.extension.toUpperCase(),
        margin,
        22,
        size.width,
        size.height,
      );
      textX = margin + 39;
    }
    document.setTextColor(28, 28, 30);
    document.setFontSize(13);
    document.text(`${data.kitCode} - ${data.kitDescription}`, textX, 27, {
      maxWidth: pageWidth - textX - margin,
    });
    document.setFont('helvetica', 'normal');
    document.setFontSize(8.5);
    document.setTextColor(90, 90, 95);
    document.text(
      `${data.priceListName} | Lista v${data.priceListVersion}${data.createdAt ? ` | ${formatDateTime(data.createdAt)}` : ''}${data.createdBy ? ` | ${data.createdBy}` : ''}`,
      textX,
      35,
      { maxWidth: pageWidth - textX - margin },
    );
    document.text(
      `Tabela mínima: ${formatMoney(data.minimumTotal)}   |   Valor máximo: ${formatMoney(data.normalTotal)}   |   ${data.itemCount} itens (${data.missingPriceCount} sem preço)`,
      textX,
      42,
      { maxWidth: pageWidth - textX - margin },
    );

    document.setFillColor(242, 242, 247);
    document.rect(margin, 52, tableWidth, rowHeight, 'F');
    document.setDrawColor(210, 210, 215);
    document.setTextColor(28, 28, 30);
    document.setFont('helvetica', 'bold');
    document.setFontSize(7.5);
    let x = margin;
    headings.forEach((heading, index) => {
      const width = columns[index]!;
      pdfCell(document, heading, x, 56.6, width, index === 2 || index >= 4 ? 'right' : 'left');
      x += width;
    });
    document.line(margin, 59, margin + tableWidth, 59);
    return 59;
  };

  let y = drawHeader();
  document.setFont('helvetica', 'normal');
  document.setFontSize(7.5);
  data.items.forEach((item, rowIndex) => {
    if (y + rowHeight > pageHeight - 12) {
      document.addPage();
      y = drawHeader();
      document.setFont('helvetica', 'normal');
      document.setFontSize(7.5);
    }
    if (rowIndex % 2 === 1) {
      document.setFillColor(250, 250, 252);
      document.rect(margin, y, tableWidth, rowHeight, 'F');
    }
    const values = [
      item.code,
      item.description,
      formatNumber(item.quantity),
      item.unit,
      item.hasPrice ? formatMoney(item.minimumUnitPrice) : 'Sem preço',
      item.hasPrice ? formatMoney(item.minimumTotal) : '-',
      item.hasPrice ? formatMoney(item.normalUnitPrice) : 'Sem preço',
      item.hasPrice ? formatMoney(item.normalTotal) : '-',
    ];
    let x = margin;
    values.forEach((value, index) => {
      document.setTextColor(
        item.hasPrice ? 28 : 190,
        item.hasPrice ? 28 : 45,
        item.hasPrice ? 30 : 40,
      );
      const width = columns[index]!;
      pdfCell(document, value, x, y + 4.6, width, index === 2 || index >= 4 ? 'right' : 'left');
      x += width;
    });
    document.setDrawColor(235, 235, 240);
    document.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
    y += rowHeight;
  });

  if (y + 10 > pageHeight - 12) {
    document.addPage();
    y = drawHeader();
  }
  document.setFillColor(232, 242, 255);
  document.rect(margin, y, tableWidth, 9, 'F');
  document.setTextColor(28, 28, 30);
  document.setFont('helvetica', 'bold');
  document.setFontSize(8.5);
  document.text('Total geral', margin + 1.5, y + 5.8);
  document.text(
    formatMoney(data.minimumTotal),
    margin + columns.slice(0, 6).reduce((sum, width) => sum + width) - 1.5,
    y + 5.8,
    { align: 'right' },
  );
  document.text(formatMoney(data.normalTotal), pageWidth - margin - 1.5, y + 5.8, {
    align: 'right',
  });

  const totalPages = document.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    document.setPage(page);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7.5);
    document.setTextColor(142, 142, 147);
    document.text(`Página ${page} de ${totalPages}`, pageWidth - margin, pageHeight - 5, {
      align: 'right',
    });
  }
  return document;
}

export async function downloadCalculationPdf(
  data: CalculationExportData,
  imageSource: ExportImageSource | null,
  fileName: string,
): Promise<void> {
  const image = await prepareExportImage(imageSource);
  createCalculationPdf(data, image).save(fileName);
}
