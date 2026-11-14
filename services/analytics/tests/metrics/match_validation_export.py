from pathlib import Path
from typing import Final

from loguru import logger

from app.metrics.match_validation import (
    BucketName,
    MatchValidation,
    ScoreBucket,
    ScoreStatistics,
    StatisticsResult,
    decimal_uk,
    match_validation,
)
from app.metrics.rate import Rate, RateResult
from tests.metrics.match_validation_design import SCENARIOS

EXPORT_FILE: Final = (
    Path(__file__).resolve().parents[4] / "docs/thesis/data/match-validation.tsv"
)
BUCKET_LABELS: Final[dict[BucketName, str]] = {
    "below_50": "менше 50",
    "from_50_to_74": "50-74",
    "from_75": "75 і більше",
}
TOO_FEW: Final = "замало даних"
NOT_FITTED: Final = "немає"
BUCKETS_HEADER: Final = "Сценарій\tБал\tЗаявок\tДо скринінгу\tДо інтерв'ю"
STATISTICS_HEADER: Final = "Сценарій\tr\tp\tНахил на 10 балів\t95% ДІ нахилу\tВисновок"
SHARE_DIGITS: Final = 2
TEST_DIGITS: Final = 3


def interval(low: float, high: float) -> str:
    return f"[{decimal_uk(low, digits=SHARE_DIGITS)}; {decimal_uk(high, digits=SHARE_DIGITS)}]"


def share_text(share: RateResult) -> str:
    if not isinstance(share, Rate):
        return TOO_FEW
    return f"{decimal_uk(share.value, digits=SHARE_DIGITS)} {interval(share.low, share.high)}"


def bucket_line(scenario: str, bucket: ScoreBucket) -> str:
    return "\t".join(
        [
            scenario,
            BUCKET_LABELS[bucket.bucket],
            str(bucket.applications),
            share_text(bucket.screening),
            share_text(bucket.interview),
        ]
    )


def statistics_cells(statistics: StatisticsResult) -> list[str]:
    if not isinstance(statistics, ScoreStatistics):
        return [TOO_FEW] * 4
    regression = statistics.regression
    slope = (
        [NOT_FITTED] * 2
        if regression is None
        else [
            decimal_uk(regression.slope, digits=SHARE_DIGITS),
            interval(regression.low, regression.high),
        ]
    )
    return [
        decimal_uk(statistics.correlation, digits=TEST_DIGITS),
        decimal_uk(statistics.p_value, digits=TEST_DIGITS),
        *slope,
    ]


def statistics_line(scenario: str, result: MatchValidation) -> str:
    statistics = result.statistics
    return "\t".join([scenario, *statistics_cells(statistics), statistics.message])


def export_text() -> str:
    results = {
        name: match_validation(built.events, scores=built.scores)
        for name, build in SCENARIOS.items()
        for built in [build()]
    }
    return "\n".join(
        [
            BUCKETS_HEADER,
            *(
                bucket_line(name, bucket)
                for name, result in results.items()
                for bucket in result.buckets
            ),
            "",
            STATISTICS_HEADER,
            *(statistics_line(name, result) for name, result in results.items()),
            "",
        ]
    )


def main() -> None:
    EXPORT_FILE.write_text(export_text(), encoding="utf-8")
    logger.info("wrote {path}", path=EXPORT_FILE.name)


if __name__ == "__main__":
    main()
