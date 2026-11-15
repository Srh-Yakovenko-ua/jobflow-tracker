import { startErrorTracking } from './error-tracking/error-tracking.js';
import { startTracing } from './tracing/tracing.js';

startTracing({ service: 'api' });
startErrorTracking({ service: 'api' });

await import('./serve-api.js');
