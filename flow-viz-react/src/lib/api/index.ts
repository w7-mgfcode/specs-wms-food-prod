// Re-export all API functions and types
export * from './client';
export * from './types';
export * from './auth';
export * from './lots';
export * from './qc';
export * from './traceability';

// Named namespace exports for cleaner imports
import * as auth from './auth';
import * as lots from './lots';
import * as qc from './qc';
import * as traceability from './traceability';

export const api = {
  auth,
  lots,
  qc,
  traceability,
} as const;
