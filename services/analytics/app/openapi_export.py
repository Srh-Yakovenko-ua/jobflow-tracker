import json
import sys
from pathlib import Path

from app.core.config import Settings
from app.factory import create_app

OFFLINE_SETTINGS = Settings(
    _env_file=None,
    database_url_analytics="postgresql://jobflow_analytics@localhost:5432/jobflow",
    redis_url="redis://localhost:6379",
    api_url="http://localhost:4000",
    web_origin="http://localhost:3000",
)


def export_openapi(target: Path) -> None:
    document = create_app(OFFLINE_SETTINGS).openapi()
    text = json.dumps(document, indent=2, ensure_ascii=False) + "\n"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    export_openapi(Path(sys.argv[1]))
