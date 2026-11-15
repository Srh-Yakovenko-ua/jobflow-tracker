import { startTracing } from './tracing/tracing.js';

startTracing({ service: 'worker' });

await import('./serve-worker.js');
