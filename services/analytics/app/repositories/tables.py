from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, Column, DateTime, Integer, MetaData, Table, Text, Uuid

metadata = MetaData()


def uuid_column(name: str) -> Column[UUID]:
    return Column(name, Uuid())


def moment_column(name: str) -> Column[datetime]:
    return Column(name, DateTime(timezone=True))


def integer_column(name: str) -> Column[int]:
    return Column(name, Integer())


def text_column(name: str) -> Column[str]:
    return Column(name, Text())


applications = Table(
    "applications",
    metadata,
    *map(uuid_column, ("id", "user_id", "search_id", "resume_version_id")),
    *map(text_column, ("source", "url", "current_stage", "work_mode", "currency")),
    *map(integer_column, ("salary_min", "salary_max", "match_score")),
    Column("is_draft", Boolean()),
    *map(
        moment_column,
        ("applied_at", "last_event_at", "deleted_at", "created_at", "updated_at"),
    ),
)

stage_events = Table(
    "stage_events",
    metadata,
    *map(uuid_column, ("id", "application_id", "compensates_event_id")),
    *map(text_column, ("from_stage", "to_stage", "reason_code")),
    moment_column("occurred_at"),
)

timeline_events = Table(
    "timeline_events",
    metadata,
    *map(uuid_column, ("id", "application_id")),
    text_column("kind"),
    moment_column("occurred_at"),
)

rejection_reasons = Table(
    "rejection_reasons",
    metadata,
    *map(text_column, ("code", "side")),
    integer_column("sort_order"),
)

resume_versions = Table(
    "resume_versions",
    metadata,
    *map(uuid_column, ("id", "user_id", "resume_id")),
    integer_column("number"),
    text_column("title"),
    Column("is_archived", Boolean()),
    *map(moment_column, ("uploaded_at", "created_at")),
)

scheduled_events = Table(
    "scheduled_events",
    metadata,
    *map(uuid_column, ("id", "application_id")),
    *map(text_column, ("kind", "status")),
    moment_column("starts_at"),
    integer_column("duration_min"),
)

user_settings = Table(
    "user_settings",
    metadata,
    uuid_column("user_id"),
    *map(integer_column, ("silence_days", "auto_ghost_days")),
    text_column("timezone"),
)

searches = Table(
    "searches",
    metadata,
    *map(uuid_column, ("id", "user_id")),
    *map(text_column, ("title", "status")),
    *map(moment_column, ("started_at", "finished_at")),
)
