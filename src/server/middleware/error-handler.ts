import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';

import { AppError } from '../errors/app-error.js';
import { getRequestId } from './request-context.js';

interface RequestBodyError {
  status?: unknown;
  type?: unknown;
}

function requestBodyError(error: unknown): AppError | null {
  if (!error || typeof error !== 'object') return null;
  const { status, type } = error as RequestBodyError;
  if (status === 400 && type === 'entity.parse.failed') {
    return new AppError(400, 'INVALID_JSON', 'O corpo JSON da requisição é inválido.');
  }
  if (status === 413 && type === 'entity.too.large') {
    return new AppError(413, 'REQUEST_TOO_LARGE', 'A requisição excede o tamanho permitido.');
  }
  return null;
}

export function notFound(): RequestHandler {
  return (req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', `Rota não encontrada: ${req.method} ${req.path}`));
  };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, _next) => {
    void _next;
    const bodyError = requestBodyError(error);
    if (bodyError) {
      res.status(bodyError.status).json({
        error: {
          code: bodyError.code,
          message: bodyError.message,
          fieldErrors: {},
          requestId: getRequestId(req),
        },
      });
      return;
    }

    if (error instanceof ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.') || 'request';
        (fieldErrors[field] ??= []).push(issue.message);
      }
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Revise os dados informados.',
          fieldErrors,
          requestId: getRequestId(req),
        },
      });
      return;
    }

    if (error instanceof AppError) {
      for (const [name, value] of Object.entries(error.headers)) res.setHeader(name, value);
      if (error.status >= 500)
        logger.error({ err: error, requestId: getRequestId(req) }, error.message);
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          fieldErrors: error.fieldErrors,
          requestId: getRequestId(req),
        },
      });
      return;
    }

    logger.error({ err: error, requestId: getRequestId(req) }, 'Erro não tratado na API.');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Não foi possível concluir a operação.',
        fieldErrors: {},
        requestId: getRequestId(req),
      },
    });
  };
}
