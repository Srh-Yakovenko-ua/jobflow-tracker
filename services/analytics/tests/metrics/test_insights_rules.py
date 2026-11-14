from collections.abc import Callable
from dataclasses import replace
from typing import Any

import pytest

from app.metrics.forecast import NO_REPLY, Forecast, WeeksRange
from app.metrics.funnel import FunnelStage
from app.metrics.ghost_market import GhostRateVsMarket, ghost_rate_vs_market
from app.metrics.insights import engine
from app.metrics.insights.engine import (
    Insight,
    InsightAction,
    InsightMetrics,
    insight_rule,
    insights,
)
from app.metrics.insights.inputs import stage_what_if
from app.metrics.insights.rules.dominant_reason import dominant_reason
from app.metrics.insights.rules.entry_leak import later_narrowing, narrowest_step
from app.metrics.insights.rules.ghosts import ghost_share
from app.metrics.insights.rules.most_expensive import (
    most_expensive_stage,
    practice_costly_stage,
)
from app.metrics.insights.rules.resume_switch import keep_winning_resume, resume_switch
from app.metrics.insights.rules.source_gap import (
    cut_weak_source,
    lean_on_strong_source,
    weak_and_strong_source,
)
from app.metrics.most_expensive import MostExpensiveStage
from app.metrics.rate import Insufficient, Rate, rate
from app.metrics.reasons import reasons
from app.metrics.reasons_trend import TopReason
from app.metrics.resume_ab import Verdict
from app.metrics.sources import SourcePerformance
from tests.metrics import funnel_design
from tests.metrics.funnel_design import TECH_INTERVIEW
from tests.metrics.insights_design import design_metrics, one_source_metrics
from tests.metrics.reasons_design import DESIGN_NOW
from tests.metrics.resume_ab_design import Cohort, ab_events, ab_links
from tests.metrics.sankey_fixtures import (
    APPLIED,
    cohort,
    reasoned_frame,
    rejected_at,
)

TINY_COHORTS = [
    Cohort(1, "screening", 1, 0),
    Cohort(1, "rejected", 1, 0),
    Cohort(2, "screening", 1, 30),
    Cohort(2, "rejected", 1, 30),
]


@pytest.fixture(name="metrics")
def design_fixture_metrics() -> InsightMetrics:
    return design_metrics()


def step(stage: str, *, reached: int, passed: int) -> FunnelStage:
    return FunnelStage(
        stage=stage,
        reached=reached,
        passed=passed,
        conversion=rate(passed, reached),
        drop_off={"rejected": reached - passed, "ghosted": 0, "withdrawn": 0},
    )


def tiny_metrics() -> InsightMetrics:
    return one_source_metrics(
        ab_events(TINY_COHORTS), source="linkedin", links=ab_links(TINY_COHORTS)
    )


def with_comparison(metrics: InsightMetrics, update: dict[str, Any]) -> InsightMetrics:
    comparison = metrics.resume_ab.comparison
    assert comparison is not None
    resume_ab = metrics.resume_ab.model_copy(
        update={"comparison": comparison.model_copy(update=update)}
    )
    return replace(metrics, resume_ab=resume_ab)


def fallen(metrics: InsightMetrics) -> InsightMetrics:
    comparison = metrics.resume_ab.comparison
    assert comparison is not None
    switch = comparison.switch
    fell = switch.model_copy(update={"before": switch.after, "after": switch.before})
    return with_comparison(metrics, {"switch": fell})


def evened(metrics: InsightMetrics) -> InsightMetrics:
    comparison = metrics.resume_ab.comparison
    assert comparison is not None
    before = comparison.switch.before
    assert isinstance(before, Rate)
    after = before.model_copy(update={"value": before.value + 0.001})
    return with_comparison(
        metrics, {"switch": comparison.switch.model_copy(update={"after": after})}
    )


def baseline_wins(metrics: InsightMetrics) -> InsightMetrics:
    verdict = Verdict(winner=1, message="CV v1 працює краще")
    return with_comparison(metrics, {"verdict": verdict})


