# Design handoff notes

The design handoff package in this folder is the reference for every UI card.
Fidelity is final: colours, type, spacing, radii, shadows, states and motion are
reproduced as drawn. The `.dc.html` files are references to look at, not code to
copy. `tokens.json` moved to `packages/shared/tokens/tokens.json` and is the input
for the token pipeline (DES-02). `pnpm tokens:build` writes `tokens.css`,
`theme.css`, `chart-theme.ts` and `rn-theme.ts` into
`packages/shared/tokens/generated/`. The generated files are committed;
`prebuild` of `@jobflow/shared` regenerates them, and `pnpm contracts` (the CI
contracts job and `pnpm ci:local`) runs the package's `tokens:check`, which
writes nothing and fails, naming each file, when they are stale.
The web imports `@jobflow/shared/tokens.css` and `@jobflow/shared/theme.css`
after `@import "tailwindcss"` (FE-01); charts import `@jobflow/shared/chart-theme`.

## How to open

The files need `support.js` beside them and a real HTTP origin. Serve the folder
and start from the index:

```
python3 -m http.server 3999 --directory docs/design
```

Then open `http://127.0.0.1:3999/JobFlow%20-%20%D0%A1%D0%B8%D1%81%D1%82%D0%B5%D0%BC%D0%B0.dc.html`
(`JobFlow - Система.dc.html`). File names are Cyrillic, so URLs are
percent-encoded. The references load Chart.js 4.4.1, chartjs-chart-sankey
0.12.1, FullCalendar 6.1.11, lucide and Google Fonts from CDNs, so they need
network. On a clean load the only console error is the `favicon.ico` 404, with
one exception: the analytics dashboard can throw an uncaught Chart.js
`TypeError: this._fn is not a function` from the animation tick. It is
intermittent, and every chart still renders (see the gaps table).

The index links to 8 files. `Календар.dc.html` is not linked from it and is
opened directly.

## Screens

Every screen ends with a note «записка · рішення» and most with «що зламається»
(what breaks at 0 and at 500 records). Those notes are part of the spec.

| File | What it holds | Product area and cards | 0 / 500 records note |
| --- | --- | --- | --- |
| `JobFlow - Система.dc.html` | Index, the state of the mock-up, the technical frame (Next.js + Tailwind, Expo + NativeWind, one `tokens.json`) | Index only, DES-01 | none |
| `JobFlow - Дизайн-система.dc.html` | 22 sections: palette, type, scale and layers, dark theme, buttons, fields, selects, calendar, choice, upload, navigation, data, feedback, Match Score, stages and outcomes, application card, icons, charts, table, calendar grid, RN layer, handoff. Every state is clickable | Kit and tokens: FE-05, FE-06, FE-07, DES-02, DES-03, DES-04 | #s20: 6 or more events in a day fold into «ще N» with a popover, so the row height is fixed; event titles are truncated, the time never is |
| `JobFlow - Дашборд аналітики.dc.html` | KPI row, Sankey funnel, rejection reasons by stage, sources, CV A/B, offer forecast with interval, timings, salary, monthly AI summary, the same dashboard on 4 applications | Analytics: FE-32 to FE-38, AN-05 to AN-14 | At 500 applications Sankey branches thinner than 3 px fold into «інші» with expand on click. No chart shows a percent on a sample under 5 |
| `JobFlow - Канбан.dc.html` | 5 open columns, collapsed «відмова» and «ghosted» strips, keyboard drag, rejection reason modal and the «записано в аналітику» toast, «Щільні» mode | Board: FE-11, FE-12, FE-13, FE-14, FE-15 | A long company name is cut with an ellipsis on the second line, the position is always full. With 0 cards only the «відгук» column shows, with its empty state. 50+ cards: «Щільні» drops the stack, a column virtualises after 30 cards, the header counter shows the full count |
| `JobFlow - Карточка вакансії.dc.html` | Header and actions, Match Score breakdown, timeline, notes, follow-up generator in 4 states, recruiter, attached CV, context | Vacancy page: FE-17, FE-18, FE-19, FE-20, FE-31, FE-41, AI-07 | No 0 / 500 note. The decision note: the right column holds what you act on, the left what you read; the timeline is never edited |
| `JobFlow - Додавання вакансії.dc.html` | F1: bookmarklet, pasted text, manual form; skeleton card in the column, «перевір поля» review, «AI не впорався» | Capture: FE-25 to FE-29, BE-26 to BE-28, AI-03 | A full AI queue shows «у черзі · ~2 хв» with an honest ETA instead of an endless shimmer. With 20 skeletons at once animation stops |
| `JobFlow - Резюме, налаштування, вхід.dc.html` | Resume versions with conversion per version, settings (silence threshold, auto ghost, theme), login and registration | Resumes FE-30, BE-30; settings FE-23, BE-24; auth FE-09, BE-06 | A long version name is cut on the first line, date and size always stay. 0 versions: the table becomes a full-width upload zone. 20 versions: sorted by conversion, old ones fold into «архів» |
| `JobFlow - Порожні стани.dc.html` | First run, empty states of every screen, three skeletons, four error panels | FE-07 | Rules instead of a 0 / 500 note: an empty state states a fact, how much is missing, one action; an error says the data is safe and that the system is to blame; skeletons repeat the real geometry |
| `JobFlow - Мобільний компаньон.dc.html` | 5 RN screens: list with the stage rail, card, quick add, reminders with push, compact analytics | Mobile, optional: MOB-01 to MOB-05 | A long company name wraps the position line, the position always comes first. At 200 cards FlashList with sections; the chip rail scrolls sideways and never wraps |
| `Календар.dc.html` | The shared calendar component (props `cal`, `showDone`, `onDone`, also works standalone): month, year and decade pickers | Date picker everywhere: FE-21 | none in the file; the grid note sits in #s20 |

