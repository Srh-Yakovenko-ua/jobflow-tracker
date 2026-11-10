import type { ResponseConfig, RouteConfig, ZodContentObject } from '@asteasolutions/zod-to-openapi';
import { errorResponseSchema, updateApplicationInputSchema } from '@jobflow/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { operationKey } from '../test/openapi.js';
import { API_OPENAPI_PATHS, buildOpenApiDocument } from './document.js';

type Example = { at: string; schema: unknown; example: unknown };

const ROUTES = API_OPENAPI_PATHS.map((route) => ({ name: operationKey(route), route }));

function replyOf(route: RouteConfig, status: number): ResponseConfig | undefined {
  const reply = route.responses[status];
  return reply === undefined || '$ref' in reply ? undefined : reply;
}

function examplesIn(at: string, content: ZodContentObject | undefined): Example[] {
  return Object.values(content ?? {}).flatMap((media): Example[] =>
    media === undefined || '$ref' in media
      ? []
      : [{ at, schema: media.schema, example: media.example }],
  );
}

const EXAMPLES = ROUTES.flatMap(({ name, route }) => [
  ...examplesIn(`${name} body`, route.request?.body?.content),
  ...Object.keys(route.responses).flatMap((status) =>
    examplesIn(`${name} ${status}`, replyOf(route, Number(status))?.content),
  ),
]);

const ERROR_EXAMPLES = EXAMPLES.filter(({ at }) => / [45]\d\d$/.test(at));

const VALIDATION_EXAMPLES = EXAMPLES.filter(({ at }) => at.endsWith(' 422'));

const BODY_ROUTES = ROUTES.filter(({ route }) => route.request?.body !== undefined);

function exampleAt(at: string): unknown {
  return EXAMPLES.find((candidate) => candidate.at === at)?.example;
}

const PATH_PARAMS = ROUTES.flatMap(({ name, route }) =>
  [...route.path.matchAll(/\{(\w+)\}/g)].map(([, param = '']) => ({
    at: `${name} ${param}`,
    route,
    param,
  })),
);

const BEARER_ROUTES = ROUTES.filter(({ route }) => route.security === undefined);

const UNLIMITED_ROUTE_NAME = 'GET /events/stream';

const LIMITED_ROUTES = ROUTES.filter(({ name }) => name !== UNLIMITED_ROUTE_NAME);

const CAPTURE_TOKEN_ROUTES = ROUTES.filter(({ route }) =>
  (route.security ?? []).some((scheme) => 'captureToken' in scheme),
).map(({ name }) => name);