def with_sources(
    metrics: InsightMetrics, listed: list[SourcePerformance]
) -> InsightMetrics:
    return replace(
        metrics, sources=metrics.sources.model_copy(update={"sources": listed})
    )


def without_gap(metrics: InsightMetrics) -> InsightMetrics:
    kept = [
        source
        for source in metrics.sources.sources
        if source.source in {"linkedin", "referral"}
    ]
    return with_sources(metrics, kept)


def ghost_market(ghosted: int, applications: int) -> GhostRateVsMarket:
    return ghost_rate_vs_market(
        reasoned_frame(
            [
                *cohort(APPLIED, end=("ghosted", None), count=ghosted),
                *cohort(APPLIED, end=("rejected", None), count=applications - ghosted),
            ]
        )
    )


def with_likely(metrics: InsightMetrics, likely: WeeksRange) -> InsightMetrics:
    what_if = metrics.stage_what_if
    assert isinstance(what_if, Forecast)
    return replace(metrics, stage_what_if=what_if.model_copy(update={"likely": likely}))


def test_names_a_later_stage_when_the_funnel_narrows_after_the_entry(
    metrics: InsightMetrics,
) -> None:
    stages = [
        step("applied", reached=20, passed=12),
        step("screening", reached=12, passed=3),
        step("tech_interview", reached=3, passed=1),
    ]

    said = narrowest_step(replace(metrics, stages=stages))

    assert said == Insight(
        block="funnel",
        title="Далі об'єм відгуків уже не допоможе",
        body="Воронка звужується не на вході, а на скринінгу: пройшли 3 із 12.",
        severity="warning",
        evidence={"stage": "screening", "passed": 3, "trials": 12},
    )


def test_a_ghosted_drop_off_leaves_the_funnel_row_count_in_the_narrowing(
    metrics: InsightMetrics,
) -> None:
    ghosted = step("tech_interview", reached=9, passed=3).model_copy(
        update={
            "conversion": rate(3, 8),
            "drop_off": {"rejected": 5, "ghosted": 1, "withdrawn": 0},
        }
    )
    stages = [
        step("applied", reached=20, passed=12),
        step("screening", reached=12, passed=9),
        ghosted,
    ]

    said = narrowest_step(replace(metrics, stages=stages))

    assert said is not None
    assert (said.body, said.evidence) == (
        "Воронка звужується не на вході, а на техінтерв'ю: пройшли 3 із 9.",
        {"stage": "tech_interview", "passed": 3, "trials": 8},
    )


def test_a_loss_under_half_a_day_leaves_out_the_cost_clause(
    metrics: InsightMetrics,
) -> None:
    costliest = metrics.most_expensive
    assert isinstance(costliest, MostExpensiveStage)
    cheap = costliest.model_copy(update={"invested_days_median": 0.3})

    said = most_expensive_stage(replace(metrics, most_expensive=cheap))

    assert said is not None
    assert said.body == "Дійшло 9, пройшли 4."


@pytest.mark.parametrize(
    ("count", "reached", "passed"),
    [
        (1, "Дійшов 1", "пройшов 1"),
        (21, "Дійшов 21", "пройшов 21"),
        (8, "Дійшло 8", "пройшло 8"),
    ],
    ids=["1", "21", "8"],
)
def test_the_verbs_agree_with_the_count_they_stand_by(
    metrics: InsightMetrics, *, count: int, reached: str, passed: str
) -> None:
    costliest = metrics.most_expensive
    assert isinstance(costliest, MostExpensiveStage)
    counted = costliest.model_copy(update={"reached": count, "passed": count})
    conversion = rate(count, 40)
    assert isinstance(conversion, Rate)

    expensive = most_expensive_stage(replace(metrics, most_expensive=counted))
    narrowing = later_narrowing(
        step("screening", reached=40, passed=count), conversion=conversion
    )

    assert expensive is not None
    assert (expensive.body.split(". ")[0], narrowing.body) == (
        f"{reached}, {passed}",
        f"Воронка звужується не на вході, а на скринінгу: {passed} із 40.",
    )


