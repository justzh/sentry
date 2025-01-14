import pytest

from sentry.eventstore.models import Event
from sentry.grouping.strategies.message import normalize_message_for_grouping
from sentry.testutils.helpers.options import override_options


@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        ("email", """blah test@email.com had a problem""", """blah <email> had a problem"""),
        ("url", """blah http://some.email.com had a problem""", """blah <url> had a problem"""),
        (
            "url - existing behavior",
            """blah tcp://user:pass@email.com:10 had a problem""",
            """blah tcp://user:<email>:<int> had a problem""",
        ),
        ("ip", """blah 0.0.0.0 had a problem""", """blah <ip> had a problem"""),
        (
            "UUID",
            """blah 7c1811ed-e98f-4c9c-a9f9-58c757ff494f had a problem""",
            """blah <uuid> had a problem""",
        ),
        (
            "UUID",
            """blah bea691f2-2e25-4bec-6838-e0c44b03d60a/7c1811ed-e98f-4c9c-a9f9-58c757ff494f had a problem""",
            """blah <uuid>/<uuid> had a problem""",
        ),
        (
            "SHA1",
            """blah 5fc35719b9cf96ec602dbc748ff31c587a46961d had a problem""",
            """blah <sha1> had a problem""",
        ),
        (
            "MD5",
            """blah 0751007cd28df267e8e051b51f918c60 had a problem""",
            """blah <md5> had a problem""",
        ),
        (
            "Date",
            """blah 2024-02-20T22:16:36 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC822",
            """blah Mon, 02 Jan 06 15:04 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC822Z",
            """blah Mon, 02 Jan 06 15:04 -0700 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC850",
            """blah Monday, 02-Jan-06 15:04:05 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC1123",
            """blah Mon, 02 Jan 2006 15:04:05 MST had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC1123Z",
            """blah Mon, 02 Jan 2006 15:04:05 -0700 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC3339",
            """blah 2006-01-02T15:04:05Z07:00 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Date RFC3339Nano",
            """blah 2006-01-02T15:04:05.999999999Z07:00 had a problem""",
            """blah <date> had a problem""",
        ),
        ("Date - plain", """blah 2006-01-02 had a problem""", """blah <date> had a problem"""),
        ("Date - long", """blah Jan 18, 2019 had a problem""", """blah <date> had a problem"""),
        (
            "Date - Datetime",
            """blah 2006-01-02 15:04:05 had a problem""",
            """blah <date> had a problem""",
        ),
        ("Date - Kitchen", """blah 3:04PM had a problem""", """blah <date> had a problem"""),
        ("Date - Time", """blah 15:04:05 had a problem""", """blah <date> had a problem"""),
        (
            "Date - basic",
            """blah Mon Jan 02, 1999 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Datetime - compressed",
            """blah 20240220 11:55:33.546593 had a problem""",
            """blah <date> had a problem""",
        ),
        (
            "Datetime - datestamp",
            """blah 2024-02-23 02:13:53.418 had a problem""",
            """blah <date> had a problem""",
        ),
        ("hex", """blah 0x9af8c3b had a problem""", """blah <hex> had a problem"""),
        ("float", """blah 0.23 had a problem""", """blah <float> had a problem"""),
        ("int", """blah 23 had a problem""", """blah <int> had a problem"""),
        ("quoted str", """blah b="1" had a problem""", """blah b=<quoted_str> had a problem"""),
        ("bool", """blah a=true had a problem""", """blah a=<bool> had a problem"""),
        (
            "Duration - ms",
            """blah connection failed after 12345ms 1.899s 3s""",
            """blah connection failed after <duration> <duration> <duration>""",
        ),
        (
            "Uniq ID - sql savepoint",
            '''SQL: RELEASE SAVEPOINT "s140177518376768_x2"''',
            """SQL: RELEASE SAVEPOINT <uniq_id>""",
        ),
        (
            "Uniq ID - api gateway",
            """API gateway VdLchF7iDo8sVkg= blah""",
            """API gateway <uniq_id> blah""",
        ),
        (
            "Uniq ID - fb trace",
            """fbtrace_id Aba64NMEPMmBwi_cPLaGeeK AugPfq0jxGbto4u3kxn8u6p blah""",
            """fbtrace_id <uniq_id> <uniq_id> blah""",
        ),
        (
            "Uniq ID - word with numerical pre/suffix",
            """1password python3 abc123 123abc""",
            """1password python3 abc123 123abc""",
        ),
        (
            "Uniq ID - cloudflare trace",
            """cloudflare trace 230b030023ae2822-SJC 819cc532aex26akb-SNP blah""",
            """cloudflare trace <uniq_id> <uniq_id> blah""",
        ),
        (
            "Uniq ID - JWT",
            """blah eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c""",
            """blah <uniq_id>""",
        ),
        (
            "Uniq ID - Nothing to replace",
            """I am the test words 1password python3 abc123 123abc""",
            """I am the test words 1password python3 abc123 123abc""",
        ),
    ],
)
def test_normalize_message(name, input, expected):
    event = Event(project_id=1, event_id="something")
    with override_options(
        {
            "grouping.experiments.parameterization.uniq_id": 100,
        }
    ):
        assert expected == normalize_message_for_grouping(input, event), f"Case {name} Failed"


# These are test cases that we should fix
@pytest.mark.xfail()
@pytest.mark.parametrize(
    ("name", "input", "expected"),
    [
        (
            "URL - non-http protocol user/pass/port",
            """blah tcp://user:pass@email.com:10 had a problem""",
            """blah <url> had a problem""",
        ),
        ("URL - IP w/ port", """blah 0.0.0.0:10 had a problem""", """blah <ip> had a problem"""),
    ],
)
def test_fail_to_normalize_message(name, input, expected):
    event = Event(project_id=1, event_id="something")
    with override_options(
        {
            "grouping.experiments.parameterization.uniq_id": 100,
        }
    ):
        assert expected == normalize_message_for_grouping(input, event), f"Case {name} Failed"
