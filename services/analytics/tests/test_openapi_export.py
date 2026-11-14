import json
from pathlib import Path

from app.openapi_export import export_openapi
from tests.factories import OPENAPI_PATHS


def test_writes_the_health_and_metric_paths_without_an_env_file(
    tmp_path: Path,
) -> None:
    target = tmp_path / "build" / "api" / "analytics-openapi.json"

    export_openapi(target)

    text = target.read_text(encoding="utf-8")
    document = json.loads(text)
    assert sorted(document["paths"]) == OPENAPI_PATHS
    assert document["info"]["title"] == "JobFlow Analytics"
    assert (text[:14], text[-2:]) == ('{\n  "openapi":', "}\n")
