from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.services.reasons_cache import reasons_summary_key
from tests.factories import SEARCH_ID, USER_ID

STAMP = datetime(2026, 11, 2, 9, 0, 0, 123456, tzinfo=UTC)
PREFIX = f"analytics:{USER_ID}:reasons-summary:screening"

KEYS = {
    "no active search, changed": (None, STAMP, f"{PREFIX}:none:1793610000123"),
    "one search, changed": (SEARCH_ID, STAMP, f"{PREFIX}:{SEARCH_ID}:1793610000123"),
    "nothing recorded yet": (None, None, f"{PREFIX}:none:none"),
}


@pytest.mark.parametrize(
    ("search_id", "stamp", "key"), list(KEYS.values()), ids=list(KEYS)
)
def test_keys_the_summary_by_user_stage_search_and_last_change_in_epoch_ms(
    search_id: UUID | None, *, stamp: datetime | None, key: str
) -> None:
    assert (
        reasons_summary_key(
            user_id=USER_ID, stage="screening", search_id=search_id, stamp=stamp
        )
        == key
    )
