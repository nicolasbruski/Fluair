import { createHash } from 'node:crypto';

import type { Request } from 'express';

import { AppError } from '../../errors/app-error.js';

export const MAX_SPREADSHEET_SIZE = 10 * 1024 * 1024;

export interface UploadedSpreadsheet {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  fileHash: string;
}

export function uploadedSpreadsheet(
  buffer: Buffer,
  fileNameValue: string,
  mimeTypeValue = 'application/octet-stream',
): UploadedSpreadsheet {
  if (buffer.length === 0) {
    throw new AppError(400, 'EMPTY_SPREADSHEET', 'Selecione um arquivo Excel válido.');
  }
  if (buffer.length > MAX_SPREADSHEET_SIZE) {
    throw new AppError(413, 'SPREADSHEET_TOO_LARGE', 'O arquivo Excel deve ter no máximo 10 MB.');
  }
  const fileName = fileNameValue.trim();
  if (!fileName || fileName.length > 500) {
    throw new AppError(400, 'INVALID_UPLOAD_METADATA', 'O nome do arquivo enviado é inválido.');
  }
  if (!/\.(xls|xlsx)$/i.test(fileName)) {
    throw new AppError(400, 'INVALID_SPREADSHEET_EXTENSION', 'Envie um arquivo .xls ou .xlsx.');
  }
  return {
    buffer,
    fileName: fileName.slice(0, 255),
    mimeType: mimeTypeValue.slice(0, 120),
    fileHash: createHash('sha256').update(buffer).digest('hex'),
  };
}

function header(req: Request, name: string): string {
  const value = req.header(name)?.trim() ?? '';
  if (!value || value.length > 500) {
    throw new AppError(
      400,
      'INVALID_UPLOAD_METADATA',
      'Os dados do arquivo enviado são inválidos.',
    );
  }
  return value;
}

export function spreadsheetUpload(req: Request): UploadedSpreadsheet {
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new AppError(400, 'EMPTY_SPREADSHEET', 'Selecione um arquivo Excel válido.');
  }
  if (req.body.length > MAX_SPREADSHEET_SIZE) {
    throw new AppError(413, 'SPREADSHEET_TOO_LARGE', 'O arquivo Excel deve ter no máximo 10 MB.');
  }
  let fileName: string;
  try {
    fileName = decodeURIComponent(header(req, 'x-file-name'));
  } catch {
    throw new AppError(400, 'INVALID_UPLOAD_METADATA', 'O nome do arquivo enviado é inválido.');
  }
  if (!/\.(xls|xlsx)$/i.test(fileName)) {
    throw new AppError(400, 'INVALID_SPREADSHEET_EXTENSION', 'Envie um arquivo .xls ou .xlsx.');
  }
  return uploadedSpreadsheet(
    req.body,
    fileName,
    req.header('content-type') ?? 'application/octet-stream',
  );
}
