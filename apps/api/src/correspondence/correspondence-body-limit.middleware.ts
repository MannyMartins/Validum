import { json, RequestHandler } from 'express';

export const CORRESPONDENCE_INGEST_BODY_LIMIT_BYTES = 2 * 1024 * 1024;

export function correspondenceBodyLimitMiddleware(): RequestHandler {
  return json({ limit: CORRESPONDENCE_INGEST_BODY_LIMIT_BYTES });
}
