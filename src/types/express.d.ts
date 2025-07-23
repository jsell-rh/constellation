/**
 * Express Request type extensions
 */

import type { User } from './core';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};