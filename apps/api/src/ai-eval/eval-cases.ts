import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

export type EvalCase<T> = T & { file: string };

export type EvalReport = { lines: string[]; passed: boolean };

const CASE_FILE = /\.json$/;

function describeRefusal(error: unknown): string {
  return error instanceof z.ZodError ? z.prettifyError(error) : String(error);
}

function parseCase<T>(schema: z.ZodType<T>, { file, content }: { file: string; content: string }) {
  try {
    return { file, ...schema.parse(JSON.parse(content)) };
  } catch (error) {
    throw new Error(`Eval case ${file} is malformed: ${describeRefusal(error)}`, { cause: error });
  }
}

export async function loadEvalCases<T extends object>(
  casesDir: string,
  schema: z.ZodType<T>,
): Promise<EvalCase<T>[]> {
  const files = (await readdir(casesDir)).filter((file) => CASE_FILE.test(file)).sort();
  if (files.length === 0) {
    throw new Error(`No eval cases in ${casesDir}`);
  }
  return Promise.all(
    files.map(async (file) =>
      parseCase(schema, { file, content: await readFile(join(casesDir, file), 'utf8') }),
    ),
  );
}