def test_titles_a_candidate_side_leader_as_your_own_refusal(
    metrics: InsightMetrics,
) -> None:
    top = TopReason(stage="final", code="low_salary", count=5, of=21)
    leading = metrics.reasons.model_copy(update={"headline": top})

    said = dominant_reason(replace(metrics, reasons=leading))

    assert said is not None
    assert (said.title, said.body) == (
        "На фінальній співбесіді ти найчастіше відмовляєш сам: «низька вилка»",
        "5 із 21 відмови на цьому етапі — «низька вилка».",
    )


def test_says_nothing_about_reasons_when_two_lead_with_the_same_count(
    metrics: InsightMetrics,
) -> None:
    tied = reasoned_frame(
        [
            *rejected_at(TECH_INTERVIEW, reason="skills_gap", count=2),
            *rejected_at(TECH_INTERVIEW, reason="english_level", count=2),
            *cohort(APPLIED, end=("ghosted", None), count=6),
        ]
    )
    leading = reasons(tied, stage=None, now=DESIGN_NOW)

    assert leading.headline is None
    assert dominant_reason(replace(metrics, reasons=leading)) is None


@pytest.mark.parametrize(
    ("ghosted", "applications", "title", "body"),
    [
        (
            2,
            20,
            "2 компанії не відповіли",
            "Це 10% твоїх відгуків — на 8 п.п. менше за ринок.",
        ),
        (
            21,
            50,
            "21 компанія не відповіла",
            "Це 42% твоїх відгуків — на 20 п.п. більше за ринок.",
        ),
    ],
    ids=["below", "21 companies"],
)
def test_compares_the_ghost_share_with_the_market(
    metrics: InsightMetrics,
    *,
    ghosted: int,
    applications: int,
    title: str,
    body: str,
) -> None:
    said = ghost_share(replace(metrics, ghosts=ghost_market(ghosted, applications)))

    assert said is not None
    assert (said.title, said.body) == (title, body)


@pytest.mark.parametrize(
    ("ghosted", "applications"),
    [(0, 20), (4, 20), (21, 100), (23, 103)],
    ids=["no silent company", "within", "21 within", "0 points above"],
)
def test_says_nothing_about_ghosts_without_silence_or_a_gap(
    metrics: InsightMetrics, *, ghosted: int, applications: int
) -> None:
    assert (
        ghost_share(replace(metrics, ghosts=ghost_market(ghosted, applications)))
        is None
    )


def test_compares_no_sources_while_only_one_source_has_a_rate(
    metrics: InsightMetrics,
) -> None:
    assert weak_and_strong_source(without_gap(metrics)) is None


def test_every_rule_stays_silent_on_insufficient_metrics() -> None:
    tiny = tiny_metrics()
    comparison = tiny.resume_ab.comparison
    assert comparison is not None
    measured = [
        tiny.most_expensive,
        tiny.reasons.headline,
        tiny.ghosts.rate,
        comparison.verdict,
        *(stage.conversion for stage in tiny.stages if stage.conversion),
        *(source.conversion for source in tiny.sources.sources),
    ]

    assert all(isinstance(metric, Insufficient) for metric in measured)
    assert [rule(tiny) for rule in engine.RULES] == [None] * 6
    assert [rule(tiny) for rule in engine.ACTION_RULES] == [None] * 4


