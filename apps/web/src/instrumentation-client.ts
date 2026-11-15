import * as Sentry from '@sentry/nextjs';
import { z } from 'zod';

import { config, errorTrackingOptions } from '@/shared/config';

z.config({ jitless: true });

if (config.errorTracking) Sentry.init(errorTrackingOptions(config.errorTracking));
