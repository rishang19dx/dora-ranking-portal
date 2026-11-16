"""
Deadline-driven reminders for data requests (spec 2.5, Phase 3 acceptance:
"automated reminders trigger appropriately based on predefined deadlines").

The schedule is a list of milestones relative to each request's deadline:

    T-7, T-3, T-1        days before the deadline     (REMINDER_DAYS_BEFORE)
    OVERDUE-1..N         every K days after it         (REMINDER_OVERDUE_INTERVAL_DAYS,
                                                        REMINDER_OVERDUE_MAX)

`run_scheduled_reminders()` is called by `manage.py send_reminders` from cron
or the compose `reminders` service. Each run, for every section that is still
pending or partial on an open request with reminders enabled, it finds the
latest milestone that has fallen due and sends it unless it was already
handled. Rules that keep it from nagging:

  * Idempotent: a ScheduledReminder row per (section, milestone), enforced by
    a unique constraint, so re-running the job never re-sends.
  * Catch-up sends one mail, not a backlog: if the job was down across two
    milestones, only the latest is sent and the missed one is recorded as
    skipped.
  * Milestones that had already passed when the request was dispatched are
    skipped - the dispatch email itself covered them.
  * A manual reminder in the last REMINDER_MANUAL_COOLDOWN_HOURS suppresses the
    automated one, so an officer is not mailed twice in a day.
  * Submitted sections, closed requests and paused requests get nothing.

Every reminder rotates the upload link exactly as a manual reminder does, so
the link in an earlier mail stops working.
"""
import math
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import (
    DataRequest,
    DataRequestStatus,
    DeliveryKind,
    DeliveryStatus,
    ReminderOutcome,
    RequestDelivery,
    ScheduledReminder,
    TargetStatus,
)

OPEN_TARGET_STATES = (TargetStatus.PENDING, TargetStatus.PARTIAL)


@dataclass(frozen=True)
class Milestone:
    key: str
    due_at: datetime
    overdue: bool
    days: int  # days before the deadline, or the overdue sequence number


def policy():
    return {
        'daysBefore': sorted(set(getattr(settings, 'REMINDER_DAYS_BEFORE', [7, 3, 1])), reverse=True),
        'overdueIntervalDays': max(1, int(getattr(settings, 'REMINDER_OVERDUE_INTERVAL_DAYS', 3))),
        'overdueMax': max(0, int(getattr(settings, 'REMINDER_OVERDUE_MAX', 3))),
        'manualCooldownHours': max(0, int(getattr(settings, 'REMINDER_MANUAL_COOLDOWN_HOURS', 20))),
    }


def milestones_for(deadline):
    """Every milestone on a request's schedule, in chronological order."""
    p = policy()
    out = [
        Milestone(f'T-{d}', deadline - timedelta(days=d), False, d)
        for d in p['daysBefore'] if d > 0
    ]
    for n in range(1, p['overdueMax'] + 1):
        out.append(Milestone(
            f'OVERDUE-{n}', deadline + timedelta(days=p['overdueIntervalDays'] * (n - 1), hours=1), True, n,
        ))
    # The first overdue chase is an hour after the deadline, so a submission
    # made at the last minute is not chased before it has been recorded.
    return sorted(out, key=lambda m: m.due_at)


def due_milestone(data_req, now):
    """The latest milestone that has fallen due, or None."""
    due = [m for m in milestones_for(data_req.deadline) if m.due_at <= now]
    return due[-1] if due else None


def timing_sentence(data_req, now):
    deadline_text = timezone.localtime(data_req.deadline).strftime('%d %b %Y')
    if now >= data_req.deadline:
        return (f'The submission deadline of {deadline_text} has passed; '
                'please submit as soon as possible or contact the DORA office.')
    remaining = (data_req.deadline - now).total_seconds()
    if remaining < 12 * 3600:
        return f'The submission deadline is today ({deadline_text}).'
    days = math.ceil(remaining / 86400)
    return f"The submission deadline is {deadline_text}, {days} day{'s' if days != 1 else ''} from now."


def send_target_reminder(data_req, target, *, now=None, subject_prefix='Reminder'):
    """
    Email every eligible officer of one section a fresh link. Shared by the
    manual REMIND action and the scheduler. Returns the number of messages.
    """
    from .mailer import DEFAULT_REMINDER_TEMPLATE, render_template, send_mail
    from .services import eligible_officers_for_unit, issue_grant

    now = now or timezone.now()
    unit = target.org_unit
    unit_label = unit.short_name or unit.name
    sent = 0

    for officer in eligible_officers_for_unit(unit):
        # Rotating here is what makes a reminder safe: the link in the earlier
        # mail stops working once the new one is sent.
        _grant, _token, portal_url = issue_grant(data_req, unit, officer, target.data_item_ids)
        body = render_template(DEFAULT_REMINDER_TEMPLATE, {
            'officer': officer.name,
            'email': officer.email,
            'section': unit_label,
            'sectionFullName': unit.name,
            'framework': data_req.framework,
            'cycle': str(data_req.cycle_year),
            'title': data_req.title,
            'reference': data_req.reference,
            'deadline': timezone.localtime(data_req.deadline).strftime('%d %b %Y'),
            'timing': timing_sentence(data_req, now),
            'dataItems': '\n'.join(f'  - {item_id}' for item_id in target.data_item_ids),
            'portalLink': portal_url,
        })
        subject = f'{subject_prefix}: {data_req.reference} - {data_req.title}'
        result = send_mail(to=officer.email, subject=subject, body=body)
        status = {
            'SENT': DeliveryStatus.SENT,
            'FAILED': DeliveryStatus.FAILED,
        }.get(result.get('status'), DeliveryStatus.SIMULATED)
        RequestDelivery.objects.create(
            request=data_req, officer=officer, org_unit=unit, email=officer.email,
            subject=subject, status=status, kind=DeliveryKind.REMINDER,
            error=result.get('error', '') or '',
        )
        sent += 1

    target.reminders_sent += 1
    target.last_reminder_at = now
    target.save(update_fields=['reminders_sent', 'last_reminder_at'])
    return sent


