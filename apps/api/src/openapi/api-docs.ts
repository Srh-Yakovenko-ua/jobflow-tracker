import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';

import { devToolHeaders } from '../common/dev-tool-headers.js';
import { buildOpenApiDocument } from './document.js';

export const API_DOCS_PATH = '/api/docs';

export function mountApiDocs(app: NestExpressApplication): void {
  const document = buildOpenApiDocument();
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get(
    `${API_DOCS_PATH}/openapi.json`,
    devToolHeaders,
    (_req: Request, res: Response) => {
      res.json(document);
    },
  );
  app.use(API_DOCS_PATH, devToolHeaders, ...swaggerUi.serve);
  expressApp.get(API_DOCS_PATH, devToolHeaders, swaggerUi.setup(document));
}
