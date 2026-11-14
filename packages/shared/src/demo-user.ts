import type { RegisterInput } from './schemas/auth.js';

export const DEMO_USER = {
  email: 'demo@jobflow.local',
  password: 'jobflow-demo',
  displayName: 'Демо',
} as const satisfies RegisterInput;
