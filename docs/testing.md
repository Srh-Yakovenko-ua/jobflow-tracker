# Testing: contracts and fuzzing

JobFlow has three parts in two languages: the Next.js web app, the NestJS API
and the Python services. This chapter shows how CI keeps their contracts in
step, and how Schemathesis fuzzes both HTTP APIs from their OpenAPI documents.
It ends with the issues the fuzzing found and the numbers of a full run.

Every contract has one source. A generator writes the other side from it, the
output is committed, and CI regenerates it and fails when the committed copy
differs (`git diff --exit-code`). Nobody edits a generated file by hand.

## Contract checks

| Contract            | Source                                                                                | Generated                                                                                                                                                                                                      | CI check                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API (BE-10)         | The zod schemas in `@jobflow/shared` and the `*.openapi.ts` route files of `apps/api` | `docs/api/openapi.json`, written by `pnpm api:openapi` through `@asteasolutions/zod-to-openapi`                                                                                                                | `contracts` job, `pnpm contracts`: `git diff --exit-code -- docs/api/openapi.json`                                                                                                                                     |
| Analytics (QA-04)   | The pydantic response models of `services/analytics`                                  | The analytics OpenAPI (`pnpm --filter @jobflow/analytics docs:openapi`), then `packages/shared/src/generated/analytics-client.d.ts` (`pnpm --filter @jobflow/shared gen:analytics`, openapi-typescript 7.13.0) | `contracts` job, `pnpm contracts`: `git diff --exit-code` on the generated file; `typecheck` job: `packages/shared/src/schemas/analytics-contract.test.ts`                                                             |
| Thresholds (DOC-09) | `packages/shared/src/thresholds.ts`                                                   | `packages/shared/dist/enums.json` on build, copied to `services/analytics/app/core/enums.json` by `pnpm gen:contracts`                                                                                         | `contracts` job: `pnpm gen:contracts`, then `git diff --exit-code -- services/analytics/app/core/enums.json`; `analytics` job: `tests/core/test_enums.py`; `unit` job: `packages/shared/src/rejection-reasons.test.ts` |
| AI kinds (AI-01)    | The input and output zod schemas of each AI kind in `packages/shared/src/ai`          | One JSON Schema per kind (`z.toJSONSchema`, `pnpm gen:contracts`), then the pydantic models in `services/ai/app/contracts` (`datamodel-codegen`)                                                               | `contracts` job: `pnpm gen:contracts`, then `git diff --exit-code -- services/ai/app/contracts services/documents/app/contracts`                                                                                       |

The analytics document comes from `app.openapi_export`, which builds
`create_app(OFFLINE_SETTINGS).openapi()`. That is the same document FastAPI
serves at `/openapi.json`, built without a database or an env file, so the
`contracts` job needs no running stack.

### The analytics type check

The web app parses every analytics response with the shared zod schemas, which
stay the only hand-written types. The generated `analytics-client.d.ts` is
imported by one type-level test, `analytics-contract.test.ts`, and nothing
else. It holds two assertions:

1. For each of the 11 `/analytics` paths, `z.infer` of the web schema extends
   the 200 `application/json` response type of that path in the generated file.
   A path where it does not lands in the `Drift` union, and
   `expectTypeOf<Drift>().toBeNever()` fails the typecheck.
2. The keys of the path-to-schema map equal every path of the analytics
   document except `/health` and `/health/ready`, so a new analytics route
   without a web schema fails too.

The check catches a renamed field, a field that becomes required and a changed
type. It does not catch a field that Python drops while zod still declares it
as optional. The direction is one way on purpose: pydantic types stage, source
and reason as `str`, while zod narrows them to literal unions, so the reverse
check or an exact match would always fail.

### Proof by a scratch edit

Each edit below was made, run and reverted on 2026-11-15.

**A renamed analytics field fails CI.** `Funnel.most_expensive` in
`services/analytics/app/metrics/funnel.py` renamed to `costliest_stage`:

- Committed without new types: `pnpm contracts` regenerates the file, the
  result differs from the committed copy in one line, and its
  `git diff --exit-code` step exits 1:

  ```diff
  -            mostExpensive: components["schemas"]["MostExpensiveResult"] | null;
  +            costliestStage: components["schemas"]["MostExpensiveResult"] | null;
  ```

- After `pnpm --filter @jobflow/shared gen:analytics`, the shared typecheck
  fails with TS2349 on `ExpectNever<"/analytics/funnel">`.
- In a second edit, with the insights route left out of the map, it fails with
  TS2344 on the key set assertion.

**A threshold changed in one place fails CI.** `MIN_N_INSIGHT` changed from 10
to 11:

- In `thresholds.ts` only: the two `contracts` job steps,
  `pnpm gen:contracts` and
  `git diff --exit-code -- services/analytics/app/core/enums.json`, exit 1 on
  `-    "MIN_N_INSIGHT": 10,` / `+    "MIN_N_INSIGHT": 11,`.
- In `enums.json` only: `uv run pytest tests/core/test_enums.py` fails with
  `assert (5, 11, 15, 0.6) == (5, 10, 15, 0.6)`, and `pnpm gen:contracts`
  writes 10 back, so the diff step fails as well.

Analytics has no threshold values of its own: `app/core/enums.py` reads them
from `enums.json`. One source plus the diff check is the parity test DOC-09
asks for.

## Fuzzing with Schemathesis

The `fuzz` job in `.github/workflows/e2e.yml` runs on every pull request and
push to `main` that changes code, and every night at 02:00 UTC, beside the
Playwright `e2e` job.