def _record(data_req, target, milestone, outcome, detail='', deliveries=0):
    try:
        with transaction.atomic():
            return ScheduledReminder.objects.create(
                request=data_req, target=target, milestone=milestone.key, due_at=milestone.due_at,
                outcome=outcome, detail=detail, deliveries=deliveries,
            )
    except IntegrityError:
        return None  # a concurrent run handled it first


def _skip_reason(data_req, target, milestone, now, p):
    if milestone.due_at < data_req.dispatched_at:
        return 'Already past when the request was dispatched; the dispatch email covered it.'
    if target.last_reminder_at and p['manualCooldownHours']:
        if now - target.last_reminder_at < timedelta(hours=p['manualCooldownHours']):
            return 'A reminder was sent recently; not mailing the officer twice.'
    return None


def run_scheduled_reminders(now=None, dry_run=False):
    """One pass of the scheduler. Returns a report of what was (or would be) done."""
    now = now or timezone.now()
    p = policy()
    report = {'ranAt': now.isoformat(), 'dryRun': dry_run, 'policy': p, 'sent': [], 'skipped': []}

    requests = (
        DataRequest.objects
        .filter(status=DataRequestStatus.DISPATCHED, auto_remind=True)
        .prefetch_related('targets__org_unit', 'scheduled_reminders')
    )
    for data_req in requests:
        milestone = due_milestone(data_req, now)
        if milestone is None:
            continue
        handled = {(r.target_id, r.milestone) for r in data_req.scheduled_reminders.all()}
        earlier = [m for m in milestones_for(data_req.deadline) if m.due_at < milestone.due_at]

        for target in data_req.targets.all():
            if target.status not in OPEN_TARGET_STATES or (target.id, milestone.key) in handled:
                continue
            entry = {
                'requestId': data_req.id, 'reference': data_req.reference,
                'unitId': target.org_unit_id, 'milestone': milestone.key,
            }
            reason = _skip_reason(data_req, target, milestone, now, p)
            if dry_run:
                (report['skipped'] if reason else report['sent']).append({**entry, 'reason': reason})
                continue

            # Milestones overtaken while the job was not running are recorded,
            # not sent, so catching up costs the officer one email.
            for missed in earlier:
                if (target.id, missed.key) not in handled:
                    _record(data_req, target, missed, ReminderOutcome.SKIPPED,
                            'Overtaken by a later milestone before the scheduler ran.')

            if reason:
                if _record(data_req, target, milestone, ReminderOutcome.SKIPPED, reason):
                    report['skipped'].append({**entry, 'reason': reason})
                continue

            # Claim the milestone before mailing, so two overlapping runs
            # cannot both send it.
            row = _record(data_req, target, milestone, ReminderOutcome.SENT, 'Sending')
            if row is None:
                continue
            prefix = 'Overdue' if milestone.overdue else 'Reminder'
            count = send_target_reminder(data_req, target, now=now, subject_prefix=prefix)
            row.deliveries = count
            row.detail = (f'{count} message(s) sent.' if count
                          else 'No eligible officer or mailbox for this section.')
            row.save(update_fields=['deliveries', 'detail'])
            report['sent'].append({**entry, 'deliveries': count})

    return report


def schedule_for(data_req, now=None):
    """
    The full milestone timeline for one request, with what happened at each
    point: what the Reminders page and the request detail render.
    """
    now = now or timezone.now()
    rows = {}
    for r in data_req.scheduled_reminders.all():
        rows.setdefault(r.milestone, []).append(r)

    open_targets = [t for t in data_req.targets.all() if t.status in OPEN_TARGET_STATES]
    timeline = []
    for m in milestones_for(data_req.deadline):
        records = rows.get(m.key, [])
        if records:
            state = 'SENT' if any(r.outcome == ReminderOutcome.SENT for r in records) else 'SKIPPED'
        elif m.due_at > now:
            state = 'UPCOMING'
        else:
            state = 'DUE'
        timeline.append({
            'milestone': m.key,
            'dueAt': m.due_at,
            'overdue': m.overdue,
            'state': state,
            'sections': [
                {'unitId': r.target.org_unit_id, 'outcome': r.outcome, 'detail': r.detail,
                 'deliveries': r.deliveries, 'at': r.created_at}
                for r in records
            ],
            'sectionsAwaiting': len(open_targets) if state in ('UPCOMING', 'DUE') else None,
        })
    return timeline
