from __future__ import annotations

import logging

from rest_framework.request import Request

from sentry import options
from sentry.api.api_owners import ApiOwner
from sentry.api.base import Endpoint
from sentry.api.bases.project import ProjectPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.group import Group, GroupStatus, get_group_with_redirect
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization
from sentry.tasks.integrations import create_comment, update_comment
from sentry.utils.sdk import bind_organization_context, configure_scope

logger = logging.getLogger(__name__)

EXCLUDED_STATUSES = (
    GroupStatus.PENDING_DELETION,
    GroupStatus.DELETION_IN_PROGRESS,
    GroupStatus.PENDING_MERGE,
)


class GroupPermission(ProjectPermission):
    scope_map = {
        "GET": ["event:read", "event:write", "event:admin"],
        "POST": ["event:write", "event:admin"],
        "PUT": ["event:write", "event:admin"],
        "DELETE": ["event:admin"],
    }

    def has_object_permission(self, request: Request, view, group):
        return super().has_object_permission(request, view, group.project)


class GroupEndpoint(Endpoint):
    owner = ApiOwner.ISSUES
    permission_classes = (GroupPermission,)

    def convert_args(self, request: Request, issue_id, organization_slug=None, *args, **kwargs):
        # TODO(tkaemming): Ideally, this would return a 302 response, rather
        # than just returning the data that is bound to the new group. (It
        # technically shouldn't be a 301, since the response could change again
        # as the result of another merge operation that occurs later. This
        # wouldn't break anything though -- it will just be a "permanent"
        # redirect to *another* permanent redirect.) This would require
        # rebuilding the URL in one of two ways: either by hacking it in with
        # string replacement, or making the endpoint aware of the URL pattern
        # that caused it to be dispatched, and reversing it with the correct
        # `issue_id` keyword argument.
        if organization_slug:
            try:
                if options.get("api.id-or-slug-enabled") and str(organization_slug).isnumeric():
                    organization = Organization.objects.get_from_cache(id=organization_slug)
                else:
                    organization = Organization.objects.get_from_cache(slug=organization_slug)
            except Organization.DoesNotExist:
                raise ResourceDoesNotExist

            bind_organization_context(organization)

            request._request.organization = organization  # type: ignore[attr-defined]
        else:
            organization = None

        try:
            group, _ = get_group_with_redirect(
                issue_id,
                queryset=Group.objects.select_related("project", "project__organization"),
                organization=organization,
            )
        except Group.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, group)

        with configure_scope() as scope:
            scope.set_tag("project", group.project_id)

        # we didn't bind context above, so do it now
        if not organization:
            bind_organization_context(group.project.organization)

        if group.status in EXCLUDED_STATUSES:
            raise ResourceDoesNotExist

        request._request.organization = group.project.organization  # type: ignore[attr-defined]

        kwargs["group"] = group

        return (args, kwargs)

    def get_external_issue_ids(self, group):
        return GroupLink.objects.filter(
            project_id=group.project_id, group_id=group.id, linked_type=GroupLink.LinkedType.issue
        ).values_list("linked_id", flat=True)

    def create_external_comment(self, request: Request, group, group_note):
        for external_issue_id in self.get_external_issue_ids(group):
            create_comment.apply_async(
                kwargs={
                    "external_issue_id": external_issue_id,
                    "group_note_id": group_note.id,
                    "user_id": request.user.id,
                }
            )

    def update_external_comment(self, request: Request, group, group_note):
        for external_issue_id in self.get_external_issue_ids(group):
            update_comment.apply_async(
                kwargs={
                    "external_issue_id": external_issue_id,
                    "group_note_id": group_note.id,
                    "user_id": request.user.id,
                }
            )
