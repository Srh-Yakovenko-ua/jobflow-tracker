import pytest

from app.metrics.rate import Insufficient, Rate, insufficient, rate, wilson_interval


def test_four_applications_answer_insufficient_with_one_more_needed() -> None:
    assert rate(2, 4) == Insufficient(
        have=4, need=1, message="Ще 1 відгук до першого висновку"
    )


def test_no_applications_need_the_whole_percent_threshold() -> None:
    result = rate(0, 0)

    assert isinstance(result, Insufficient)
    assert (result.have, result.need) == (0, 5)


def test_five_applications_reach_the_percent_threshold() -> None:
    result = rate(4, 5)

    assert isinstance(result, Rate)
    assert (result.value, result.successes, result.trials) == (0.8, 4, 5)


@pytest.mark.parametrize(
    ("have", "message"),
    [
        (14, "Ще 1 відгук до першого висновку"),
        (13, "Ще 2 відгуки до першого висновку"),
        (10, "Ще 5 відгуків до першого висновку"),
        (4, "Ще 11 відгуків до першого висновку"),
    ],
)
def test_names_how_many_applications_are_missing_in_ukrainian(
    have: int, message: str
) -> None:
    result = insufficient(have, threshold=15)

    assert result is not None
    assert result.message == message


def test_a_sample_at_the_threshold_is_not_insufficient() -> None:
    assert insufficient(15, threshold=15) is None


@pytest.mark.parametrize(
    ("sample", "interval"),
    [
        ((81, 263), (0.2553, 0.3662)),
        ((15, 148), (0.0624, 0.1605)),
        ((0, 20), (0.0, 0.1611)),
        ((1, 29), (0.0061, 0.1718)),
    ],
)
def test_wilson_interval_matches_newcombe_1998_method_3(
    sample: tuple[int, int], interval: tuple[float, float]
) -> None:
    assert wilson_interval(*sample) == pytest.approx(interval, abs=5e-5)


def test_wilson_interval_of_no_successes_starts_at_exactly_zero() -> None:
    assert wilson_interval(0, 20)[0] == 0.0


def test_wilson_interval_of_only_successes_ends_at_exactly_one() -> None:
    assert wilson_interval(20, 20)[1] == 1.0


def test_a_rate_dumps_to_the_response_keys_with_its_status() -> None:
    dumped = rate(4, 5).model_dump(by_alias=True)

    assert sorted(dumped) == ["high", "low", "status", "successes", "trials", "value"]
    assert dumped["status"] == "ok"


def test_insufficient_data_dumps_with_its_status() -> None:
    assert rate(2, 4).model_dump(by_alias=True) == {
        "status": "insufficient_data",
        "have": 4,
        "need": 1,
        "message": "Ще 1 відгук до першого висновку",
    }
