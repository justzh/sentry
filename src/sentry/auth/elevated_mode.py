from abc import ABC, abstractmethod
from enum import Enum
from typing import Tuple

from rest_framework.request import Request

from sentry import features


class InactiveReason(str, Enum):
    INVALID_IP = "invalid-ip"
    INCOMPLETE_SSO = "incomplete-sso"
    # Indicates the request should be allowed
    NONE = None

    def __bool__(self):
        return self.value is not None

    def __str__(self) -> str:
        return self.value


class ElevatedMode(ABC):
    @property
    @abstractmethod
    def is_active(self) -> bool:
        pass

    @abstractmethod
    def is_privileged_request(self) -> Tuple[bool, InactiveReason]:
        pass

    @abstractmethod
    def get_session_data(self, current_datetime=None):
        pass

    @abstractmethod
    def _populate(self) -> None:
        pass

    @abstractmethod
    def set_logged_in(self, user, current_datetime=None) -> None:
        pass

    @abstractmethod
    def set_logged_out(self) -> None:
        pass

    @abstractmethod
    def on_response(cls, response) -> None:
        pass


def has_elevated_mode(request: Request) -> bool:
    """
    This is a temporary helper method that checks if the user on the request has
    the staff feature flag enabled. If so, it checks is_active_staff and
    otherwise defaults to checking is_active_superuser.
    """
    from sentry.auth.staff import is_active_staff
    from sentry.auth.superuser import is_active_superuser

    enforce_staff_permission = features.has("auth:enterprise-staff-cookie", actor=request.user)

    if enforce_staff_permission:
        return is_active_staff(request)

    return is_active_superuser(request)
