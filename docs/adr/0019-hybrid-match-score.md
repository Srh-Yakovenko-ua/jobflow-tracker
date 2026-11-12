# ADR-0019: Hybrid Match Score, the model maps and code scores

- Status: accepted
- Date: 2026-11-12

## Context

The Match Score answers "is this vacancy worth my time" for one application against one resume version. The user has to be able to understand the number and challenge it: "AWS -14" is something you can argue with, "62" from a model is not. The score also has to stay put, since it appears on the board, in the breakdown and on the timeline, and a number that moves between two identical requests would undermine all three.

## Decision

The model only extracts and maps. `services/ai` (kind `match`, prompt `v3`, temperature 0, one structured completion, no embeddings) gets `{ vacancy: { position, stack, text }, profile }`. The text is the raw vacancy text, at most 20000 characters, or an empty string. The profile is a pick of the stored resume profile: skills with years, total years, seniority, English level, domains, languages and whether there is leadership experience. Evidence quotes, positions and company names are left out. The model returns up to 15 requirements, each with a weight (`must`, `nice`, `mentioned`) and a coverage against the profile (`full`, `partial`, `missing`), plus a one sentence explanation in Ukrainian. It never returns a score.

`scoreMatch` in `apps/api/src/modules/match/match-score.ts` computes the score from that mapping with fixed numbers:

| Weight    | Points | Coverage | Credit |
| --------- | ------ | -------- | ------ |
| must      | 3      | full     | 1      |
| nice      | 1      | partial  | 0.5    |
| mentioned | 0      | missing  | 0      |

With W the sum of points over the must and nice items, each of those items loses `round(100 * points * (1 - credit) / W)`, and `score = max(0, 100 - sum of losses)`. Each item is rounded on its own, so the user can add the listed losses up to the score. Mentioned items carry no points and make up the "did not affect the score" list. A sum does not depend on order, so a reordered list from the model gives the same score. A mapping with no must or nice item fails the job as `no_requirements` rather than inventing a score from W = 0.

- **No CV, no score.** An application without a linked resume version queues no job and its `match_score` is cleared to null, never 0; the UI draws the dashed dash. A linked version whose profile is not ready yet queues no job either.
- **Cache.** The existing `ai_results` cache, keyed by `(userId, kind, inputHash)` with the hash taken over the whole `{ vacancy, profile }` input and the prompt version. A vacancy edit or another resume version changes the hash and recomputes; the same pair reuses the stored mapping. No new column or table.
- **History.** The done `match` jobs of an application are its score history: each keeps `resumeVersionId`, `aiResultId` and `finishedAt`, and the same pure code rebuilds each past breakdown from its stored output. `applications.match_score` holds the current score and is written only while the same resume version is still linked. `GET /api/v1/applications/:id/match` returns the newest done job for the current version, or `{ match: null }`.

## Evaluation

`pnpm ai:eval match` runs against the live `services/ai`. It uses the 15 vacancy texts of the vacancy parse eval, with each case's expected position and stack so that the eval measures matching, not parsing. The CV is `evals/match/cv.json`, a synthetic senior full stack TypeScript profile (React and TypeScript 6 years, Node.js 5, GraphQL 1, Upper-Intermediate English, no leadership). The manual ranking, `evals/match/ranking.json`, was written before the first live run and is never tuned after it; ties are allowed. Every case is scored with `scoreMatch`, and a failed call or `no_requirements` counts as 0. Both rankings get average ranks for ties, and Spearman's rho is the Pearson correlation of those ranks. The criterion is rho above 0.7.

Live run on 2026-11-12, 20:35 UTC, model `private/nvidia/nemotron-3.5-super-120b-a12b` as reported by `services/ai`, prompt `v3`:

| Case                                | Manual rank | Score | Score rank |
| ----------------------------------- | ----------- | ----- | ---------- |
| 14-dou-en-fullstack-hybrid-kyiv     | 1           | 86    | 1          |
| 01-djinni-uk-react-net-no-currency  | 2           | 67    | 2          |
| 08-djinni-ru-node-team-lead         | 3           | 38    | 4          |
| 04-djinni-en-qa-no-salary           | 4           | 22    | 10.5       |
| 07-dou-ru-php-net-uah               | 5           | 29    | 5          |
| 02-djinni-uk-python-gross-uah       | 6           | 46    | 3          |
| 12-dou-uk-requirements-only         | 6           | 24    | 8          |
| 06-djinni-ru-go-remote              | 8           | 27    | 6          |
| 03-dou-en-java-eur                  | 9           | 26    | 7          |
| 05-dou-uk-dotnet-hybrid-dnipro      | 9           | 11    | 13         |
| 09-dou-en-data-engineer-lviv-office | 11          | 10    | 14         |
| 10-djinni-en-devops-gross-usd       | 12          | 2     | 15         |
| 15-djinni-en-ml-engineer            | 12          | 22    | 10.5       |
| 13-djinni-uk-product-designer       | 14          | 23    | 9          |
| 11-djinni-uk-flutter-junior         | 15          | 16    | 12         |

rho = 0.761 against the 0.7 bar: PASS. The QA vacancy now scores lower than the manual rank suggests (22), and the product designer still sits above the ML and DevOps roles.

How the prompt got there. `v1` failed: rho 0.609 at 20:06 UTC and 0.689 in a second run, with the same prompt and model. Every vacancy lists an English level, and some list Git. The model weighted those as `must` that the CV fully covers, so short off-profile lists kept a large share of their points (junior Flutter 40: two of five `must` items full). `v2` made a general requirement outside the role's discipline `nice` even when the text lists it as required, kept `must` inside the role's own discipline, and asked `partial` for a related skill of the same language or platform. It passed once at 20:27 UTC (rho 0.726) and failed the next run at 20:30 UTC (rho 0.697). A per item dump of a third `v2` run showed four faults: "Flutter та Dart" and "TypeScript, React, Node.js, Express" came back as one item each, the team lead's duties were listed again as `nice` items next to the leadership requirement, "3+ years as a Data Engineer" was `full` on the full stack CV's total years, and NestJS was `missing` with Express in the profile. `v3` adds four rules for them: one item per skill (alternatives stay one item), duties are not requirements, years in a discipline are `missing` when the profile belongs to another discipline, and the coverage examples name Express for NestJS and MySQL for PostgreSQL as `partial`, Redux for Bloc as not related. A basic skill of another role ("базове розуміння HTML та CSS" for a designer) is one `nice` item. The ranking and the weights did not change. The prompt was revised against these same 15 cases, so 0.761 is a development score, not a held out one. The `v1` and `v2` runs also show that the provider is not fully repeatable at temperature 0: the same prompt moved rho by up to 0.08 between runs. AN-11 is the check against real outcomes.

## Alternatives

- **The model returns the score**: one call and no code, but the number can move between identical requests and cannot be added up from its parts.
- **Embedding similarity between the CV and the vacancy**: deterministic for a fixed model, but a cosine value explains nothing and needs a threshold to tune. It is also a second call, and no criterion asks for it.
- **A new cache table keyed by `(cv_profile_hash, vacancy_hash)`**: the same behaviour as one hash over an input that holds both parts, at the cost of a migration and a second cache next to `ai_results`.

## Consequences

- Better: same input, same score, and every point of the score is visible in the breakdown. The weights are code and change in a reviewed diff. Past scores rebuild from stored mappings.
- Worse: the score is only as good as the model's weights and coverage, which the code cannot correct. The `ai:eval` rerun is the only check on them.
- Watch: the eval rho after every prompt or model change, since a model change bumps the prompt version and invalidates the cache.

## Links

AI-06, AI-03, AI-04, AI-05, BE-31 (triggers, debounce, timeline row), FE-31 (breakdown UI), AN-11 (validation against real outcomes). Related: [ADR-0009](0009-ai-provider-strategy.md), [ADR-0018](0018-ai-as-a-python-service.md).