**Stack.** The job starts the stack exactly as the README quick start does,
through the composite action `.github/actions/quick-start`, which the `e2e`
job uses too: the `compose.ci.yml` production images, the AI service on
`FakeAiProvider` (no vendor key in CI), and `pnpm demo:seed`. It then appends
the five `RATE_LIMIT_*` variables at 100000 to `.env` and recreates the api,
so the limiter does not answer 429 to the generated traffic.

**Token.** Right before each run the job logs in as the demo user
(`POST /api/v1/auth/login`, `demo@jobflow.local`) and sends the access token as
`Authorization: Bearer <token>`. Analytics accepts the same RS256 token through
the API's JWKS. Each run ends well inside the 15 minute token lifetime. Fuzzing
cannot end the session early: sign out everywhere revokes refresh and capture
tokens, not the access token, and the change-password example in the OpenAPI
document uses another password, so the demo login still works.

**Specs.** The API run reads the committed `docs/api/openapi.json` and sends its requests to
`http://localhost:4000/api/v1`, because the production api serves no Swagger
page. The analytics run reads `http://localhost:8000/openapi.json`. No path is
excluded.

**Checks.**

| Check                         | Fails when                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not_a_server_error`          | Any response has a 5xx status                                                                                                                                                          |
| `response_schema_conformance` | A response body does not match the schema documented for its status code                                                                                                               |
| `ignored_auth`                | A protected endpoint accepts a request whose token was removed or replaced by an invalid one. After every 2xx, Schemathesis sends both; only 401, 403 or a redirect counts as enforced |

Each run uses `--max-examples 50`, `--request-timeout 10` (a hanging route
becomes a reported failure, not a stuck job) and `--continue-on-failure`. Both
runs always execute, and the step fails if either one fails. The junit reports
are uploaded as the `schemathesis` artifact.

**Run it locally** with the stack started by the README quick start:

```bash
printf '%s=100000\n' RATE_LIMIT_API_PER_MINUTE RATE_LIMIT_AI_PER_HOUR RATE_LIMIT_CAPTURE_PER_HOUR RATE_LIMIT_LOGIN_PER_MINUTE RATE_LIMIT_REGISTER_PER_HOUR >> .env
docker compose up -d --wait --force-recreate api
token=$(curl -fsS -X POST http://localhost:4000/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"demo@jobflow.local","password":"jobflow-demo"}' | jq -r .accessToken)
uvx schemathesis==4.32.7 run docs/api/openapi.json --url http://localhost:4000/api/v1 \
  --checks not_a_server_error,response_schema_conformance,ignored_auth \
  -H "Authorization: Bearer $token" \
  --max-examples 50 --request-timeout 10 --continue-on-failure
uvx schemathesis==4.32.7 run http://localhost:8000/openapi.json --url http://localhost:8000 \
  --checks not_a_server_error,response_schema_conformance,ignored_auth \
  -H "Authorization: Bearer $token" \
  --max-examples 50 --request-timeout 10 --continue-on-failure
```

Remove the appended `RATE_LIMIT_*` lines from `.env` afterwards and recreate
the api, so the normal limits apply again.

## Issues found

| Issue                                                                                                   | Before                                                                                                                                                                                                                                                                                               | After                                                                                                                                                                                                                                                                                                     | Test                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| The analytics OpenAPI documented a different 422 body than the service sends, and did not document 401. | Every `/analytics` route documented 422 as FastAPI's `HTTPValidationError` `{detail: ValidationError[]}` and had no 401 entry. The service answers both with the DOC-04 body, for example `{type: "validation_error", title: "Invalid request", status: 422, errors: [{path, message}], requestId}`. | 401 and 422 on all 11 `/analytics` routes point to `ProblemBody` (with `FieldError`), and `HTTPValidationError` is gone from the document. `problem()` in `app/core/errors.py` builds every error body through the same `ProblemBody` model, so the documented shape and the sent one cannot drift apart. | `services/analytics/tests/test_openapi_export.py::test_documents_401_and_422_on_every_analytics_route_as_the_problem_body` |

The old 422 schema never failed `response_schema_conformance`: its only
property, `detail`, is optional, so any object matched it. The finding came
from reading the document against the handlers. The new test failed first
with `KeyError: '401'`.

The API run reported no failure, so it needed no fix. That covers what the
three checks exercised, not every route in full:

- `not_a_server_error` and `response_schema_conformance` judged every response
  the run got. For the operations in the coverage notes below, most of those
  responses were 404 or 422, so their success paths were barely reached.
- `ignored_auth` judges an operation only after a 2xx on it, and only when the
  operation declares authentication. In the API document, 71 operations use
  the global `bearerAuth`, 2 take the refresh cookie and 1 the capture token;
  the 9 with `security: []` (health, readiness, register, login, the OAuth
  routes, the JWKS and the event stream) are public and out of its reach. An
  operation that never answered 2xx was not probed at all.

The 401 without a token on every bearer route is proven separately:
`apps/api/src/app.http.test.ts` builds its list from the OpenAPI document
(`bearerCalls`), and each analytics route has its own refusal test in
`services/analytics/tests/routes`.

## Measured numbers

The exact command of the `fuzz` step, run on 2026-11-15 against the stack in
production mode with the raised rate limits and fake AI:

| Run       | Operations | Test cases | Failures | Time |
| --------- | ---------- | ---------- | -------- | ---- |
| API       | 83         | 6008       | 0        | 46 s |
| Analytics | 13         | 648        | 0        | 3 s  |

The API run went through all four Schemathesis phases, the stateful one
included. The numbers of each CI run are in the junit reports of its
`schemathesis` artifact.

Schemathesis also printed two coverage notes, which are not failures:

- 18 API operations mostly got 404, because no OpenAPI link supplies a real id
  for their path parameter.
- 9 API and 3 analytics operations mostly got 422, because most generated
  values fail validation.
