import type { JsonBodyType } from 'msw';
import { http, HttpResponse } from 'msw/http';
import type { z } from 'zod';

import { apiUrl, errorReply, idempotencyKeyOf, type SentCreate } from './api-handlers';
import { fixtureIdOf, heldReply, type MoveRouteOptions } from './board-fixtures';

export type StoredRouteOptions<Item> = MoveRouteOptions & { store: Item[] };

export type StoredRoutesSetup<Item> = {
  items?: readonly Item[];
  list?: MoveRouteOptions;
  create?: MoveRouteOptions;
  update?: MoveRouteOptions;
};

type Stored = { id: string };

type StoredListing<Item> = { path: string; pageOf: (items: Item[]) => JsonBodyType };

type StoredCreating<Item, Body> = {
  schema: z.ZodType<Body>;
  build: (draft: { body: Body; id: string; applicationId: string }) => Item;
};

type StoredUpdating<Item, Patch> = {
  schema: z.ZodType<Patch>;
  merge: (change: { stored: Item; patch: Patch }) => Item;
  replyOf?: (item: Item) => JsonBodyType;
};

export type StoredRoutesSpec<Item, Body, Patch> = StoredListing<Item> & {
  creating: StoredCreating<Item, Body>;
  updating: StoredUpdating<Item, Patch>;
};

type ItemParams = { id: string; itemId: string };

const CREATED_SERIAL_FROM = 900;

export function storedListRoute<Item>({
  path,
  store,
  pageOf,
  ...control
}: StoredRouteOptions<Item> & StoredListing<Item>) {
  const sent: string[] = [];
  const handler = http.get<{ id: string }>(apiUrl(path), (info) => {
    sent.push(info.params.id);
    const listed = () => HttpResponse.json(pageOf([...store]));
    return heldReply({ ...control, info, fallback: listed });
  });
  return { handler, sent };
}

function storedCreateRoute<Item extends Stored, Body>({
  path,
  store,
  schema,
  build,
  ...control
}: StoredRouteOptions<Item> & StoredCreating<Item, Body> & { path: string }) {
  const sent: SentCreate<Body>[] = [];
  const handler = http.post<{ id: string }>(apiUrl(path), async (info) => {
    const body = schema.parse(await info.request.json());
    const applicationId = info.params.id;
    sent.push({ id: applicationId, body, idempotencyKey: idempotencyKeyOf(info.request.headers) });
    const created = () => {
      const id = fixtureIdOf(CREATED_SERIAL_FROM + store.length);
      const item = build({ body, id, applicationId });
      store.push(item);
      return HttpResponse.json(item, { status: 201 });
    };
    return heldReply({ ...control, info, fallback: created });
  });
  return { handler, sent };
}

function storedUpdateRoute<Item extends Stored, Patch>({
  path,
  store,
  schema,
  merge,
  replyOf = (item) => item,
  ...control
}: StoredRouteOptions<Item> & StoredUpdating<Item, Patch> & { path: string }) {
  const sent: { itemId: string; body: Patch }[] = [];
  const handler = http.patch<ItemParams>(apiUrl(`${path}/:itemId`), async (info) => {
    const patch = schema.parse(await info.request.json());
    const { itemId } = info.params;
    sent.push({ itemId, body: patch });
    const saved = () => {
      const index = store.findIndex((item) => item.id === itemId);
      const stored = store[index];
      if (stored === undefined) return errorReply({ status: 404, type: 'not_found' });
      const item = merge({ stored, patch });
      store.splice(index, 1, item);
      return HttpResponse.json(replyOf(item));
    };
    return heldReply({ ...control, info, fallback: saved });
  });
  return { handler, sent };
}

export function storedRoutes<Item extends Stored, Body, Patch>(
  { path, pageOf, creating, updating }: StoredRoutesSpec<Item, Body, Patch>,
  { items = [], list = {}, create = {}, update = {} }: StoredRoutesSetup<Item>,
) {
  const store: Item[] = [...items];
  const listed = storedListRoute({ path, store, pageOf, ...list });
  const created = storedCreateRoute({ path, store, ...creating, ...create });
  const updated = storedUpdateRoute({ path, store, ...updating, ...update });
  return {
    store,
    handlers: [listed.handler, created.handler, updated.handler],
    sent: { listed: listed.sent, created: created.sent, updated: updated.sent },
  };
}
