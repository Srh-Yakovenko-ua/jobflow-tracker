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


def test_documents_401_and_422_on_every_analytics_route_as_the_problem_body(
    tmp_path: Path,
) -> None:
    target = tmp_path / "analytics-openapi.json"

    export_openapi(target)

    document = json.loads(target.read_text(encoding="utf-8"))
    problem_ref = {"$ref": "#/components/schemas/ProblemBody"}
    documented = {
        (path, status): document["paths"][path]["get"]["responses"][status]["content"][
            "application/json"
        ]["schema"]
        for path in OPENAPI_PATHS
        if path.startswith("/analytics/")
        for status in ("401", "422")
    }
    assert len(documented) == 24
    assert [schema for schema in documented.values() if schema != problem_ref] == []
    assert "HTTPValidationError" not in document["components"]["schemas"]
    assert document["components"]["schemas"]["ProblemBody"] == {
        "properties": {
            "type": {"type": "string", "minLength": 1, "title": "Type"},
            "title": {"type": "string", "minLength": 1, "title": "Title"},
            "status": {
                "type": "integer",
                "maximum": 599,
                "minimum": 400,
                "title": "Status",
            },
            "detail": {"type": "string", "title": "Detail"},
            "errors": {
                "items": {"$ref": "#/components/schemas/FieldError"},
                "type": "array",
                "title": "Errors",
            },
            "requestId": {"type": "string", "minLength": 1, "title": "Requestid"},
        },
        "type": "object",
        "required": ["type", "title", "status", "requestId"],
        "title": "ProblemBody",
    }
