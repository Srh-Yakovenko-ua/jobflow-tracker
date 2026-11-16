import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { authenticateRequest } from './authenticate-request.js';
import type { CredentialsService } from './credentials.service.js';

export function bearerBeforeBody(credentialsOf: () => CredentialsService): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    void authenticateRequest(credentialsOf(), { req, res }).then(() => {
      next();
    }, next);
  };
}
