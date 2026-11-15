import { startTracing } from './tracing/tracing.js';

startTracing({ service: 'api' });

await import('./serve-api.js');
