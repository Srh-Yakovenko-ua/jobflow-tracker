# Offer forecast

`GET /analytics/forecast` answers "when will I get an offer?" as a range of
weeks, from the user's own `stage_events`. It is a Monte Carlo simulation over
the current search (or `searchId`).

## When it answers

- Below 15 applications (`MIN_N_FORECAST`) it answers `insufficient_data`.
- With 15 or more applications and no company reply yet (no recorded stay at
  any stage) it answers `insufficient_data` with have 0, need 1, because the
  time model would have no data.

## Model

1. **Pass probabilities.** Each active stage (`applied`, `screening`,
   `tech_interview`, `final`) has a Beta(1 + s, 1 + f) posterior: a Beta(1,1)
   prior plus the user's own successes and failures. Successes s
   are applications that reached a later stage (a skipped stage counts as
   passed, as in the funnel). Failures f are applications that ended at the
   stage as rejected or withdrawn. Ghosted and still-open applications are
   censored: they count on neither side.
2. **Time in stage.** Stays are bootstrapped from the user's own history (the
   same stays as the timings endpoint). A stage with no stays borrows the
   pooled stays of all stages.
3. **Application rate.** Applications started in the last 28 days, divided by
   the weeks since the first application, clamped to 1..4. The what-if
   `applicationsPerWeek` replaces it.
4. **Simulation.** 10 000 runs with a fixed seed, so a request always gives
   the same body.
   - Open applications at an active stage are in flight. Each one needs to
     pass its remaining stages. Its remaining time is a sampled stay at its
     stage minus the days already spent there (never below 0), plus sampled
     stays for the later stages.
   - New applications that end in an offer form a Poisson process thinned by
     the product of the four pass probabilities. The first 64 such arrivals
     are drawn as cumulative exponential gaps divided by rate x product, each
     with a bootstrapped duration.
   - The first offer is the earliest among both groups. A run with no offer
     within 52 weeks counts as "beyond the horizon".
5. **Result.** The median, `likely` (p25 to p75) and `interval` (p10 to p90),
   taken with `inverted_cdf` so each bound is a simulated value. A bound
   beyond 52 weeks is `null`. `withinFourWeeks` and `withinEightWeeks` are the
   shares of runs with an offer by then.

## Why a higher rate is never later

The simulation uses common random numbers. Every random draw has a shape that
does not depend on the rate, and the draws come in a fixed order (Beta,
in-flight, new applications). The rate only rescales the arrival times, so with
the same seed each run's first offer can only move earlier as the rate grows.
More applications a week therefore never makes the median, a bound or a share
worse. This holds exactly, not just on average, so
`tests/metrics/test_forecast_properties.py` checks it with hypothesis over rate
pairs and with a grid of rates from 0 to 16, and it cannot flake.

## What if

- `?applicationsPerWeek=6` simulates another pace (a finite number, 0 or more).
- `?improve=tech_interview:0.6` sets that stage's pass probability to 0.6 in
  every run (an active stage, a value above 0 up to 1).

## Known limits

- The clip at 0 treats an application that has waited longer than any
  recorded stay as about to move on. A long-silent application is optimistic
  until it is marked ghosted.
- Repeat technical rounds are counted per round. Each `tech_interview` event
  adds its own stay to the pool, while the simulation samples one stay per
  application, so a user with several rounds gets a tech stage that looks
  shorter than it is.
- Skipped stages are still sampled. A skip counts as a pass for the
  probabilities, but every simulated application spends a sampled stay in all
  four stages, which makes the forecast a little late for users who often
  skip screening.
- Stays seen early in a search are biased short, since the long ones have not
  finished yet.
- Only the first 64 offered arrivals per run are simulated. When more than 64
  would fit inside the horizon, the later ones are dropped. Each of them comes
  after 64 earlier arrivals with durations from the same pool, so it would
  almost never be the earliest offer.

## Backtest

```sh
cd services/analytics && uv run python -m scripts.backtest_forecast
```

The script builds 200 synthetic users with fixed conversions (0.45, 0.5, 0.45, 0.6), 4.5
applications a week (Poisson) and gamma stays with means of 6, 8, 9 and 14
days. Each history is cut at week 4, the forecast is made at the cut, and it
is compared with the first offer that actually came after the cut.

| Measure                                                | Value         |
| ------------------------------------------------------ | ------------- |
| Users                                                  | 200           |
| Forecast made (15+ applications and a reply by week 4) | 154           |
| Actual first offer inside the 80% interval             | 93.5%         |
| Median absolute error of the median                    | 2.4 weeks     |
| Offer within 4 weeks: observed / mean predicted        | 50.0% / 53.2% |
| Offer within 8 weeks: observed / mean predicted        | 79.9% / 65.5% |

The interval covers more than 80% of the users: four weeks of history leave
the pass probabilities of the later stages wide, and the forecast says so. The
8-week share is predicted low, probably because the Beta(1,1) prior pulls the
rarely seen `final` stage (0.6 in the synthetic users) towards 0.5.
`tests/scripts/test_backtest_forecast.py` runs 50 users and checks that two
runs give the same report and that the 80% interval covers at least 60% of
them.
