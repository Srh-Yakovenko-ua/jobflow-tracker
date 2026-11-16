import { describe, expect, it } from 'vitest';

import { assertTestDatabase } from './database.js';

describe('the test database guard', () => {
  it.each(['jobflow_test', 'jobflow_be_12', 'jobflow_ctl_be_54'])(
    'lets truncation run on %s',
    (name) => {
      expect(() => {
        assertTestDatabase(name);
      }).not.toThrow();
    },
  );

  it.each(['jobflow', 'postgres', 'jobflow_test_extra', 'jobflow_be', 'jobflow_ctl_be'])(
    'refuses to truncate %s',
    (name) => {
      expect(() => {
        assertTestDatabase(name);
      }).toThrow(`Refusing to reset ${name}`);
    },
  );
});
