import type { Request } from 'express';

import { AppError } from '../../errors/app-error.js';
import { MEDIA_LIMITS } from '../media/image-processor.js';
import { uploadedSpreadsheet, type UploadedSpreadsheet } from '../pricing/upload.js';

export interface CalculationImageUpload {
  data: Buffer;
  fileName: string;
  contentType: string;
}

export interface CalculationSaveUpload {
  spreadsheet: UploadedSpreadsheet;
  image: CalculationImageUpload | null;
  fields: Record<string, string>;
}

interface Part {
  name: string;
  fileName?: string;
  contentType?: string;
  data: Buffer;
}

function multipartError(message = 'Os dados do salvamento são inválidos.'): never {
  throw new AppError(400, 'INVALID_CALCULATION_MULTIPART', message);
}

function dispositionValue(header: string, key: string): string | undefined {
  const match = header.match(new RegExp(`(?:^|;)\\s*${key}="([^"]*)"`, 'i'));
  return match?.[1]?.replace(/\\"/g, '"');
}

function parseParts(body: Buffer, contentType: string): Part[] {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary || boundary.length > 200) multipartError();
  const delimiter = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from('\r\n\r\n');
  const followingDelimiter = Buffer.from(`\r\n--${boundary}`);
  const parts: Part[] = [];
  let cursor = body.indexOf(delimiter);
  if (cursor !== 0) multipartError();

  while (cursor >= 0) {
    cursor += delimiter.length;
    if (body.subarray(cursor, cursor + 2).equals(Buffer.from('--'))) break;
    if (!body.subarray(cursor, cursor + 2).equals(Buffer.from('\r\n'))) multipartError();
    cursor += 2;
    const headerEnd = body.indexOf(headerSeparator, cursor);
    if (headerEnd < 0 || headerEnd - cursor > 8_192) multipartError();
    const headers = body.subarray(cursor, headerEnd).toString('latin1');
    const headerLines = headers.split('\r\n');
    const disposition = headerLines.find((line) => /^content-disposition:/i.test(line));
    if (!disposition) multipartError();
    const name = dispositionValue(disposition, 'name');
    if (!name) multipartError();
    const fileName = dispositionValue(disposition, 'filename');
    const contentTypeHeader = headerLines
      .find((line) => /^content-type:/i.test(line))
      ?.split(':', 2)[1]
      ?.trim();
    const dataStart = headerEnd + headerSeparator.length;
    const next = body.indexOf(followingDelimiter, dataStart);
    if (next < 0) multipartError();
    parts.push({
      name,
      ...(fileName !== undefined ? { fileName } : {}),
      ...(contentTypeHeader ? { contentType: contentTypeHeader } : {}),
      data: body.subarray(dataStart, next),
    });
    cursor = next + 2;
  }
  return parts;
}

function legacySpreadsheet(req: Request): UploadedSpreadsheet {
  if (!Buffer.isBuffer(req.body)) {
    throw new AppError(400, 'EMPTY_SPREADSHEET', 'Selecione um arquivo Excel válido.');
  }
  let fileName: string;
  try {
    fileName = decodeURIComponent(req.header('x-file-name')?.trim() ?? '');
  } catch {
    throw new AppError(400, 'INVALID_UPLOAD_METADATA', 'O nome do arquivo enviado é inválido.');
  }
  return uploadedSpreadsheet(req.body, fileName, 'application/octet-stream');
}

export function calculationSaveUpload(req: Request): CalculationSaveUpload {
  const contentType = req.header('content-type') ?? '';
  if (!/^multipart\/form-data\b/i.test(contentType)) {
    return { spreadsheet: legacySpreadsheet(req), image: null, fields: {} };
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) multipartError();
  const parts = parseParts(req.body, contentType);
  const spreadsheets = parts.filter((part) => part.name === 'spreadsheet');
  const images = parts.filter((part) => part.name === 'image' && part.data.length > 0);
  if (spreadsheets.length !== 1 || images.length > 1) multipartError();
  const spreadsheetPart = spreadsheets[0]!;
  if (!spreadsheetPart.fileName) multipartError('Selecione um arquivo Excel válido.');
  const imagePart = images[0];
  if (imagePart && imagePart.data.length > MEDIA_LIMITS.maximumBytes) {
    throw new AppError(413, 'IMAGE_TOO_LARGE', 'A imagem deve ter no máximo 5 MB.');
  }
  const fields: Record<string, string> = {};
  for (const part of parts) {
    if (part.fileName !== undefined) continue;
    if (part.data.length > 1_000 || Object.hasOwn(fields, part.name)) multipartError();
    fields[part.name] = part.data.toString('utf8');
  }
  return {
    spreadsheet: uploadedSpreadsheet(
      spreadsheetPart.data,
      spreadsheetPart.fileName,
      spreadsheetPart.contentType ?? 'application/octet-stream',
    ),
    image: imagePart
      ? {
          data: imagePart.data,
          fileName: imagePart.fileName || 'imagem',
          contentType: imagePart.contentType ?? 'application/octet-stream',
        }
      : null,
    fields,
  };
}