What the references do not draw:

- Web screens are drawn at 1440 px in the light theme. That pair is a pixel
  comparison.
- The dark theme has no per-screen drawing. The reference is #s4 and the `dark`
  section of `packages/shared/tokens/tokens.json` (19 tokens on a warm base:
  the 14 drawn, the three DES-02 filled from them and the `danger` and `scrim`
  FE-05 added, see Dark gaps and Danger and scrim colours below). A dark check
  means every surface, text and line uses its dark token and contrast holds.
- 390 px has no web drawing; the phone design is the RN companion. A 390 check
  is by rule, not by pixels: no horizontal scroll, nothing clipped, touch zones
  of 44 px, navigation reachable (FE-02, FIN-02).
- The references load lucide unpinned. `lucide-react` gets pinned in FE-05.

## Shared components (#s22)

One API for both platforms: the props are the same, the implementation differs.
Props as drawn in #s22:

| Component | Props | Folder | Owner |
| --- | --- | --- | --- |
| `Button` | `variant`, `size`, `loading`, `icon`, `onPress` | `ui/` | FE-05 |
| `Field` | `label`, `hint`, `error`, `prefix`, `suffix` | `ui/` | FE-05 |
| `Select` | `options`, `searchable`, `multi`, `groups` | `ui/` | FE-05 |
| `ScoreBadge` | `value` (number or null), `size`; null without a CV renders the dashed dash | `domain/` | FE-06 |
| `StageChip` | `stage`; colour and label from the tokens | `domain/` | FE-06 |
| `OutcomeBadge` | `outcome`; colour plus marker shape | `domain/` | FE-06 |
| `ApplicationCard` | `app`, `density` | `domain/` | FE-06 |
| `SilenceIndicator` | `days`, `threshold`; desaturates the card | `domain/` | FE-06 |
| `EmptyState` | `title`, `hint`, `action`, `progress` | `ui/` | FE-07 |
| `AsyncState` | state: `queued`, `processing`, `done`, `error` («у черзі / обробляється / готово / помилка») | `ui/` | FE-07 |

Platform-only components. #s22 calls this a design decision, not a missing
piece:

| Component | What | Platform | Owner |
| --- | --- | --- | --- |
| `Board` + `Column` | dnd-kit, keyboard drag | web | FE-11, FE-12 (keyboard FE-13) |
| `SankeyFunnel` | the whole path of every application | web | FE-34 |
| `DataTable` | TanStack Table: sort, select, columns | web | FE-24 |
| `CalendarGrid` | FullCalendar month and week | web | FE-22 |
| `StageRail` | stage rail instead of the board | RN | MOB-02 |
| `SwipeRow` | swipe to the next stage or to rejection | RN | MOB-02 |
| `ReminderScreen` | three actions from a push | RN | MOB-04 |
| `CompactFunnel` | vertical funnel and forecast | RN | MOB-05 |

