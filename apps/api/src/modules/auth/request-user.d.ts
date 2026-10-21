import type { AccessUser } from './access-tokens.js';

declare global {
  namespace Express {
    interface Request {
      user?: AccessUser;
    }
  }
}
