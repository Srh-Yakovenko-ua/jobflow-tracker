import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

export type EvalCase<T> = T & { file: string };

export type EvalReport = { lines: string[]; passed: boolean };

const CASE_FILE = /\.json$/;

function describeRefusal(error: unknown): string {
  return error instanceof z.ZodError ? z.prettifyError(error) : String(error);
}

export type EvalFile<T> = { file: string; schema: z.ZodType<T> };

function parseCase<T>(schema: z.ZodType<T>, { file, content }: { file: string; content: string }) {
  try {
    return schema.parse(JSON.parse(content));
  } catch (error) {
    throw new Error(`Eval case ${file} is malformed: ${describeRefusal(error)}`, { cause: error });
  }
}

export async function loadEvalFile<T>(casesDir: string, { file, schema }: EvalFile<T>): Promise<T> {
  return parseCase(schema, { file, content: await readFile(join(casesDir, file), 'utf8') });
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
    files.map(async (file) => ({ file, ...(await loadEvalFile(casesDir, { file, schema })) })),
  );
}
