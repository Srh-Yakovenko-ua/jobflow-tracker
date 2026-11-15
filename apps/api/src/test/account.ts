import { exportAcceptedSchema, type ExportFormat } from '@jobflow/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { unzipSync } from 'fflate';

import {
  AccountExportRepository,
  AccountExportService,
  exportRequestedPayloadSchema,
} from '../modules/account/index.js';
import { NotificationsService } from '../modules/notifications/index.js';
import { FileStorage } from '../storage/file-storage.js';
import type { TestApp } from './app.js';
import { callRoute } from './http.js';
import { outboxRows } from './outbox.js';

export const EXPORT_PATH = '/api/v1/me/export';

export const exportLinkPath = (exportId: string) => `/api/v1/me/exports/${exportId}`;

export type ExportCall = { accessToken: string; format: ExportFormat };

const KEEPING_BOM = new TextDecoder('utf-8', { ignoreBOM: true });

export function postExport(app: NestExpressApplication, { accessToken, format }: ExportCall) {
  return callRoute(app, { method: 'post', path: EXPORT_PATH, accessToken, body: { format } });
}

export function accountExportBuilder({ app, prisma }: TestApp): AccountExportService {
  return new AccountExportService(
    new AccountExportRepository(prisma),
    app.get(FileStorage),
    app.get(NotificationsService),
  );
}

export async function exportedThroughWorker(testApp: TestApp, call: ExportCall): Promise<string> {
  const { exportId } = exportAcceptedSchema.parse((await postExport(testApp.app, call)).body);
  const [row] = await outboxRows(testApp.prisma, {
    eventType: 'export.requested',
    payload: { path: ['exportId'], equals: exportId },
  });
  await accountExportBuilder(testApp).build(exportRequestedPayloadSchema.parse(row?.payload));
  return exportId;
}

export function zipFilesOf(bytes: Uint8Array): Record<string, string> {
  return Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, file]) => [name, KEEPING_BOM.decode(file)]),
  );
}
