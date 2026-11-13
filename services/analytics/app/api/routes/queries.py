from typing import Annotated
from uuid import UUID

from fastapi import Query

SearchIdQuery = Annotated[UUID | None, Query(alias="searchId")]
