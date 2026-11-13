from scripts.backtest_forecast import run_backtest

USERS = 50
MIN_COVERAGE = 0.6


def test_reports_the_same_backtest_on_every_run() -> None:
    assert run_backtest(users=USERS) == run_backtest(users=USERS)


def test_covers_most_actual_first_offers_with_the_80_percent_interval() -> None:
    report = run_backtest(users=USERS)

    assert report.forecasted > 0
    assert report.interval_coverage >= MIN_COVERAGE, report
