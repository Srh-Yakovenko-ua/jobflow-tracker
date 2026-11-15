import os
import sys
from uuid import UUID

from allauth.account.models import EmailAddress
from django.db import transaction

from apps.api_tokens.models import APIToken
from apps.organizations_ext.models import Organization
from apps.projects.models import Project, ProjectKey
from apps.teams.models import Team
from apps.users.models import User

SLUG = "jobflow"
DSN_PROJECT_ID = 1
UPLOAD_SCOPES = [
    "org:read",
    "project:read",
    "project:write",
    "project:releases",
    "event:read",
]


def ensure_admin() -> User:
    email = os.environ["GLITCHTIP_ADMIN_EMAIL"]
    user = User.objects.filter(email=email).first()
    if user is None:
        user = User.objects.create_superuser(
            email=email, password=os.environ["GLITCHTIP_ADMIN_PASSWORD"]
        )
    EmailAddress.objects.get_or_create(
        user=user, email=email, defaults={"primary": True, "verified": True}
    )
    return user


def ensure_project(user: User) -> Project:
    organization, _ = Organization.objects.get_or_create(
        slug=SLUG, defaults={"name": SLUG}
    )
    if not organization.users.filter(pk=user.pk).exists():
        organization.add_user(user)
    project, _ = Project.objects.get_or_create(
        slug=SLUG, organization=organization, defaults={"name": SLUG}
    )
    if project.pk != DSN_PROJECT_ID:
        sys.exit(
            f"project {SLUG} has id {project.pk}, the DSN expects {DSN_PROJECT_ID}"
        )
    team, _ = Team.objects.get_or_create(slug=SLUG, organization=organization)
    team.members.add(organization.organization_users.get(user=user))
    team.projects.add(project)
    return project


def ensure_upload_token(user: User) -> None:
    value = os.environ["SENTRY_AUTH_TOKEN"]
    token = APIToken.objects.filter(token=value).first()
    if token is None:
        token = APIToken.objects.create(
            user=user, label="jobflow sourcemaps", token=value
        )
    token.add_permissions(UPLOAD_SCOPES)


def bootstrap() -> None:
    with transaction.atomic():
        user = ensure_admin()
        project = ensure_project(user)
        key, _ = ProjectKey.objects.get_or_create(
            project=project,
            public_key=UUID(os.environ["GLITCHTIP_DSN_KEY"]),
            defaults={"name": SLUG},
        )
        ensure_upload_token(user)
    sys.stdout.write(f"SENTRY_DSN={key.get_dsn()}\n")


bootstrap()