def test_a_rule_declared_anywhere_joins_the_insights_without_an_engine_edit(
    metrics: InsightMetrics, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(engine, "RULES", [*engine.RULES])

    @insight_rule
    def declared_here(_: InsightMetrics) -> Insight:
        return Insight(
            block="ghosted", title="declared", body="", severity="neutral", evidence={}
        )

    titles = [insight.title for insight in insights(metrics).insights]

    assert [rule.__name__ for rule in engine.RULES] == [
        "dominant_reason",
        "narrowest_step",
        "ghost_share",
        "most_expensive_stage",
        "resume_switch",
        "weak_and_strong_source",
        "declared_here",
    ]
    assert titles[-2:] == ["17 компаній не відповіли", "declared"]


@pytest.mark.parametrize("what_if", [None, NO_REPLY], ids=["no what-if", "no reply"])
def test_advises_no_practice_without_an_ok_what_if_forecast(
    metrics: InsightMetrics, what_if: Insufficient | None
) -> None:
    assert practice_costly_stage(replace(metrics, stage_what_if=what_if)) is None


def test_advises_no_practice_when_the_likely_range_runs_past_the_horizon(
    metrics: InsightMetrics,
) -> None:
    open_ended = with_likely(metrics, WeeksRange(low=30.0, high=None))

    assert practice_costly_stage(open_ended) is None


def test_names_the_next_final_round_and_one_week_in_the_genitive(
    metrics: InsightMetrics,
) -> None:
    costliest = metrics.most_expensive
    assert isinstance(costliest, MostExpensiveStage)
    final = costliest.model_copy(update={"stage": "final"})
    short = with_likely(metrics, WeeksRange(low=0.4, high=1.0))

    said = practice_costly_stage(replace(short, most_expensive=final))

    assert said == InsightAction(
        block="funnel",
        title="Підготуватися до наступної фінальної співбесіди",
        expected_effect="Прогноз офера звузиться до 1 тижня, якщо конверсія дійде до 60%.",
    )


@pytest.mark.parametrize(
    ("likely", "weeks"),
    [
        (WeeksRange(low=0.4, high=2.5), "до діапазону від 1 до 3 тижнів"),
        (WeeksRange(low=2.6, high=3.4), "до 3 тижнів"),
    ],
    ids=["a range starts at one week and rounds half up", "meeting bounds"],
)
def test_rounds_the_practice_effect_like_the_forecast_block(
    metrics: InsightMetrics, *, likely: WeeksRange, weeks: str
) -> None:
    said = practice_costly_stage(with_likely(metrics, likely))

    assert said is not None
    assert said.expected_effect == (
        f"Прогноз офера звузиться {weeks}, якщо конверсія дійде до 60%."
    )


def test_runs_no_what_if_once_the_costliest_stage_passes_sixty_percent(
    metrics: InsightMetrics,
) -> None:
    costliest = metrics.most_expensive
    assert isinstance(costliest, MostExpensiveStage)
    at_target = costliest.model_copy(update={"reached": 10, "passed": 6})

    what_if = stage_what_if(
        funnel_design.design_frame(),
        costliest=at_target,
        now=funnel_design.DESIGN_NOW,
    )

    assert what_if is None


def test_advises_nothing_about_sources_without_a_source_gap(
    metrics: InsightMetrics,
) -> None:
    quiet = without_gap(metrics)

    assert (cut_weak_source(quiet), lean_on_strong_source(quiet)) == (None, None)


def test_keeps_the_weak_source_when_the_comparison_gives_no_more_screenings(
    metrics: InsightMetrics,
) -> None:
    listed = [
        source.model_copy(update={"screenings": 2})
        if source.source == "djinni"
        else source
        for source in metrics.sources.sources
    ]

    assert cut_weak_source(with_sources(metrics, listed)) is None


def test_leans_on_a_rated_source_by_name_without_the_small_sample_note(
    metrics: InsightMetrics,
) -> None:
    djinni, *rest = metrics.sources.sources
    rated = djinni.model_copy(
        update={
            "source": "workua",
            "applications": 10,
            "screenings": 9,
            "conversion": rate(9, 10),
        }
    )
    listed = [rated, djinni, *(source for source in rest if source.note is None)]

    said = lean_on_strong_source(with_sources(metrics, listed))

    assert said == InsightAction(
        block="sources",
        title="Більше відгуків через Work.ua",
        expected_effect="9 скринінгів на 10 відгуків через Work.ua.",
    )


@pytest.mark.parametrize(
    "changed",
    [fallen, baseline_wins, evened],
    ids=["conversion fell", "baseline wins", "percents round equal"],
)
def test_says_nothing_about_the_resume_unless_the_challenger_wins_and_grows(
    metrics: InsightMetrics, changed: Callable[[InsightMetrics], InsightMetrics]
) -> None:
    assert (resume_switch(changed(metrics)), keep_winning_resume(changed(metrics))) == (
        None,
        None,
    )