Quick add on mobile (paste text) is MOB-03.

## Domain rules

The six rules every card respects:

| Rule | Where it lives |
| --- | --- |
| A percent only on a sample of 5 or more, otherwise «мало даних» with how many are missing; an insight from 10, a forecast from 15 | `THRESHOLDS` in `packages/shared/src/thresholds.ts` (`MIN_N_PERCENT` 5, `MIN_N_INSIGHT` 10, `MIN_N_FORECAST` 15), equal to `tokens.json` `dataRules`. Python reads it through the generated enums (AN-02) and applies it in AN-04 |
| Ghosted is excluded from conversions | AN-04 data rules module in `services/analytics`; AN-06 flags the ghost branch so the Sankey paints it grey |
| Rejection is never red: it is clay (terracotta, `#A96656`). Red is for system failures only | `tokens.json` `outcome.rejected`, emitted by DES-02; `OutcomeBadge` (FE-06); error panels use a terracotta stripe (FE-07) |
| State is never shown by colour alone: colour plus marker shape plus label | `tokens.json` `outcome.*.marker` (filled circle, circle with dash, dashed circle, circle with slash); `OutcomeBadge` and `StageChip` (FE-06); calendar events carry an icon (FE-22) |
| Every AI operation shows 4 states: queued, processing, done, error | `AsyncState` (FE-07), `ScoreBadge` (FE-06), job status API (BE-28) |
| Match Score without a CV is a dashed dash, never 0 | `matchScore` is nullable in `packages/shared/src/schemas/application.ts`; `ScoreBadge` renders null as the dashed dash (FE-06) |

The #s22 checklist before merge, with the check the design assigns:

| # | Item | Check | Owner |
| --- | --- | --- | --- |
| 1 | No colour outside the tokens; hex only through `chart-theme` | lint | DES-02, DES-04 |
| 2 | No icon outside lucide; `strokeWidth` 1.9; sizes 16, 20, 24 | lint | FE-05, FIN-02 |
| 3 | Every hover has a pressed pair (RN has no hover) | review | FE-05, MOB-01 |
| 4 | Focus visible everywhere: ring 2+2, never `outline: none` | a11y | FE-05 (`elevation.focus`) |
| 5 | Touch target at least 44 px even when the control is 28 to 36 | a11y | FE-05 |
| 6 | Text contrast at least 4.5:1; `ink-3` is the floor | a11y | DES-02, FIN-03 |
| 7 | State never by colour alone | a11y | FE-06 |
| 8 | Percent only on a sample of 5 or more, otherwise «мало даних» | domain | `packages/shared/src/thresholds.ts`, AN-04 |
| 9 | Rejection is not red (clay) | domain | DES-02, FE-06 |
| 10 | Ghost does not enter conversions | domain | AN-04 |
| 11 | An AI operation has 4 states | domain | FE-07 |
| 12 | `prefers-reduced-motion` turns off all motion, chart replays included | a11y | DES-03, FE-32 |

FIN-02 walks the whole list screen by screen at the end; DES-04 puts it in the
pull request template.

Also fixed by the handoff: `tabular-nums` on every number; controls 28, 32, 36
and 42 high with radii 8, 8, 9 and 10; layers flat, e1, e2, e3, accent and focus
instead of borders; motion 140, 180, 200 and 260 (spring, its own
`cubic-bezier(.34,1.56,.64,1)`) for the interface and 820 for chart data (45 ms
stagger); Unbounded for headings and big numbers, Onest for the interface.
Chart data animates with `easeOutQuart` (`motion.data.easing`), and
`cubic-bezier(.2,.8,.3,1)` (`motion.easing`) is the UI transition easing, so
the two cover different things and do not conflict.

## Libraries fixed by the design

