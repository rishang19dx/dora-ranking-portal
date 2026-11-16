"""
Send the deadline reminders that have fallen due (spec 2.5).

Safe to run as often as you like - hourly from cron or the compose
`reminders` service - because each section gets each milestone at most once.

    python manage.py send_reminders            # send what is due
    python manage.py send_reminders --dry-run  # list what would be sent
"""
from django.core.management.base import BaseCommand

from apps.data_requests.reminders import run_scheduled_reminders


class Command(BaseCommand):
    help = 'Send automated deadline reminders that have fallen due.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report without sending or recording.')

    def handle(self, *args, **opts):
        report = run_scheduled_reminders(dry_run=opts['dry_run'])
        verb = 'Would send' if report['dryRun'] else 'Sent'
        for item in report['sent']:
            self.stdout.write(f"{verb} {item['milestone']} to {item['unitId']} for {item['reference']}"
                              + (f" ({item['deliveries']} message(s))" if 'deliveries' in item else ''))
        for item in report['skipped']:
            self.stdout.write(f"Skipped {item['milestone']} for {item['unitId']} on {item['reference']}: {item['reason']}")
        self.stdout.write(self.style.SUCCESS(
            f"{len(report['sent'])} reminder(s) {'due' if report['dryRun'] else 'sent'}, "
            f"{len(report['skipped'])} skipped."
        ))
