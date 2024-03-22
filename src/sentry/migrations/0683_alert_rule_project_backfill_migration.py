# Generated by Django 5.0.3 on 2024-03-22 22:36

import logging

from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration

logger = logging.getLogger(__name__)


def backfill_alert_rule_projects(apps, schema_editor):
    QuerySubscriptions = apps.get_model("sentry", "QuerySubscription")
    AlertRuleProjects = apps.get_model("sentry", "AlertRuleProjects")

    for subscription in QuerySubscriptions.objects.all():

        snuba_query = subscription.snuba_query
        if not snuba_query:
            logger.warning(
                "QuerySubscription found with no snuba_query",
                extra={"query_subscription_id": subscription.id},
            )
            continue

        alert_rule = snuba_query.sentry_alertrule

        AlertRuleProjects.objects.create(
            alert_rule=alert_rule,
            project=subscription.project,
        )


class Migration(CheckedMigration):
    is_dangerous = False

    dependencies = [
        ("sentry", "0682_monitors_constrain_to_project_id_slug"),
    ]

    operations = [
        # Run the data migration
        migrations.RunPython(backfill_alert_rule_projects),
    ]