describe('the OpenAPI document', () => {
  it.each(EXAMPLES)('gives $at an example its schema accepts', ({ schema, example }) => {
    expect(example).toBeDefined();
    expect(z.instanceof(z.ZodType).parse(schema).safeParse(example).error).toBeUndefined();
  });

  it.each(ERROR_EXAMPLES)(
    'gives the $at error reply an example in the error shape',
    ({ example }) => {
      expect(errorResponseSchema.safeParse(example).error).toBeUndefined();
    },
  );

  it('renders every error reply as a reference to the one ErrorResponse component', () => {
    const document = buildOpenApiDocument();

    const references = JSON.stringify(document).split(
      '"$ref":"#/components/schemas/ErrorResponse"',
    );
    expect(Object.keys(document.components?.schemas ?? {})).toEqual(['ErrorResponse']);
    expect(references).toHaveLength(ERROR_EXAMPLES.length + 1);
  });

  it.each(VALIDATION_EXAMPLES)('shows the field errors in the $at example', ({ example }) => {
    expect(errorResponseSchema.parse(example).errors).toEqual([
      { path: 'email', message: 'Invalid input: expected string, received undefined' },
    ]);
  });

  it.each(BODY_ROUTES)('documents 400 for a malformed JSON body on $name', ({ name }) => {
    expect(exampleAt(`${name} 400`)).toEqual(
      expect.objectContaining({ type: 'bad_request', status: 400 }),
    );
  });

  it('gives the PATCH body an example the update validator accepts', () => {
    expect(
      updateApplicationInputSchema.safeParse(exampleAt('PATCH /applications/{id} body')).error,
    ).toBeUndefined();
  });

  it('answers the PATCH example with the fields its body changes', () => {
    expect(exampleAt('PATCH /applications/{id} 200')).toMatchObject({
      position: 'Senior Node.js engineer',
      salaryMin: 4000,
      salaryMax: 5500,
    });
  });

  it.each(PATH_PARAMS)(
    'declares the path param $at with an example it accepts',
    ({ route, param }) => {
      const params = z.instanceof(z.ZodObject).parse(route.request?.params);
      const schema = z.instanceof(z.ZodType).parse(params.shape[param]);

      const example = schema.meta()?.example;
      expect(example).toBeDefined();
      expect(schema.safeParse(example).error).toBeUndefined();
    },
  );

  it.each(BEARER_ROUTES)('lists 401 and 403 for the bearer route $name', ({ route }) => {
    expect(Object.keys(route.responses)).toEqual(expect.arrayContaining(['401', '403']));
  });

  it.each(LIMITED_ROUTES)('documents 429 with a Retry-After header on $name', ({ route }) => {
    const headers = z.instanceof(z.ZodObject).parse(replyOf(route, 429)?.headers);

    expect(Object.keys(headers.shape)).toEqual(['Retry-After']);
  });

  it('lists no 429 on the live stream, the one route outside the rate limiter', () => {
    const stream = ROUTES.filter(({ name }) => name === UNLIMITED_ROUTE_NAME);

    expect(stream.map(({ route }) => Object.keys(route.responses))).toEqual([
      ['200', '401', '500', '503'],
    ]);
  });

  it.each([
    { name: 'POST /auth/login', limit: '5 per 60 s' },
    { name: 'POST /auth/register', limit: '3 per 3600 s' },
    { name: 'GET /applications/{id}', limit: '300 per 60 s' },
    { name: 'POST /capture/paste', limit: '30 per 3600 s' },
    { name: 'POST /capture/bookmarklet', limit: '60 per 3600 s' },
  ])('describes the default rate limit of $name as $limit', ({ name, limit }) => {
    const route = ROUTES.find((candidate) => candidate.name === name)?.route;

    expect(route && replyOf(route, 429)?.description).toContain(limit);
  });

  it.each([
    { route: 'start', path: '/auth/oauth/{provider}/start', cookieRequired: false },
    { route: 'callback', path: '/auth/oauth/{provider}/callback', cookieRequired: true },
  ])(
    'marks Set-Cookie required $cookieRequired on the OAuth $route redirect',
    ({ path, cookieRequired }) => {
      const redirect: unknown = buildOpenApiDocument().paths?.[path]?.get?.responses?.['302'];

      expect(redirect).toMatchObject({
        headers: { Location: { required: true }, 'Set-Cookie': { required: cookieRequired } },
      });
    },
  );

  it.each([
    '/applications',
    '/applications/{id}/notes',
    '/applications/{id}/contacts',
    '/applications/{id}/scheduled-events',
    '/capture/paste',
    '/capture/bookmarklet',
    '/resumes/versions',
  ])('documents the optional Idempotency-Key header and its 409 on POST %s', (path) => {
    const post = buildOpenApiDocument().paths?.[path]?.post;
    const keyHeader = post?.parameters?.find(
      (parameter) => 'name' in parameter && parameter.name === 'Idempotency-Key',
    );

    expect(post?.parameters).toContainEqual(
      expect.objectContaining({ in: 'header', name: 'Idempotency-Key', required: false }),
    );
    expect(Object.keys(post?.responses ?? {})).toContain('409');
    expect(keyHeader).toHaveProperty(
      'description',
      expect.stringContaining('409 with type idempotency_conflict'),
    );
  });

  it.each([
    { name: 'POST /applications/{id}/notes', type: 'idempotency_conflict' },
    { name: 'POST /applications/{id}/contacts', type: 'idempotency_conflict' },
    { name: 'POST /applications/{id}/scheduled-events', type: 'idempotency_conflict' },
    { name: 'POST /applications', type: 'conflict' },
    { name: 'POST /capture/paste', type: 'conflict' },
    { name: 'POST /capture/bookmarklet', type: 'conflict' },
    { name: 'POST /resumes/versions', type: 'conflict' },
  ])('gives the 409 example of the keyed $name the type $type', ({ name, type }) => {
    expect(exampleAt(`${name} 409`)).toMatchObject({ type, status: 409 });
  });

  it('takes the capture token, sent as Authorization: Capture, on POST /capture/bookmarklet alone', () => {
    const { components, paths } = buildOpenApiDocument();

    expect(components?.securitySchemes?.captureToken).toEqual({
      type: 'apiKey',
      in: 'header',
      name: 'Authorization',
      description: 'Capture <token>',
    });
    expect(CAPTURE_TOKEN_ROUTES).toEqual(['POST /capture/bookmarklet']);
    expect(paths?.['/capture/bookmarklet']?.post?.security).toEqual([{ captureToken: [] }]);
  });

  it('files every route under a tag the document lists, and lists no unused tag', () => {
    const tags = buildOpenApiDocument().tags?.map(({ name }) => name);

    expect(new Set(API_OPENAPI_PATHS.flatMap((route) => route.tags ?? []))).toEqual(new Set(tags));
  });
});
