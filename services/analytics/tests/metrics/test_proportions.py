import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.metrics.proportions import (
    Counts,
    ProportionTest,
    fisher_exact,
    probability_better,
    proportion_test,
    z_test,
)

DESIGN_V2 = Counts(11, 27)
DESIGN_V1 = Counts(5, 21)


@st.composite
def counts(draw: st.DrawFn) -> Counts:
    trials = draw(st.integers(min_value=0, max_value=40))
    return Counts(draw(st.integers(min_value=0, max_value=trials)), trials)


def test_gives_the_design_numbers_a_two_sided_z_test_p_of_0_217() -> None:
    assert z_test(DESIGN_V2, DESIGN_V1) == pytest.approx(0.2170, abs=1e-4)


@pytest.mark.parametrize(
    ("challenger", "baseline", "expected"),
    [
        (DESIGN_V2, DESIGN_V1, 0.3549),
        (Counts(2, 2), Counts(0, 2), 0.3333),
        (Counts(1, 2), Counts(0, 2), 1.0),
    ],
    ids=["design", "2 of 2 against 0 of 2", "1 of 2 against 0 of 2"],
)
def test_sums_the_tables_no_likelier_than_the_observed_one_for_fisher(
    challenger: Counts, *, baseline: Counts, expected: float
) -> None:
    assert fisher_exact(challenger, baseline) == pytest.approx(expected, abs=1e-4)


def test_puts_the_chance_that_cv_v2_beats_cv_v1_near_the_closed_form() -> None:
    assert probability_better(DESIGN_V2, DESIGN_V1) == pytest.approx(0.8836, abs=0.005)


def test_draws_the_same_probability_on_every_run() -> None:
    assert probability_better(DESIGN_V2, DESIGN_V1) == probability_better(
        DESIGN_V2, DESIGN_V1
    )


@pytest.mark.parametrize(
    ("challenger", "baseline", "expected"),
    [
        (DESIGN_V2, DESIGN_V1, ProportionTest("z_test", 0.2170)),
        (Counts(2, 2), Counts(0, 2), ProportionTest("fisher_exact", 0.3333)),
        (Counts(13, 14), Counts(9, 10), ProportionTest("fisher_exact", 1.0)),
        (Counts(0, 0), Counts(0, 0), ProportionTest("fisher_exact", 1.0)),
    ],
    ids=["every cell from 5", "two per version", "one failure cell below 5", "empty"],
)
def test_switches_to_fisher_when_an_expected_cell_is_below_5(
    challenger: Counts, *, baseline: Counts, expected: ProportionTest
) -> None:
    assert proportion_test(challenger, baseline) == pytest.approx(expected, abs=1e-4)


@settings(deadline=None, derandomize=True, max_examples=60)
@given(challenger=counts(), baseline=counts())
def test_keeps_the_p_value_and_the_probability_between_0_and_1(
    challenger: Counts, baseline: Counts
) -> None:
    tested = proportion_test(challenger, baseline)
    better = probability_better(challenger, baseline)

    assert (0 <= tested.p_value <= 1, 0 <= better <= 1) == (True, True)
