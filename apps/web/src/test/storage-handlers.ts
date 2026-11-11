import type { HttpResponseResolver } from 'msw';
import { http, HttpResponse } from 'msw/http';

export const STORAGE_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

export function storageReply(status: number) {
  return new HttpResponse(null, { status, headers: STORAGE_CORS });
}

export function storageRoutes(url: string, reply: HttpResponseResolver) {
  return [http.options(url, () => storageReply(204)), http.put(url, reply)];
}
