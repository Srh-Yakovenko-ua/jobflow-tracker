from tests.metrics.match_validation_export import EXPORT_FILE, export_text


def test_the_committed_thesis_table_matches_the_metric() -> None:
    assert EXPORT_FILE.read_text(encoding="utf-8") == export_text()
