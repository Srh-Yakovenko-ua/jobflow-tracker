import path from 'node:path';

import type { Page, Response } from '@playwright/test';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const ANALYTICS_ORIGIN = process.env.NEXT_PUBLIC_ANALYTICS_URL ?? 'http://localhost:8000';

export const API_ROUTES = `${API_ORIGIN}/**`;

export const WORKER_WAIT = { timeout: 60_000 } as const;

export const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');

export function apiUrl(route: string): string {
  return `${API_ORIGIN}/api/v1${route}`;
}

export function databaseName(): string {
  const name = URL.parse(process.env.DATABASE_URL ?? '')?.pathname.slice(1) ?? '';
  return name === '' ? 'jobflow' : name;
}

export function postAnswered(page: Page, route: string): Promise<Response> {
  return page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url() === apiUrl(route),
  );
}
