type ScrubbableRequest = {
  url?: string | undefined;
  method?: string | undefined;
};

type ScrubbableFrame = {
  filename?: string | undefined;
  function?: string | undefined;
  in_app?: boolean | undefined;
  vars?: unknown;
};

type ScrubbableException = {
  type?: string | undefined;
  value?: string | undefined;
  stacktrace?: { frames?: readonly ScrubbableFrame[] | undefined } | undefined;
};

export type ScrubbableErrorEvent = {
  message?: unknown;
  logentry?: unknown;
  user?: unknown;
  extra?: unknown;
  breadcrumbs?: unknown;
  fingerprint?: string[] | undefined;
  request?: ScrubbableRequest | undefined;
  exception?: { values?: readonly ScrubbableException[] | undefined } | undefined;
};

export const ERROR_EVENT_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
};

function withoutQuery(url: string): string {
  const [route = ''] = url.split(/[?#]/u);
  return route;
}

function requestOf({ request }: ScrubbableErrorEvent): { request?: ScrubbableRequest } {
  if (request === undefined) return {};
  const route = withoutQuery(request.url ?? '');
  return {
    request: {
      ...(route === '' ? {} : { url: route }),
      ...(request.method === undefined ? {} : { method: request.method }),
    },
  };
}

function withoutVars(frame: ScrubbableFrame): ScrubbableFrame {
  const kept = { ...frame };
  delete kept.vars;
  return kept;
}

function withoutValue(exception: ScrubbableException): ScrubbableException {
  const kept = { ...exception };
  delete kept.value;
  if (kept.stacktrace?.frames === undefined) return kept;
  return {
    ...kept,
    stacktrace: { ...kept.stacktrace, frames: kept.stacktrace.frames.map(withoutVars) },
  };
}

function exceptionOf({ exception }: ScrubbableErrorEvent): Pick<ScrubbableErrorEvent, 'exception'> {
  if (exception?.values === undefined) return {};
  return {
    exception: {
      ...exception,
      values: exception.values.map(withoutValue),
    },
  };
}

function topInAppFrame({ stacktrace }: ScrubbableException): ScrubbableFrame | undefined {
  return (stacktrace?.frames ?? []).filter((frame) => frame.in_app !== false).at(-1);
}

function fingerprintOf({
  exception,
}: ScrubbableErrorEvent): Pick<ScrubbableErrorEvent, 'fingerprint'> {
  const thrown = exception?.values?.at(-1);
  const top = thrown === undefined ? undefined : topInAppFrame(thrown);
  if (thrown === undefined || top === undefined) return {};
  return {
    fingerprint: [thrown.type ?? 'Error', withoutQuery(top.filename ?? ''), top.function ?? ''],
  };
}

export function scrubErrorEvent<Event extends ScrubbableErrorEvent>(
  event: Event,
): Event & Pick<ScrubbableErrorEvent, 'fingerprint'> {
  const scrubbed = { ...event };
  delete scrubbed.message;
  delete scrubbed.logentry;
  delete scrubbed.user;
  delete scrubbed.extra;
  delete scrubbed.breadcrumbs;
  delete scrubbed.request;
  delete scrubbed.exception;
  return Object.assign(scrubbed, requestOf(event), exceptionOf(event), fingerprintOf(event));
}
