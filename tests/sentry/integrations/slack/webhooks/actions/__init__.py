from unittest.mock import patch

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import add_identity, install_slack
from sentry.utils import json


class BaseEventTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.external_id = "slack:1"
        self.integration = install_slack(self.organization)
        self.idp = add_identity(self.integration, self.user, self.external_id)

        self.trigger_id = "13345224609.738474920.8088930838d88f008e0"
        self.response_url = (
            "https://hooks.slack.com/actions/T47563693/6204672533/x7ZLaiVMoECAW50Gw1ZYAXEM"
        )

    @patch(
        "sentry.integrations.slack.requests.base.SlackRequest._check_signing_secret",
        return_value=True,
    )
    def post_webhook(
        self,
        check_signing_secret_mock,
        action_data=None,
        type="event_callback",
        data=None,
        team_id="TXXXXXXX1",
        callback_id=None,
        slack_user=None,
        original_message=None,
    ):

        if slack_user is None:
            slack_user = {"id": self.external_id, "domain": "example"}

        if callback_id is None:
            callback_id = json.dumps({"issue": self.group.id})

        if original_message is None:
            original_message = {}

        payload = {
            "team": {"id": team_id, "domain": "example.com"},
            "channel": {"id": "C065W1189", "domain": "forgotten-works"},
            "user": slack_user,
            "callback_id": callback_id,
            "action_ts": "1458170917.164398",
            "message_ts": "1458170866.000004",
            "original_message": original_message,
            "trigger_id": self.trigger_id,
            "response_url": self.response_url,
            "attachment_id": "1",
            "actions": action_data or [],
            "type": type,
        }
        if data:
            payload.update(data)

        payload = {"payload": json.dumps(payload)}

        return self.client.post("/extensions/slack/action/", data=payload)

    @patch(
        "sentry.integrations.slack.requests.base.SlackRequest._check_signing_secret",
        return_value=True,
    )
    def post_webhook_block_kit(
        self,
        check_signing_secret_mock,
        action_data=None,
        type="block_actions",
        data=None,
        team_id="TXXXXXXX1",
        slack_user=None,
        original_message=None,
    ):

        if slack_user is None:
            slack_user = {
                "id": self.external_id,
                "name": "colleen",
                "username": "colleen",
                "team_id": team_id,
            }

        if original_message is None:
            original_message = {}

        payload = {
            "type": type,
            "user": slack_user,
            "api_app_id": "A058NGW5NDP",
            "token": "6IM9MzJR4Ees5x4jkW29iKbj",
            "container": {
                "type": "message",
                "message_ts": "1702424381.221719",
                "channel_id": "C065W1189",
                "is_ephemeral": False,
            },
            "trigger_id": self.trigger_id,
            "team": {
                "id": team_id,
                "domain": "hb-meowcraft",
            },
            "enterprise": None,
            "is_enterprise_install": False,
            "channel": {
                "id": "C065W1189",
                "name": "general",
            },
            "message": original_message,
            "state": {
                "values": {
                    "bXwil": {
                        "assign": {
                            "type": "static_select",
                            "selected_option": "None",
                        }
                    }
                }
            },
            "response_url": self.response_url,
            "actions": action_data or [],
        }
        if data:
            payload.update(data)

        payload = {"payload": json.dumps(payload)}
        return self.client.post("/extensions/slack/action/", data=payload)
