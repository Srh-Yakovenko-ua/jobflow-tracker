import { startErrorTracking } from './error-tracking/error-tracking.js';
import { startTracing } from './tracing/tracing.js';

startTracing({ service: 'worker' });
startErrorTracking({ service: 'worker' });

await import('./serve-worker.js');
