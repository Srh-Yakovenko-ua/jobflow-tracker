from typing import get_args

from app.core.errors import DocumentFailure
from app.core.limits import LIMITS


def test_documents_error_types_equal_the_shared_failure_list() -> None:
    assert get_args(DocumentFailure.__value__) == LIMITS.failures