| Purpose | Web | Version | Owner |
| --- | --- | --- | --- |
| Charts | Chart.js 4 + react-chartjs-2 | Chart.js 4 (the references use 4.4.1) | FE-32 |
| Sankey funnel | chartjs-chart-sankey | 0.19.1 (npm latest, peer `chart.js >=3.3.0`; the references use 0.12.1) | FE-32, FE-34 |
| Tables | @tanstack/react-table | | FE-24 |
| Calendar grid | FullCalendar 7 | `@fullcalendar/core` 7.1.3 (the references use 6.1.11) | FE-22 |
| Drag and drop | @dnd-kit/core + sortable | | FE-12, FE-13 |
| Icons | lucide-react, `strokeWidth` 1.9, sizes 16, 20, 24 | pinned in FE-05 | FE-05 |
| Styling | Tailwind 4 + shadcn/ui, restyled to the tokens; cmdk for searchable selects | | FE-02, FE-05 |
| Fonts | Unbounded + Onest (OFL, Google Fonts) | | DES-03 |

On mobile (optional) the pairs from #s21 apply: lucide-react-native,
victory-native instead of Chart.js, a vertical funnel instead of Sankey,
TanStack Table core with FlashList, a FlatList grid instead of FullCalendar,
NativeWind 4 with the same `tokens.json` (MOB-01).

## Gaps and contradictions

