import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

const acceptedRequestId = /^[A-Za-z0-9._:-]{1,80}$/;
const requestIds = new WeakMap<object, string>();

export function getRequestId(request: object): string {
  return requestIds.get(request) ?? 'request-id-unavailable';
}

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header('x-request-id');
  const requestId = supplied && acceptedRequestId.test(supplied) ? supplied : randomUUID();
  requestIds.set(req, requestId);
  res.setHeader('x-request-id', requestId);
  next();
}
