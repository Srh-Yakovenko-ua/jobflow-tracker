import type { BookmarkletConfig } from './href.js';
import { run } from './run.js';

declare const __JOBFLOW_CONFIG__: BookmarkletConfig;

void run(__JOBFLOW_CONFIG__);