| Gap | Design says | Plan or code says | Resolution |
| --- | --- | --- | --- |
| Note length | #s6 draws a «/ 2000» counter on a field | BE-22: markdown notes up to 20 000 characters; `noteSchema.body` has no max today | Decision: 20 000. BE-22 adds `.max(20000)` to `noteSchema.body` in `packages/shared`, FE-19 shows the counter against that shared limit. The 2000 counter is a Field demo |
| Custom sources | #s7 Source select offers «Додати «…»» (free text) | Source is a fixed enum of 8 (DOC-03, `packages/shared/src/sources.ts`); analytics groups by it (AN-08) | Decision: no add row. The Source select lists the 8 `SOURCES` with their `labelUk`; anything else is `other`. The «+ додати» pattern stays for stack tags. Owners FE-05, FE-27 |
| Work.ua | `tokens.json` `taxonomy.sources` and the drawn source selects list 7 sources, no Work.ua | `SOURCES` in `packages/shared` has 8, including `workua` «Work.ua» (DOC-03) | Decision: `packages/shared` wins, 8 sources |
| Taxonomy in tokens | `tokens.json` carries `taxonomy` (stages, reasons, sources, AI states) and `dataRules` | Stages, reasons, sources and thresholds live in `packages/shared` | Decision: DES-02 generates visual tokens only and never enums from `taxonomy`. At most a test that `dataRules` equals `THRESHOLDS` (5, 10, 15, equal today). Owner DES-02 |
| Stage labels | Ukrainian labels: відгук, скринінг, техінтерв'ю, фінал, офер, відмова, ghosted, відкликав | `packages/shared` has no stage labels; sources and reasons carry `labelUk` | Decision: FE-06 adds `STAGE_LABELS: Record<Stage, { labelUk, labelEn }>` next to `STAGES` in `packages/shared/src/stages.ts` with the drawn labels |
| Withdrawn on the board | 5 open columns plus collapsed «відмова» and «ghosted» strips; «відкликав» has no place | FE-11 is silent on `withdrawn` | Decision: a third collapsed strip «відкликав» next to the other two, same pattern and tokens, the circle-with-slash marker and a count. Owner FE-11 |
| Select library | #s7 names react-select | DOC-05 and DOC-06 fix shadcn/ui and cmdk | Decision: shadcn Select, plus Popover with Command (cmdk) for searchable, multi and grouped variants, restyled to the drawn states (38 px, a divider before the indicators, 3 px focus halo). No react-select. Owner FE-05 |
| Calendar version | The references load fullcalendar 6.1.11, `tokens.json` says `fullcalendar@6` | DES-01, DOC-05, DOC-06 and FE-22 say FullCalendar 7 | Decision: FullCalendar 7. FE-22 pins `@fullcalendar/core` 7.1.3 and confirms the `--fc-*` variables used in #s20 exist on v7 |
| Sankey plugin version | The references load chartjs-chart-sankey 0.12.1 | No version in the plan | Decision: FE-32 uses chartjs-chart-sankey 0.19.1 with Chart.js 4 |
| Tailwind config | The handoff README says `tokens.json` generates `tailwind.config.ts` and `theme.ts` | Tailwind 4 is CSS first | Done in DES-02: `tokens.css`, a `@theme inline` `theme.css`, `chart-theme.ts` and `rn-theme.ts` in `packages/shared/tokens/generated/`, built by `pnpm tokens:build`; no `tailwind.config` |
| Dark gaps | The `dark` section has no `surface-3`, `line-soft` or `accent-ink`, and no dark stage or data colours | A light recess or light accent text on a dark page fails contrast | Resolved by DES-02 with existing dark values only: `surface-3` = dark `paper`, `line-soft` = dark `line`, `accent-ink` = dark `accent`. Stage and data colours keep their one value in both themes; a lifted dark ramp is for the chart cards (FE-32, FE-33) to define. In dark, `e1` to `e3` shadows are the empty shadow `0 0 #0000`; `flat`, `focus` and `accent` stay |
| Danger and scrim colours | Destructive actions and error text are drawn in `oklch(46% 0.10 34)` (#s5 to #s12), a value with no token. The #s13 modal dims the page with `ink` at .34 | `rejected` is the rejection outcome, not a system error, and gives 4.37:1 on `surface`, below 4.5:1. Dark `ink` is light, so an `ink` overlay would wash out a dark page | Decision: FE-05 adds `danger`, the drawn `oklch(46% 0.10 34)` (7.29:1 on `surface`), with the dark `rejected` value `oklch(70% 0.10 34)` as its dark entry. It also adds `scrim`, `oklch(25% 0.013 62)` with one value in both themes, for the modal overlay (`bg-scrim/34`). `rejected` stays for the rejection outcome only. Owner FE-05 |
| Skipping the rejection reason | The #s22 example has «Пропустити», the kanban modal has «Не хочу зараз вказувати» | DOC-03 defines `unspecified` (side `system`) | Decision: both record `unspecified`. With `ask_rejection_reason` off no modal shows and `unspecified` is recorded. Owners FE-14, BE-17 |
| Salary block | The dashboard draws salary analytics | AN-12 is P2, FE-37 is P1, FE-33 is P0 | Decision: FE-33 renders only blocks whose endpoint exists. The salary block appears with AN-12 and FE-37; until then it is absent, not a fake «мало даних» state |
| OAuth buttons | Login draws «Продовжити з Google» and «Продовжити з GitHub» | Email and password in BE-06 | Covered by FE-09 (behind a feature flag) and BE-13 |
| Sankey fallback | The dashboard has a fallback stacked funnel for when the Sankey plugin fails to load from the CDN | FE-32 installs the plugin from npm | Decision: the plugin is bundled, so there is no load-failure branch to build. FE-34's visually hidden table is the accessible alternative |
| Offline panel | «Працюєш офлайн»: moves and notes are saved locally and sync by themselves | FE-07 draws the panel, offline sync is FIN-08 (P3) | Decision: until FIN-08 lands, the FE-07 offline panel keeps the title, the «дані на HH:MM» line and retry, and leaves out the sentence that changes are saved locally. FIN-08 adds it back |
| Market benchmarks | Ghost rate «ринок 38%», screening «бенчмарк 22%» | AN-09 keeps sourced benchmark constants for the ghost rate only (cites 18 to 22% ghost jobs) | Decision: every benchmark comes from the AN-09 config with its source. A KPI without a sourced benchmark shows none; the drawn 38% and 22% are demo numbers. Owners AN-09, FE-33 |
| Missing count on a CV version | CV v3 with 3 applications shows «потрібно ще 7», which counts to 10 | Checklist item 8: percent from 5 (`MIN_N_PERCENT`) | Decision: a version row shows its percent from 5 applications and below that no percent, only «потрібно ще N» counted to 5 (so «потрібно ще 2» for 3). A version joins the A/B verdict at 10 (`MIN_N_INSIGHT`). Owners FE-30, AN-10 |
| Low data dashboard | On 4 applications the conversion KPI says «буде на 10 відгуках», «4 / 10» | Percent rule is 5 | Decision: FE-33 renders the whole dashboard in its low data state below `MIN_N_INSIGHT`; percents inside blocks follow `MIN_N_PERCENT` |
| Undo after rejection | The toast has «Скасувати перенос» | `stage_events` is append-only and `rejected` is terminal | Confirmed by BE-17: `undo-last` within 10 s inserts a compensating event, AN-04 drops both. FE-14 calls it |
| Notes and the model | The login screen promises that vacancy texts go to the model and notes never do, yet the follow-up draft mentions the interview task | AI-04 allow lists payload fields | Confirmed by AI-07: an optional user hint field carries such details, notes are never sent; AI-04 guards it |
| Silence on «фінал» | Settings: the threshold doubles on «фінал»; dashboard: it rises to 14 days | `effectiveSilenceDays(settings, stage)` | Confirmed by BE-33 (7 becomes 14 on final); FE-06 `SilenceIndicator` uses the same shared function |
| Auto ghost | «Переводити в ghosted після 30 днів тиші», revertible | Ghost detection with reason `silence_timeout`; `ghosted` can be revived (`ALLOWED_TRANSITIONS`) | Confirmed by BE-34, setting in FE-23 |
| Upload limit | «До 5 МБ», error panel for an 8,4 МБ file | | Confirmed by BE-29, FE-30 |
| Queue position and ETA | «у черзі · ~2 хв», «У черзі · 2 задачі перед твоєю» | | Confirmed by BE-28, FE-28 |
| Silence threshold suggestion | Suggested from the user's median response time | | Confirmed by FE-23, AN-09 |
| Push timing | At most one push a day per card, at 9:02, never at night | `quiet_hours` in `user_settings` | Confirmed by BE-36, MOB-04 |
| Monthly summary | First of the month at 7:00, by push and email, «Зберегти як план» | | Confirmed by AI-08, FE-45, BE-36; email is BE-37 (P2) |
| Reminder actions | «Відмітити відповідь», «Ще почекати · 3 дні» | Reminders API with done, snooze, dismiss | Confirmed by BE-33, FE-42, MOB-04 |
| AI timeout | «модель не відповіла за 30 секунд» | | Confirmed by AI-01 (timeout 30 s); the error state with «Написати самому» is AI-07 |
| Password rule | «Мінімум 10 символів» | | Confirmed by BE-06 |
| Search | Search by company, position, stack and notes; empty result state | | Confirmed by BE-16, FE-16 |
| Dense board | «Щільні», virtualised columns after 30 cards, keyboard drag | | Confirmed by FE-15, FE-13 |
| Scheduled calls and recruiter | «дзвінок сьогодні, 16:00» on cards, the recruiter block | | Confirmed by BE-23, FE-21, BE-21, FE-20 |
| Finished search and ghosts | «Заархівувати пошук», «Спробувати фоллоу-ап по 4 свіжих» | | Confirmed by BE-25, FE-43, FE-44 |
| Crash panel code | «код 5f3a» with time | | Confirmed by FE-07 (linked to the error tracker event id, OBS-04) |
| Icon lint | #s22 marks lucide-only and stroke 1.9 as a lint check | DES-04 lints raw colours only | Decision: `lucide-react` is the only icon package in `apps/web`, pinned in FE-05 with `strokeWidth` 1.9 as the default; FIN-02 reviews icons. No extra lint rule |
| Counts on the index | The index tags the design system «21 розділ» and says «вісім екранів»; DES-01 says 7 web screens | The package has #s1 to #s22; the index numbers screens 01 to 07, the companion is 07 | Decision: 22 sections, 6 web screens plus the mobile companion, plus the design system page. The «21 розділ» tag is stale |
| Calendar file | `Календар.dc.html` is not linked from the index | | Decision: it is the shared Calendar component, not a screen. It is opened directly and ported in FE-21 |
| Dashboard animation error | The dashboard reference replaces `Chart.defaults.animation` with a new object on each build pass until every chart exists, and Chart.js 4.4.1 sometimes throws `this._fn is not a function` in its animation tick; all 7 charts still draw | FE-33 builds the charts with react-chartjs-2 | Decision: a defect in the reference script only, not part of the design. FE-33 reads `motion.data` from the DES-02 chart theme (820 ms, `easeOutQuart`, 45 ms stagger, off under `prefers-reduced-motion`), sets it per chart in its options and never replaces `Chart.defaults.animation`. Owner FE-33 |
| Chart animation duration | The dashboard script sets 320 ms; `tokens.json` `motion.data` and the #s14 chart kit use 820 ms with a 45 ms stagger (900 for doughnut and radar in #s14) | DES-02 emits `chart-theme.ts` from `tokens.json` | Decision: `tokens.json` wins, 820 ms, `easeOutQuart`, 45 ms stagger. 320 is a value in the reference script, not the design. Owners DES-02, FE-33 |
