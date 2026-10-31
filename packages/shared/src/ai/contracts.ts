import { z } from 'zod';

import { AI_KIND_SCHEMAS, aiCompleteRequestSchemas, aiCompletionSchemas } from './completion.js';
import { aiEmbeddingSchema, aiEmbedRequestSchema } from './embed.js';
import { AI_KINDS } from './kinds.js';

type ContractSchema = [name: string, schema: z.ZodType];

function contractSchemas(): ContractSchema[] {
  const kindSchemas = AI_KINDS.flatMap((kind): ContractSchema[] => [
    [`${kind}_request`, aiCompleteRequestSchemas[kind]],
    [`${kind}_output`, AI_KIND_SCHEMAS[kind].output],
    [`${kind}_response`, aiCompletionSchemas[kind]],
  ]);
  return [
    ...kindSchemas,
    ['embed_request', aiEmbedRequestSchema],
    ['embed_response', aiEmbeddingSchema],
  ];
}

const titleOf = (name: string) =>
  name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

const toContractJsonSchema = ([name, schema]: ContractSchema) =>
  [
    name,
    {
      title: titleOf(name),
      ...z.toJSONSchema(schema, { target: 'draft-2020-12', io: 'input', unrepresentable: 'throw' }),
    },
  ] as const;

export function aiContractJsonSchemas() {
  return Object.fromEntries(contractSchemas().map(toContractJsonSchema));
}
